// Pedidos de fornecedor (C7 Drop e afins): produto, custo sem margem,
// etiqueta de envio e comprovante do PIX. Lê/grava direto via Supabase
// client — a segurança fica inteira na RLS da tabela `fulfillment_requests`
// e do bucket `fulfillment-attachments` (cada revendedor só vê o que é
// dele; o dono do Shoppfy vê tudo). Sem server function aqui porque não há
// segredo de servidor envolvido — é o mesmo padrão já usado por
// profiles/settings no resto do app.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FulfillmentRequest = Database["public"]["Tables"]["fulfillment_requests"]["Row"];
export type FulfillmentStatus = Database["public"]["Enums"]["fulfillment_status"];
export type PersonType = Database["public"]["Enums"]["person_type"];

export const PERSON_TYPE_LABEL: Record<PersonType, string> = {
  fisica: "Pessoa física",
  juridica: "Pessoa jurídica",
};

const BUCKET = "fulfillment-attachments";

export const STATUS_LABEL: Record<FulfillmentStatus, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  shipped: "Enviado",
  canceled: "Cancelado",
};

async function uploadAttachment(
  userId: string,
  requestId: string,
  kind: "label" | "proof",
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${userId}/${requestId}/${kind}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function createFulfillmentRequest(params: {
  userId: string;
  submitterName: string;
  submitterEmail: string;
  submitterPhone: string;
  submitterPersonType: PersonType;
  submitterDocument: string;
  productName: string;
  costCents: number;
  labelFile: File;
  proofFile: File;
  notes?: string;
}): Promise<FulfillmentRequest> {
  const requestId = crypto.randomUUID();
  const [labelPath, proofPath] = await Promise.all([
    uploadAttachment(params.userId, requestId, "label", params.labelFile),
    uploadAttachment(params.userId, requestId, "proof", params.proofFile),
  ]);

  const { data, error } = await supabase
    .from("fulfillment_requests")
    .insert({
      id: requestId,
      user_id: params.userId,
      submitter_name: params.submitterName,
      submitter_email: params.submitterEmail,
      submitter_phone: params.submitterPhone,
      submitter_person_type: params.submitterPersonType,
      submitter_document: params.submitterDocument,
      product_name: params.productName,
      cost_cents: params.costCents,
      label_path: labelPath,
      proof_path: proofPath,
      notes: params.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Sem filtro por user_id no SELECT: a RLS decide sozinha se a conta vê só
// os próprios pedidos (revendedor) ou todos (dono do Shoppfy).
export async function listFulfillmentRequests(): Promise<FulfillmentRequest[]> {
  const { data, error } = await supabase
    .from("fulfillment_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAttachmentSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) {
    console.error("[fulfillment] falha ao gerar link do anexo:", error.message);
    return null;
  }
  return data.signedUrl;
}

export async function updateFulfillmentStatus(
  id: string,
  status: FulfillmentStatus,
): Promise<void> {
  const { error } = await supabase.from("fulfillment_requests").update({ status }).eq("id", id);
  if (error) throw error;
}

// Dono manda o código de rastreio pro revendedor. Marca como "shipped"
// automaticamente — se já saiu com código de rastreio, saiu do estoque.
export async function sendTrackingCode(id: string, trackingCode: string): Promise<void> {
  const code = trackingCode.trim();
  if (!code) throw new Error("Informe um código de rastreio.");
  const { error } = await supabase
    .from("fulfillment_requests")
    .update({ tracking_code: code, tracking_sent_at: new Date().toISOString(), status: "shipped" })
    .eq("id", id);
  if (error) throw error;
}

// Escuta em tempo real (Supabase Realtime) só os pedidos do próprio usuário.
// Dispara `onTrackingReceived` sempre que `tracking_code` passa de vazio pra
// preenchido — não em qualquer UPDATE (senão notificaria de novo em
// mudanças de status que nada têm a ver com o rastreio).
export function subscribeToTrackingUpdates(
  userId: string,
  onTrackingReceived: (request: FulfillmentRequest) => void,
): () => void {
  const channel = supabase
    .channel(`fulfillment-tracking-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "fulfillment_requests",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const next = payload.new as FulfillmentRequest;
        const prev = payload.old as Partial<FulfillmentRequest>;
        if (next.tracking_code && next.tracking_code !== prev.tracking_code) {
          onTrackingReceived(next);
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

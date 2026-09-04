import { useState } from "react";
import { AlertTriangle, Loader2, Package, Paperclip, Receipt, Send, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { createFulfillmentRequest, PERSON_TYPE_LABEL, type PersonType } from "@/lib/fulfillment";
import { formatBRL } from "@/lib/format";
import { convertImageToPdf } from "@/lib/image-to-pdf";
import { PixPayment } from "@/components/pedidos/pix-payment";

// Toda vez que fecha uma venda, o revendedor tem que mandar R$ 2,00 a mais
// no PIX referente à embalagem (regra do fornecedor C7 Drop).
const PACKAGING_FEE_CENTS = 200;

function parseMoney(value: string): number {
  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function FileField({
  id,
  label,
  hint,
  file,
  onChange,
  convertImagesToPdf,
}: {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  // Etiqueta de envio: se vier como foto/print, converte pra PDF na hora —
  // o fornecedor sempre recebe um PDF pronto de despachar, mesmo que o
  // revendedor mande um print.
  convertImagesToPdf?: boolean;
}) {
  const [converting, setConverting] = useState(false);

  const handleSelect = async (selected: File | null) => {
    if (!selected) {
      onChange(null);
      return;
    }
    if (convertImagesToPdf && selected.type.startsWith("image/")) {
      setConverting(true);
      try {
        const pdfFile = await convertImageToPdf(selected);
        onChange(pdfFile);
        toast.success("Etiqueta convertida pra PDF");
      } catch (err) {
        console.error("[FileField] falha ao converter etiqueta pra PDF:", err);
        toast.error("Não deu pra converter essa imagem em PDF. Tenta anexar o PDF direto.");
        onChange(null);
      } finally {
        setConverting(false);
      }
      return;
    }
    onChange(selected);
  };

  return (
    <div>
      <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type="file"
        accept="image/*,.pdf"
        disabled={converting}
        className="h-9 cursor-pointer text-[12.5px]"
        onChange={(e) => void handleSelect(e.target.files?.[0] ?? null)}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {converting ? "Convertendo pra PDF…" : file ? `Selecionado: ${file.name}` : hint}
      </p>
    </div>
  );
}

export function PedidoForm({ onCreated }: { onCreated: () => void }) {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);

  // Dados de quem está enviando o pedido (o revendedor) — usados pro
  // faturamento no fornecedor. Não são os dados do cliente que comprou.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(profile?.email ?? session?.user.email ?? "");
  const [personType, setPersonType] = useState<PersonType>("fisica");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");

  const [productName, setProductName] = useState("");
  const [costInput, setCostInput] = useState("");
  const [notes, setNotes] = useState("");
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costCents = parseMoney(costInput);
  const userId = session?.user.id ?? profile?.id;
  const canSubmit =
    Boolean(userId) &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    document.trim().length > 0 &&
    productName.trim().length > 0 &&
    costCents > 0 &&
    Boolean(labelFile) &&
    Boolean(proofFile) &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !labelFile || !proofFile) return;

    setSubmitting(true);
    setError(null);
    try {
      await createFulfillmentRequest({
        userId,
        submitterName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        submitterEmail: email.trim(),
        submitterPhone: phone.trim(),
        submitterPersonType: personType,
        submitterDocument: document.trim(),
        productName: productName.trim(),
        costCents,
        labelFile,
        proofFile,
        notes,
      });
      toast.success("Pedido enviado", {
        description: "Assim que confirmarmos o PIX, seguimos com o envio.",
      });
      setProductName("");
      setCostInput("");
      setNotes("");
      setLabelFile(null);
      setProofFile(null);
      onCreated();
    } catch (err) {
      console.error("[PedidoForm] falha ao enviar pedido:", err);
      setError(
        err instanceof Error ? err.message : "Não deu pra enviar o pedido agora. Tenta de novo.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Reveal className="surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="size-4 text-brand" />
        <h2 className="text-[14px] font-medium text-foreground">Registrar novo pedido</h2>
      </div>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Preencha assim que fechar uma venda. Informe o produto e o custo{" "}
        <span className="text-foreground">sem a sua margem</span> — é o valor que você paga pro
        fornecedor. Anexe a etiqueta de envio e o comprovante do PIX.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-border bg-surface-hover/40 p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <UserRound className="size-3.5 text-brand" />
            <p className="text-[12.5px] font-medium text-foreground">Seus dados</p>
          </div>
          <p className="mb-3 text-[11.5px] text-muted-foreground">
            São as <span className="text-foreground">suas informações</span> (quem está fazendo o
            pedido), usadas pro faturamento no fornecedor — não são os dados da pessoa que comprou
            de você.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="nome">
                Nome
              </label>
              <Input
                id="nome"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: João"
                className="h-9 text-[13px]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="sobrenome">
                Sobrenome
              </label>
              <Input
                id="sobrenome"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex: Pedro"
                className="h-9 text-[13px]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="email">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="h-9 text-[13px]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="telefone">
                Telefone
              </label>
              <Input
                id="telefone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="h-9 text-[13px]"
              />
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1.5 text-[12px] text-muted-foreground">Tipo de pessoa</p>
            <RadioGroup
              value={personType}
              onValueChange={(value) => setPersonType(value as PersonType)}
              className="flex gap-4"
            >
              {(Object.keys(PERSON_TYPE_LABEL) as PersonType[]).map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <RadioGroupItem value={type} id={`pessoa-${type}`} />
                  <Label htmlFor={`pessoa-${type}`} className="text-[12.5px] font-normal">
                    {PERSON_TYPE_LABEL[type]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="documento">
              {personType === "juridica" ? "CNPJ" : "CPF"}
            </label>
            <Input
              id="documento"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder={personType === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
              className="h-9 max-w-xs text-[13px]"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="produto">
              Produto
            </label>
            <Input
              id="produto"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Fone Bluetooth TWS"
              className="h-9 text-[13px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="custo">
              Custo do produto (sem a sua margem)
            </label>
            <Input
              id="custo"
              inputMode="decimal"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="0,00"
              className="h-9 text-[13px]"
            />
          </div>
        </div>

        {costCents > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-[13px] text-amber-500">
            <Package className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-semibold">Não esqueça a embalagem:</span> mande{" "}
              <span className="font-semibold">{formatBRL(PACKAGING_FEE_CENTS)} a mais</span> no PIX,
              além do custo do produto. Total a enviar:{" "}
              <span className="font-semibold">{formatBRL(costCents + PACKAGING_FEE_CENTS)}</span>.
            </p>
          </div>
        )}

        {costCents > 0 && <PixPayment amountCents={costCents + PACKAGING_FEE_CENTS} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <FileField
            id="etiqueta"
            label="Etiqueta de envio"
            hint="PDF ou print da etiqueta — a gente converte pra PDF automaticamente"
            file={labelFile}
            onChange={setLabelFile}
            convertImagesToPdf
          />
          <FileField
            id="comprovante"
            label="Comprovante do PIX"
            hint="Print ou PDF do comprovante"
            file={proofFile}
            onChange={setProofFile}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="obs">
            Observações (opcional)
          </label>
          <Textarea
            id="obs"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ex: cliente pediu pra enviar com urgência"
            className="text-[12.5px]"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Button type="submit" className="gap-2" disabled={!canSubmit}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {submitting ? "Enviando…" : "Enviar pedido"}
        </Button>
        {!userId && (
          <p className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Paperclip className="size-3" />
            Faça login pra registrar um pedido.
          </p>
        )}
      </form>
    </Reveal>
  );
}

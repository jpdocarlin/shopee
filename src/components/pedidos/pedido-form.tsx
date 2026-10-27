import { useEffect, useRef, useState } from "react";
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
import { notifyNewFulfillmentRequest } from "@/lib/push.functions";
import { linkImportedOrder } from "@/lib/orders.functions";
import { checkC7DropPrice } from "@/lib/c7drop-price.functions";
import { formatBRL } from "@/lib/format";
import { convertImageToPdf } from "@/lib/image-to-pdf";
import { PixPayment } from "@/components/pedidos/pix-payment";
import { ProductAutocomplete } from "@/components/pedidos/product-autocomplete";
import type { C7DropProduct } from "@/data/c7drop-products";

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

// 23/09/2026: usado quando o revendedor escolhe um produto do catálogo no
// autocomplete — preenche o campo "custo" automaticamente com o custo do
// fornecedor (a embalagem já é somada em cima disso automaticamente mais
// abaixo, no aviso e no valor do PIX — não soma aqui pra não contar 2x).
function centsToDecimalInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
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

// Venda importada da Shopee/ML escolhida em "Vendas pra enviar ao
// fornecedor": preenche produto, observação e (no ML) a etiqueta.
export type PedidoPrefill = {
  key: string;
  importedOrderId: string;
  product: C7DropProduct | null;
  notes: string;
  labelFile: File | null;
};

export function PedidoForm({
  onCreated,
  prefill,
}: {
  onCreated: () => void;
  prefill?: PedidoPrefill | null;
}) {
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

  const [product, setProduct] = useState<C7DropProduct | null>(null);
  const [costInput, setCostInput] = useState("");
  const [notes, setNotes] = useState("");
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Preço de Dropshipping conferido AO VIVO na C7Drop quando escolhe o
  // produto (o catálogo da lista pode estar algumas horas atrasado).
  const [priceChecking, setPriceChecking] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  // Só a resposta do ÚLTIMO produto escolhido vale (se trocar rápido de
  // produto, a consulta anterior pode voltar depois).
  const latestPickRef = useRef<string | null>(null);

  const costCents = parseMoney(costInput);

  const pickProduct = async (picked: C7DropProduct | null) => {
    setProduct(picked);
    setPriceError(null);
    setPriceNotice(null);
    setCostInput("");
    latestPickRef.current = picked?.id ?? null;
    if (!picked) {
      setPriceChecking(false);
      return;
    }
    setPriceChecking(true);
    try {
      const live = await checkC7DropPrice({ data: { productId: picked.id } });
      if (latestPickRef.current !== picked.id) return;
      if (!live.available) {
        setProduct(null);
        setPriceError("Esse produto esgotou na C7Drop. Escolha outro produto.");
        return;
      }
      setCostInput(centsToDecimalInput(live.priceCents));
    } catch (err) {
      if (latestPickRef.current !== picked.id) return;
      setProduct(null);
      setPriceError(
        err instanceof Error ? err.message : "Não conseguimos confirmar o preço agora.",
      );
    } finally {
      if (latestPickRef.current === picked.id) setPriceChecking(false);
    }
  };
  useEffect(() => {
    if (!prefill) return;
    setNotes(prefill.notes);
    setLabelFile(prefill.labelFile);
    void pickProduct(prefill.product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.key]);

  const userId = session?.user.id ?? profile?.id;
  const canSubmit =
    Boolean(userId) &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    document.trim().length > 0 &&
    Boolean(product) &&
    costCents > 0 &&
    !priceChecking &&
    Boolean(labelFile) &&
    Boolean(proofFile) &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !labelFile || !proofFile || !product) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await createFulfillmentRequest({
        userId,
        submitterName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        submitterEmail: email.trim(),
        submitterPhone: phone.trim(),
        submitterPersonType: personType,
        submitterDocument: document.trim(),
        productId: product.id,
        costCents,
        labelFile,
        proofFile,
        notes,
      });
      if (!created.ok) {
        if (created.reason === "sold_out") {
          setError("Esse produto esgotou na C7Drop agora. O pedido não foi registrado.");
        } else {
          const diff = created.priceCents - costCents;
          setCostInput(centsToDecimalInput(created.priceCents));
          setProofFile(null);
          setPriceNotice(
            `O preço desse produto na C7Drop subiu agora para ${formatBRL(created.priceCents)}. ` +
              `Mande a diferença de ${formatBRL(diff)} no PIX e anexe o comprovante de novo ` +
              `(pode ser um comprovante com os dois PIX). O pedido ainda não foi registrado.`,
          );
        }
        return;
      }
      if (prefill?.importedOrderId) {
        await linkImportedOrder({
          data: { id: prefill.importedOrderId, requestId: created.id },
        }).catch((err) => console.error("[PedidoForm] falha ao ligar a venda:", err));
      }
      // Avisa a conta de pedidos no celular (push). Não trava o envio se falhar.
      void notifyNewFulfillmentRequest({ data: { requestId: created.id } }).catch((err) =>
        console.error("[PedidoForm] falha ao notificar pedido novo:", err),
      );
      toast.success("Pedido enviado", {
        description: "Assim que confirmarmos o PIX, seguimos com o envio.",
      });
      setProduct(null);
      setCostInput("");
      setNotes("");
      setLabelFile(null);
      setProofFile(null);
      setPriceNotice(null);
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
            <ProductAutocomplete
              id="produto"
              selected={product}
              onSelect={(picked) => void pickProduct(picked)}
              placeholder="Digite o nome do produto que você vendeu…"
              className="h-9 text-[13px]"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Escolha na lista o mesmo produto que você anunciou — o custo é preenchido sozinho com
              o preço atual da C7Drop.
            </p>
            {priceError && <p className="mt-1 text-[11.5px] text-destructive">{priceError}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-muted-foreground" htmlFor="custo">
              Custo do produto (sem a sua margem)
            </label>
            {/* Só leitura: o custo é o preço de Dropshipping confirmado agora na
                C7Drop — o revendedor não digita (antes digitava e às vezes pagava
                menos do que a C7Drop cobra). */}
            <Input
              id="custo"
              inputMode="decimal"
              value={priceChecking ? "Conferindo preço na C7Drop…" : costInput}
              readOnly
              placeholder="Escolha o produto"
              className="h-9 cursor-not-allowed text-[13px]"
            />
          </div>
        </div>

        {priceNotice && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-[13px] text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{priceNotice}</p>
          </div>
        )}

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

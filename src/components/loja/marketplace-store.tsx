// Minha Loja (10/11/2026): edita a loja que o usuário já tem dentro da Shopee
// e do Mercado Livre. Cada "Salvar" manda a alteração direto pro marketplace
// pela API oficial (ver marketplace-store.functions.ts pro que cada API deixa).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Store,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyShopCategoryGroup,
  classifyShopeeListings,
  planShopOrganization,
  changeShopeeShopCategoryItems,
  deleteShopeeShopCategory,
  getListingContent,
  getMarketplaceStore,
  getShopeeShopCategoryItems,
  listEditableListings,
  saveShopeeShopCategory,
  updateListingContent,
  updateShopeeProfile,
  type EditableListing,
  type ShopCategory,
} from "@/lib/marketplace-store.functions";
import { buildGroups, type OrganizationGroup } from "@/lib/shop-organization";
import { cn } from "@/lib/utils";

type Channel = "shopee" | "mercado-livre";
const NAME: Record<Channel, string> = { shopee: "Shopee", "mercado-livre": "Mercado Livre" };
const NA: Record<Channel, string> = { shopee: "na Shopee", "mercado-livre": "no Mercado Livre" };
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function message(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não deu pra ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-5">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      {hint && <p className="mt-1 max-w-2xl text-[12.5px] text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shopee: perfil da loja
// ---------------------------------------------------------------------------

function ShopeeProfile({
  initial,
  onSaved,
}: {
  initial: { name: string; logo: string; description: string };
  onSaved: (next: { name: string; logo: string; description: string }) => void;
}) {
  const runUpdate = useServerFn(updateShopeeProfile);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [logoPreview, setLogoPreview] = useState(initial.logo);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const nameChanged = name.trim() !== initial.name;
  const descriptionChanged = description.trim() !== initial.description.trim();
  const changed = nameChanged || descriptionChanged || Boolean(logoDataUrl);

  async function pickLogo(file: File) {
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("Formato não aceito", { description: "Envie PNG, JPG ou WEBP." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande", { description: "O logo precisa ter até 2 MB." });
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    setLogoDataUrl(dataUrl);
    setLogoPreview(dataUrl);
  }

  async function save() {
    const changes = [
      nameChanged ? `nome: “${name.trim()}”` : null,
      logoDataUrl ? "logo novo" : null,
      descriptionChanged ? "descrição" : null,
    ].filter(Boolean);
    if (
      !window.confirm(
        `Salvar na sua loja da Shopee?\n\nVai mudar: ${changes.join(", ")}.\nA alteração aparece pros compradores na hora.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const result = await runUpdate({
        data: {
          ...(nameChanged ? { name: name.trim() } : {}),
          ...(descriptionChanged ? { description: description.trim() } : {}),
          ...(logoDataUrl ? { logoDataUrl } : {}),
        },
      });
      const next = {
        name: result.name ?? name.trim(),
        logo: result.logo ?? initial.logo,
        description: result.description ?? description.trim(),
      };
      onSaved(next);
      setLogoDataUrl(null);
      toast.success("Loja atualizada na Shopee");
    } catch (err) {
      toast.error("Não deu pra salvar na Shopee", { description: message(err, "Tente de novo.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Perfil da loja"
      hint="Nome, logo e descrição que os compradores veem na página da sua loja na Shopee."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-[12px] font-medium text-muted-foreground">Nome da loja</span>
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="h-9 text-[13px]" />
            <span className="block text-[11.5px] text-muted-foreground/80">
              A Shopee limita quantas vezes o nome pode ser trocado. Só mude se tiver certeza.
            </span>
          </label>
          <div className="space-y-1.5">
            <span className="block text-[12px] font-medium text-muted-foreground">Logo</span>
            <div className="flex items-center gap-3">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-hover">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="size-full object-cover" />
                ) : (
                  <Store className="size-5 text-muted-foreground" />
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-[12px]"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-3.5" /> Trocar logo
              </Button>
              {logoDataUrl && (
                <button
                  type="button"
                  className="text-[12px] text-muted-foreground hover:underline"
                  onClick={() => {
                    setLogoDataUrl(null);
                    setLogoPreview(initial.logo);
                  }}
                >
                  Desfazer
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void pickLogo(file);
                }}
              />
            </div>
            <span className="block text-[11.5px] text-muted-foreground/80">
              Imagem quadrada, PNG, JPG ou WEBP, até 2 MB.
            </span>
          </div>
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
              Descrição da loja <span className="font-normal">{description.length}/500</span>
            </span>
            <Textarea
              value={description}
              maxLength={500}
              rows={6}
              onChange={(e) => setDescription(e.target.value)}
              className="text-[13px]"
            />
          </label>
          <Button className="gap-1.5" disabled={!changed || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar na Shopee
          </Button>
        </div>

        {/* Prévia: como o cabeçalho da loja aparece pro comprador. */}
        <div>
          <p className="mb-2 text-[11.5px] text-muted-foreground">Prévia do cabeçalho da loja</p>
          <div className="overflow-hidden rounded-xl border border-border bg-white text-[#222]">
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#f53d2d] to-[#ff6633] p-4 text-white">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-white/20">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="size-full object-cover" />
                ) : (
                  <Store className="size-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{name || "Nome da loja"}</p>
                <p className="text-[11.5px] opacity-85">Loja na Shopee</p>
              </div>
            </div>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap p-4 text-[12.5px] leading-relaxed text-[#555]">
              {description || "A descrição da loja aparece aqui."}
            </p>
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Ilustração aproximada. Banner, cores e a decoração da vitrine só são editados no Seller
            Center da Shopee — a API não libera.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shopee: categorias da loja
// ---------------------------------------------------------------------------

function ShopeeCategories({
  initial,
  listings,
}: {
  initial: ShopCategory[];
  listings: EditableListing[];
}) {
  const runSave = useServerFn(saveShopeeShopCategory);
  const runDelete = useServerFn(deleteShopeeShopCategory);
  const runItems = useServerFn(getShopeeShopCategoryItems);
  const runChange = useServerFn(changeShopeeShopCategoryItems);

  const [categories, setCategories] = useState(initial);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [itemIds, setItemIds] = useState<Set<string>>(new Set());
  const [itemsLoading, setItemsLoading] = useState(false);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const byExternal = useMemo(() => new Map(listings.map((l) => [l.externalId, l])), [listings]);
  const inCategory = useMemo(
    () => [...itemIds].map((id) => byExternal.get(id)).filter(Boolean) as EditableListing[],
    [itemIds, byExternal],
  );
  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return listings
      .filter((l) => !itemIds.has(l.externalId) && (!term || l.title.toLowerCase().includes(term)))
      .slice(0, 20);
  }, [listings, itemIds, search]);

  async function open(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setSearch("");
    setItemIds(new Set());
    setItemsLoading(true);
    try {
      setItemIds(new Set(await runItems({ data: { id } })));
    } catch (err) {
      toast.error(message(err, "Não deu pra carregar os produtos."));
    } finally {
      setItemsLoading(false);
    }
  }

  async function create() {
    const name = newName.trim();
    if (name.length < 2) return;
    setBusy("create");
    try {
      const created = await runSave({ data: { name } });
      setCategories((list) => [...list, { id: created.id, name: created.name, active: false }]);
      setNewName("");
      toast.success("Categoria criada na Shopee", {
        description: "Ela aparece na loja depois que tiver produtos.",
      });
    } catch (err) {
      toast.error(message(err, "Não deu pra criar a categoria."));
    } finally {
      setBusy(null);
    }
  }

  async function rename() {
    if (!renaming) return;
    setBusy(`rename-${renaming.id}`);
    try {
      const saved = await runSave({ data: { id: renaming.id, name: renaming.name } });
      setCategories((list) => list.map((c) => (c.id === saved.id ? { ...c, name: saved.name } : c)));
      setRenaming(null);
      toast.success("Categoria renomeada na Shopee");
    } catch (err) {
      toast.error(message(err, "Não deu pra renomear."));
    } finally {
      setBusy(null);
    }
  }

  async function remove(category: ShopCategory) {
    if (
      !window.confirm(
        `Apagar a categoria “${category.name}” da sua loja na Shopee?\n\nOs produtos continuam à venda, só saem dessa categoria. Não dá pra desfazer.`,
      )
    ) {
      return;
    }
    setBusy(`delete-${category.id}`);
    try {
      await runDelete({ data: { id: category.id } });
      setCategories((list) => list.filter((c) => c.id !== category.id));
      if (openId === category.id) setOpenId(null);
      toast.success("Categoria apagada na Shopee");
    } catch (err) {
      toast.error(message(err, "Não deu pra apagar."));
    } finally {
      setBusy(null);
    }
  }

  async function change(listing: EditableListing, action: "add" | "remove") {
    if (!openId) return;
    setBusy(`item-${listing.id}`);
    try {
      await runChange({ data: { id: openId, listingIds: [listing.id], action } });
      setItemIds((current) => {
        const next = new Set(current);
        if (action === "add") next.add(listing.externalId);
        else next.delete(listing.externalId);
        return next;
      });
    } catch (err) {
      toast.error(message(err, "A Shopee não aceitou."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      title="Categorias da loja"
      hint="São as abas que organizam os produtos dentro da sua loja na Shopee. Cada mudança aqui vai direto pra lá."
    >
      <div className="space-y-2">
        {categories.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground">Sua loja ainda não tem categorias.</p>
        )}
        {categories.map((category) => {
          const isOpen = openId === category.id;
          const isRenaming = renaming?.id === category.id;
          return (
            <div key={category.id} className="rounded-lg border border-border">
              <div className="flex items-center gap-2 p-2.5">
                {isRenaming ? (
                  <form
                    className="flex flex-1 gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename();
                    }}
                  >
                    <Input
                      autoFocus
                      value={renaming.name}
                      maxLength={40}
                      onChange={(e) => setRenaming({ id: category.id, name: e.target.value })}
                      className="h-8 text-[12.5px]"
                    />
                    <Button type="submit" size="sm" className="h-8" disabled={busy === `rename-${category.id}`}>
                      Salvar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => setRenaming(null)}>
                      <X className="size-3.5" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void open(category.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <ChevronDown
                        className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                      />
                      <span className="truncate text-[13px] font-medium text-foreground">{category.name}</span>
                      {!category.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">
                          Não visível na loja
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="Renomear"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setRenaming({ id: category.id, name: category.name })}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Apagar"
                      disabled={busy === `delete-${category.id}`}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => void remove(category)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>

              {isOpen && (
                <div className="grid gap-4 border-t border-border p-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[12px] font-medium text-foreground">
                      Na categoria ({itemsLoading ? "…" : itemIds.size})
                    </p>
                    {itemsLoading ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {inCategory.map((l) => (
                          <li key={l.id} className="flex items-center gap-2 rounded-md p-1">
                            <div className="size-8 shrink-0 overflow-hidden rounded bg-surface-hover">
                              {l.image && <img src={l.image} alt="" loading="lazy" className="size-full object-cover" />}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{l.title}</span>
                            <button
                              type="button"
                              aria-label="Tirar da categoria"
                              disabled={busy === `item-${l.id}`}
                              className="p-1 text-muted-foreground hover:text-destructive"
                              onClick={() => void change(l, "remove")}
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        ))}
                        {itemIds.size === 0 && (
                          <li className="text-[12px] text-muted-foreground">Nenhum produto ainda.</li>
                        )}
                        {itemIds.size > inCategory.length && (
                          <li className="text-[11.5px] text-muted-foreground">
                            + {itemIds.size - inCategory.length} produto(s) que não estão em Meus anúncios.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-1.5 text-[12px] font-medium text-foreground">Adicionar produto</p>
                    <Input
                      value={search}
                      placeholder="Buscar nos seus anúncios…"
                      onChange={(e) => setSearch(e.target.value)}
                      className="mb-1.5 h-8 text-[12.5px]"
                    />
                    <ul className="max-h-56 space-y-1 overflow-y-auto">
                      {candidates.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            disabled={busy === `item-${l.id}` || itemsLoading}
                            onClick={() => void change(l, "add")}
                            className="flex w-full items-center gap-2 rounded-md p-1 text-left hover:bg-surface-hover disabled:opacity-50"
                          >
                            <div className="size-8 shrink-0 overflow-hidden rounded bg-surface-hover">
                              {l.image && <img src={l.image} alt="" loading="lazy" className="size-full object-cover" />}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{l.title}</span>
                            <Plus className="size-3.5 shrink-0 text-brand" />
                          </button>
                        </li>
                      ))}
                      {candidates.length === 0 && (
                        <li className="text-[12px] text-muted-foreground">Nada encontrado.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <form
          className="flex max-w-md gap-1.5 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Input
            value={newName}
            maxLength={40}
            placeholder="Nova categoria (ex.: Cozinha)"
            onChange={(e) => setNewName(e.target.value)}
            className="h-9 text-[13px]"
          />
          <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={busy === "create" || newName.trim().length < 2}>
            {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Criar na Shopee
          </Button>
        </form>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shopee: "Organizar minha loja" — cria as categorias e distribui os produtos
// ---------------------------------------------------------------------------

type GroupState = "pending" | "running" | "ok" | "error";

function OrganizeStore({ onDone }: { onDone: () => void }) {
  const runPlan = useServerFn(planShopOrganization);
  const runApply = useServerFn(applyShopCategoryGroup);
  const runClassify = useServerFn(classifyShopeeListings);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const [phase, setPhase] = useState<"idle" | "planning" | "preview" | "running" | "done">("idle");
  const [groups, setGroups] = useState<OrganizationGroup[]>([]);
  const [info, setInfo] = useState({ total: 0, skipped: 0 });
  const [off, setOff] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Record<string, GroupState>>({});
  const [organized, setOrganized] = useState(0);

  const chosen = groups.filter((g) => !off.has(g.name));
  const chosenProducts = chosen.reduce((sum, g) => sum + g.externalIds.length, 0);

  async function plan() {
    setPhase("planning");
    setProgress({ done: 0, total: 0 });
    try {
      const base = await runPlan();
      const items = [...base.items];
      let skipped = 0;
      setProgress({ done: base.items.length, total: base.total });
      // O que ainda não tem categoria guardada é classificado em lotes
      // (sugestão oficial da Shopee pro título), mostrando o progresso.
      let next = 0;
      const worker = async () => {
        while (next < base.pending.length) {
          const chunk = base.pending.slice(next, next + 24);
          next += 24;
          try {
            const classified = await runClassify({ data: { externalIds: chunk } });
            for (const row of classified) {
              if (row.path) items.push({ externalId: row.externalId, path: row.path });
              else skipped += 1;
            }
            skipped += chunk.length - classified.length;
          } catch {
            skipped += chunk.length;
          }
          setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + chunk.length) }));
        }
      };
      await Promise.all([worker(), worker()]);

      const result = { groups: buildGroups(items), total: base.total, skipped };
      if (result.groups.length === 0) {
        toast.error("Não achei a categoria dos seus anúncios pra montar a organização.");
        setPhase("idle");
        return;
      }
      setGroups(result.groups);
      setInfo({ total: result.total, skipped: result.skipped });
      setOff(new Set());
      setStates({});
      setPhase("preview");
    } catch (err) {
      toast.error(message(err, "Não deu pra analisar a loja agora."));
      setPhase("idle");
    }
  }

  async function apply() {
    if (
      !window.confirm(
        `Organizar a sua loja na Shopee?\n\nVou criar ${chosen.length} categoria(s) e colocar ${chosenProducts} produto(s) nelas. Os anúncios não mudam — só passam a aparecer organizados na sua loja.`,
      )
    ) {
      return;
    }
    setPhase("running");
    setStates(Object.fromEntries(chosen.map((g) => [g.name, "pending" as GroupState])));
    let total = 0;
    for (const group of chosen) {
      setStates((s) => ({ ...s, [group.name]: "running" }));
      try {
        const result = await runApply({ data: { name: group.name, externalIds: group.externalIds } });
        total += result.added;
        setOrganized(total);
        setStates((s) => ({ ...s, [group.name]: "ok" }));
      } catch (err) {
        console.error("[minha-loja] categoria falhou:", err);
        setStates((s) => ({ ...s, [group.name]: "error" }));
      }
    }
    setPhase("done");
    onDone();
  }

  const failed = Object.values(states).filter((s) => s === "error").length;

  return (
    <section className="surface-card overflow-hidden border-brand/30">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-brand/10 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Wand2 className="size-4 text-brand" /> Organizar minha loja
          </h2>
          <p className="mt-1 max-w-2xl text-[12.5px] text-muted-foreground">
            O Shoppfy olha a categoria de cada anúncio, cria as categorias da sua loja na Shopee e
            coloca cada produto no lugar certo. Você vê a proposta antes de qualquer coisa mudar.
          </p>
        </div>
        {(phase === "idle" || phase === "planning") && (
          <Button className="shrink-0 gap-1.5" disabled={phase === "planning"} onClick={() => void plan()}>
            {phase === "planning" ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            {phase === "planning"
              ? progress.total > 0
                ? `Analisando ${progress.done} de ${progress.total} anúncios…`
                : "Analisando seus anúncios…"
              : "Montar a organização"}
          </Button>
        )}
      </div>

      {phase !== "idle" && phase !== "planning" && (
        <div className="space-y-4 border-t border-border p-5">
          {phase === "preview" && (
            <p className="text-[12.5px] text-muted-foreground">
              Proposta pra {info.total} anúncios ativos
              {info.skipped > 0 ? ` (${info.skipped} ficaram de fora porque a Shopee não sugeriu categoria)` : ""}.
              Desmarque o que não quiser criar.
            </p>
          )}
          {phase === "done" && (
            <p className={cn("text-[13.5px] font-medium", failed ? "text-warning" : "text-success")}>
              {failed
                ? `Terminou com ${failed} categoria(s) que a Shopee não aceitou. ${organized} produto(s) organizados.`
                : `Loja organizada: ${chosen.length} categoria(s) e ${organized} produto(s) no lugar. 🎉`}
            </p>
          )}

          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(phase === "preview" ? groups : chosen).map((group, index) => {
              const state = states[group.name];
              const disabled = off.has(group.name);
              return (
                <li
                  key={group.name}
                  className={cn(
                    "org-item flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                    state === "ok"
                      ? "border-success/40 bg-success/10"
                      : state === "error"
                        ? "border-destructive/40 bg-destructive/10"
                        : state === "running"
                          ? "border-brand/50 bg-brand/10"
                          : "border-border",
                    disabled && "opacity-45",
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {phase === "preview" ? (
                    <input
                      type="checkbox"
                      checked={!disabled}
                      onChange={() =>
                        setOff((current) => {
                          const next = new Set(current);
                          if (next.has(group.name)) next.delete(group.name);
                          else next.add(group.name);
                          return next;
                        })
                      }
                      className="size-4 shrink-0 cursor-pointer accent-brand"
                      aria-label={`Criar a categoria ${group.name}`}
                    />
                  ) : state === "running" ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-brand" />
                  ) : state === "ok" ? (
                    <Check className="size-4 shrink-0 text-success" />
                  ) : state === "error" ? (
                    <X className="size-4 shrink-0 text-destructive" />
                  ) : (
                    <span className="size-4 shrink-0 rounded-full border border-border" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {group.name}
                  </span>
                  <span className="shrink-0 text-[12px] text-muted-foreground">
                    {group.externalIds.length}
                  </span>
                </li>
              );
            })}
          </ul>

          {phase === "preview" && (
            <div className="flex flex-wrap gap-2">
              <Button className="gap-1.5" disabled={chosen.length === 0} onClick={() => void apply()}>
                <Wand2 className="size-3.5" />
                Criar {chosen.length} categoria(s) na Shopee
              </Button>
              <Button variant="outline" onClick={() => setPhase("idle")}>
                Cancelar
              </Button>
            </div>
          )}
          {phase === "running" && (
            <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Organizando na Shopee… não feche esta tela.
              {organized > 0 ? ` ${organized} produto(s) já no lugar.` : ""}
            </p>
          )}
          {phase === "done" && (
            <Button variant="outline" size="sm" onClick={() => setPhase("idle")}>
              Fechar
            </Button>
          )}
        </div>
      )}
      <style>{`.org-item{animation:org-in .35s ease-out both}@keyframes org-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.org-item{animation:none}}`}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Anúncios: título e descrição (Shopee e Mercado Livre)
// ---------------------------------------------------------------------------

function ListingsEditor({ channel, listings }: { channel: Channel; listings: EditableListing[] }) {
  const runContent = useServerFn(getListingContent);
  const runUpdate = useServerFn(updateListingContent);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EditableListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState<{ title: string; description: string; titleLimit: number } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return listings.filter((l) => !term || (titles[l.id] ?? l.title).toLowerCase().includes(term)).slice(0, 40);
  }, [listings, search, titles]);

  async function pick(listing: EditableListing) {
    setSelected(listing);
    setOriginal(null);
    setLoading(true);
    try {
      const content = await runContent({ data: { listingId: listing.id } });
      setOriginal(content);
      setTitle(content.title);
      setDescription(content.description);
    } catch (err) {
      toast.error(message(err, "Não deu pra carregar o anúncio."));
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  const titleChanged = original ? title.trim() !== original.title.trim() : false;
  const descriptionChanged = original ? description.trim() !== original.description.trim() : false;

  async function save() {
    if (!selected || !original) return;
    setSaving(true);
    try {
      await runUpdate({
        data: {
          listingId: selected.id,
          ...(titleChanged ? { title: title.trim() } : {}),
          ...(descriptionChanged ? { description: description.trim() } : {}),
        },
      });
      setOriginal({ ...original, title: title.trim(), description: description.trim() });
      if (titleChanged) setTitles((t) => ({ ...t, [selected.id]: title.trim() }));
      toast.success(`Anúncio atualizado ${NA[channel]}`);
    } catch (err) {
      toast.error("Não deu pra salvar", { description: message(err, "Tente de novo.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Anúncios"
      hint={`Troque o título e a descrição dos seus anúncios ${NA[channel]}. Ao salvar, muda no anúncio de verdade. Preço e pausa ficam em Meus anúncios.`}
    >
      {listings.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          Nenhum anúncio por aqui ainda. Publique em Criar Anúncio ou sincronize em Meus anúncios.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <Input
              value={search}
              placeholder={`Buscar nos ${listings.length} anúncios…`}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 h-9 text-[13px]"
            />
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => void pick(l)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border p-1.5 text-left transition-colors",
                      selected?.id === l.id ? "border-brand bg-brand/10" : "border-transparent hover:bg-surface-hover",
                    )}
                  >
                    <div className="size-10 shrink-0 overflow-hidden rounded-md bg-surface-hover">
                      {l.image && <img src={l.image} alt="" loading="lazy" className="size-full object-cover" />}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[12px] leading-snug text-foreground">
                        {titles[l.id] ?? l.title}
                      </span>
                      {l.status !== "active" && (
                        <span className="text-[11px] text-muted-foreground">Pausado</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="text-[12px] text-muted-foreground">Nada encontrado.</li>}
            </ul>
          </div>

          <div>
            {!selected ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-[13px] text-muted-foreground">
                Escolha um anúncio na lista pra editar.
              </p>
            ) : loading || !original ? (
              <div className="flex justify-center py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
                    Título <span className="font-normal">{title.length}/{original.titleLimit}</span>
                  </span>
                  <Input
                    value={title}
                    maxLength={original.titleLimit}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9 text-[13px]"
                  />
                  {channel === "mercado-livre" && (
                    <span className="block text-[11.5px] text-muted-foreground/80">
                      O Mercado Livre não deixa trocar o título de anúncio que já teve venda.
                    </span>
                  )}
                </label>
                <label className="block space-y-1.5">
                  <span className="block text-[12px] font-medium text-muted-foreground">Descrição</span>
                  <Textarea
                    value={description}
                    rows={12}
                    maxLength={channel === "shopee" ? 3000 : 20000}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-[13px]"
                  />
                </label>
                <Button
                  className="gap-1.5"
                  disabled={saving || (!titleChanged && !descriptionChanged)}
                  onClick={() => void save()}
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Salvar {NA[channel]}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

type Overview = Awaited<ReturnType<typeof getMarketplaceStore>>;

export function MarketplaceStore() {
  const runGet = useServerFn(getMarketplaceStore);
  const runListings = useServerFn(listEditableListings);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>("shopee");
  const [listings, setListings] = useState<Record<Channel, EditableListing[] | null>>({
    shopee: null,
    "mercado-livre": null,
  });

  useEffect(() => {
    let cancelled = false;
    runGet()
      .then((res) => {
        if (cancelled) return;
        setOverview(res);
        if (!res.shopeeConnected && res.mercadoLivreConnected) setChannel("mercado-livre");
      })
      .catch((err) => !cancelled && setError(message(err, "Não deu pra carregar.")));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = overview
    ? channel === "shopee"
      ? overview.shopeeConnected
      : overview.mercadoLivreConnected
    : false;

  const loadListings = useCallback(
    (target: Channel) => {
      runListings({ data: { marketplace: target } })
        .then((rows) => setListings((current) => ({ ...current, [target]: rows })))
        .catch(() => setListings((current) => ({ ...current, [target]: [] })));
    },
    [runListings],
  );
  useEffect(() => {
    if (connected && listings[channel] === null) loadListings(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, channel]);

  if (error) {
    return (
      <p className="surface-card px-4 py-10 text-center text-[13px] text-muted-foreground">
        {error} Recarregue a página pra tentar de novo.
      </p>
    );
  }
  if (!overview) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const current = listings[channel];

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-border p-0.5">
        {(["shopee", "mercado-livre"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              channel === c ? "bg-brand/15 text-brand" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <img
              src={c === "shopee" ? "/logo-shopee.png" : "/logo-mercadolivre.png"}
              alt=""
              className="size-4 rounded-sm object-contain"
            />
            {NAME[c]}
          </button>
        ))}
      </div>

      {!connected ? (
        <div className="surface-card flex flex-col items-start gap-3 p-5">
          <p className="text-[13.5px] text-foreground">
            Conecte a sua loja {NA[channel]} pra editar por aqui.
          </p>
          <Button asChild size="sm">
            <Link to="/integracoes">Ir pra Integrações</Link>
          </Button>
        </div>
      ) : (
        <>
          {channel === "shopee" &&
            (overview.shopee ? (
              <>
                <ShopeeProfile
                  key={`${overview.shopee.name}|${overview.shopee.logo}`}
                  initial={overview.shopee}
                  onSaved={(next) =>
                    setOverview((o) => (o && o.shopee ? { ...o, shopee: { ...o.shopee, ...next } } : o))
                  }
                />
                <OrganizeStore
                  onDone={() => {
                    runGet()
                      .then(setOverview)
                      .catch(() => undefined);
                  }}
                />
                <ShopeeCategories
                  key={overview.shopee.categories.map((c) => `${c.id}:${c.active}`).join(",")}
                  initial={overview.shopee.categories}
                  listings={current ?? []}
                />
              </>
            ) : (
              <p className="surface-card px-4 py-8 text-center text-[13px] text-muted-foreground">
                {overview.shopeeError ?? "Não deu pra carregar a loja da Shopee agora."}
              </p>
            ))}

          {channel === "mercado-livre" && (
            <div className="surface-card p-5 text-[12.5px] text-muted-foreground">
              <p className="text-[13.5px] font-medium text-foreground">
                No Mercado Livre só dá pra editar os anúncios.
              </p>
              <p className="mt-1 max-w-2xl">
                A página do vendedor no Mercado Livre (nome, logo, banner) não pode ser alterada por
                aplicativos — o Mercado Livre não oferece isso na API. O que muda a cara da sua loja lá
                são os títulos, as descrições e as fotos dos anúncios.
              </p>
            </div>
          )}

          {current === null ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <ListingsEditor key={channel} channel={channel} listings={current} />
          )}
        </>
      )}
    </div>
  );
}

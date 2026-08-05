import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Check,
  CreditCard,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  Monitor,
  Send,
  ShieldCheck,
  Undo2,
  User,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials, useProfileStore } from "@/stores/profile-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/translations";
import { useLocaleStore } from "@/stores/locale-store";
import { useAuthStore } from "@/stores/auth-store";
import { updateProfileFullName } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_shell/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · Shoppfy" },
      {
        name: "description",
        content: "Conta, plano, segurança e preferências do sistema.",
      },
      { property: "og:title", content: "Configurações · Shoppfy" },
      {
        property: "og:description",
        content: "Conta, plano, segurança e preferências do sistema.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

const SETTINGS_TABS = [
  { id: "perfil", label: "Perfil e conta", icon: User },
  { id: "plano", label: "Plano e cobrança", icon: CreditCard },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "regional", label: "Regional", icon: Globe },
  { id: "reembolso", label: "Reembolso", icon: Undo2 },
] as const;

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal className="surface-card space-y-4 p-5">
      <div>
        <p className="text-[14px] font-medium text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Reveal>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <div>
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function PerfilTab() {
  const t = useT();
  const navigate = useNavigate();
  const name = useProfileStore((s) => s.name);
  const setName = useProfileStore((s) => s.setName);
  const userId = useAuthStore((s) => s.session?.user.id);
  const email = useAuthStore((s) => s.profile?.email ?? s.session?.user.email ?? "");
  const setProfile = useAuthStore((s) => s.setProfile);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { data, error } = await updateProfileFullName(userId, draft);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar agora", { description: error.message });
      return;
    }
    setName(draft);
    if (data) setProfile(data);
    toast.success(t("Perfil atualizado"));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="space-y-5">
      <SettingsCard
        title={t("Identidade")}
        description={t("Como seu nome aparece dentro do Shopfy.")}
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-14 border border-border">
            <AvatarFallback className="bg-surface-hover text-[15px] font-medium text-foreground">
              {getInitials(draft)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Label htmlFor="settings-name">{t("Nome")}</Label>
            <Input
              id="settings-name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("Como quer ser chamado?")}
              className="max-w-sm"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-email">{t("E-mail")}</Label>
          <div className="flex max-w-sm items-center gap-2 rounded-md border border-input bg-surface-hover px-3 py-2 text-[13px] text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            {email || "—"}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || draft === name} className="gap-2">
          <Check className="size-4" />
          {t("Salvar alterações")}
        </Button>
      </SettingsCard>

      <SettingsCard title={t("Sessão")}>
        <Button variant="outline" onClick={handleLogout} className="w-fit gap-2">
          <LogOut className="size-4" />
          {t("Sair da conta")}
        </Button>
      </SettingsCard>
    </div>
  );
}

function PlanoTab() {
  const t = useT();
  return (
    <div className="space-y-5">
      <SettingsCard title={t("Seu plano")}>
        <div className="flex flex-col justify-between gap-4 rounded-lg border border-brand/30 bg-brand/5 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[13.5px] font-semibold text-foreground">{t("Plano Pro")}</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {t("R$ 49,00/mês · próxima cobrança em 5 de setembro")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => toast.info(t("Planos disponíveis em breve nesta tela"))}
          >
            {t("Trocar plano")}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t("Cobrança")}
        description={t("Forma de pagamento e histórico de faturas.")}
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2.5 text-[13px] text-foreground">
            <CreditCard className="size-4 text-muted-foreground" />
            {t("Cartão terminado em 4242")}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.info(t("Atualização de cartão em breve nesta tela"))}
          >
            {t("Atualizar")}
          </Button>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => toast.info(t("Nenhuma fatura anterior ainda"))}
        >
          {t("Ver faturas")}
        </Button>
      </SettingsCard>
    </div>
  );
}

function SegurancaTab() {
  const t = useT();
  const [twoFactor, setTwoFactor] = useState(false);

  return (
    <div className="space-y-5">
      <SettingsCard title={t("Senha")}>
        <Button
          variant="outline"
          className="w-fit gap-2"
          onClick={() =>
            toast.success(t("Link de redefinição enviado"), {
              description: t("Confira sua caixa de entrada em conta@shoppfy.com"),
            })
          }
        >
          <KeyRound className="size-4" />
          {t("Alterar senha")}
        </Button>
      </SettingsCard>

      <SettingsCard
        title={t("Verificação em duas etapas")}
        description={t("Peça um código extra por e-mail sempre que entrar de um aparelho novo.")}
      >
        <ToggleRow
          label={t("Ativar verificação em duas etapas")}
          description={t(twoFactor ? "Ativada — protegendo sua conta" : "Desativada")}
          checked={twoFactor}
          onCheckedChange={(value) => {
            setTwoFactor(value);
            toast.success(
              t(value ? "Verificação em duas etapas ativada" : "Verificação desativada"),
            );
          }}
        />
      </SettingsCard>

      <SettingsCard
        title={t("Sessões ativas")}
        description={t("Aparelhos conectados à sua conta agora.")}
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2.5 text-[13px] text-foreground">
            <Monitor className="size-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{t("Este aparelho")}</p>
              <p className="text-[11.5px] text-muted-foreground">{t("Chrome · sessão atual")}</p>
            </div>
          </div>
          <span className="text-[11.5px] font-medium text-success">{t("Ativa")}</span>
        </div>
      </SettingsCard>
    </div>
  );
}

function NotificacoesTab() {
  const t = useT();
  const [prefs, setPrefs] = useState({
    vendas: true,
    precos: true,
    novidades: false,
    resumo: true,
  });

  const update = (key: keyof typeof prefs, value: boolean, label: string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    toast.success(`${t(label)} ${t(value ? "ativado" : "desativado")}`);
  };

  return (
    <SettingsCard
      title={t("Notificações por e-mail")}
      description={t("Escolha o que você quer receber.")}
    >
      <div className="space-y-2.5">
        <ToggleRow
          label={t("Novas vendas atribuídas")}
          description={t("Avise sempre que um dos seus links gerar uma venda")}
          checked={prefs.vendas}
          onCheckedChange={(v) => update("vendas", v, "Alerta de vendas")}
        />
        <ToggleRow
          label={t("Queda de preço")}
          description={t("Avise quando um produto favoritado ficar mais barato")}
          checked={prefs.precos}
          onCheckedChange={(v) => update("precos", v, "Alerta de preço")}
        />
        <ToggleRow
          label={t("Novidades do produto")}
          description={t("Lançamentos de recursos e melhorias do Shopfy")}
          checked={prefs.novidades}
          onCheckedChange={(v) => update("novidades", v, "Novidades")}
        />
        <ToggleRow
          label={t("Resumo semanal")}
          description={t("Um e-mail toda segunda com o desempenho da semana")}
          checked={prefs.resumo}
          onCheckedChange={(v) => update("resumo", v, "Resumo semanal")}
        />
      </div>
    </SettingsCard>
  );
}

function RegionalTab() {
  const t = useT();
  const [currency, setCurrency] = useState("BRL");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <SettingsCard
      title={t("Preferências regionais")}
      description={t("Moeda, idioma e fuso horário usados na plataforma.")}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>{t("Moeda")}</Label>
          <Select
            value={currency}
            onValueChange={(v) => {
              setCurrency(v);
              toast.success(t("Moeda atualizada"));
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">{t("Real (R$)")}</SelectItem>
              <SelectItem value="USD">{t("Dólar (US$)")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("Idioma")}</Label>
          <Select
            value={locale === "en" ? "en-US" : "pt-BR"}
            onValueChange={(v) => {
              setLocale(v === "en-US" ? "en" : "pt");
              toast.success(v === "en-US" ? "Language updated" : "Idioma atualizado");
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">{t("Português (Brasil)")}</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("Fuso horário")}</Label>
          <Select
            value={timezone}
            onValueChange={(v) => {
              setTimezone(v);
              toast.success(t("Fuso horário atualizado"));
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Sao_Paulo">{t("Brasília (GMT-3)")}</SelectItem>
              <SelectItem value="America/Manaus">{t("Manaus (GMT-4)")}</SelectItem>
              <SelectItem value="America/Noronha">{t("Fernando de Noronha (GMT-2)")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </SettingsCard>
  );
}

const REFUND_REASONS = [
  { value: "nao-uso", label: "Não estou usando o sistema" },
  { value: "expectativa", label: "Não atendeu o que eu esperava" },
  { value: "alternativa", label: "Encontrei uma alternativa melhor" },
  { value: "tecnico", label: "Tive problemas técnicos" },
  { value: "outro", label: "Outro motivo" },
];

const BILLING_PLANS = [
  { value: "pro-mensal", label: "Pro — Mensal (R$ 49,00/mês)" },
  { value: "pro-anual", label: "Pro — Anual (R$ 470,00/ano)" },
];

type RefundForm = {
  nome: string;
  cpf: string;
  email: string;
  codigoCompra: string;
  plano: string;
  diasPagamento: string;
  motivo: string;
};

const EMPTY_REFUND_FORM: RefundForm = {
  nome: "",
  cpf: "",
  email: "",
  codigoCompra: "",
  plano: "",
  diasPagamento: "",
  motivo: "",
};

function ReembolsoTab() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const [form, setForm] = useState<RefundForm>(EMPTY_REFUND_FORM);
  const [status, setStatus] = useState<"idle" | "sent">("idle");

  const update = (field: keyof RefundForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const dias = Number(form.diasPagamento);
  const diasValidos = form.diasPagamento.trim() !== "" && !Number.isNaN(dias) && dias >= 0;
  const dentroDoPrazo = diasValidos && dias < 7;

  const isValid =
    form.nome.trim() !== "" &&
    form.cpf.trim() !== "" &&
    form.email.trim() !== "" &&
    form.codigoCompra.trim() !== "" &&
    form.plano !== "" &&
    diasValidos &&
    form.motivo !== "";

  const handleSubmit = () => {
    if (!isValid) return;
    setStatus("sent");
    toast.success(t("Pedido de reembolso enviado"));
  };

  if (status === "sent") {
    return (
      <SettingsCard title={t("Pedido de reembolso")}>
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
          <Check className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="text-[13.5px] font-medium text-foreground">
              {t("Recebemos seu pedido de reembolso")}
            </p>
            {dentroDoPrazo ? (
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {locale === "en" ? (
                  <>
                    Since the payment was made less than 7 days ago, you have the right of
                    withdrawal guaranteed by the Brazilian consumer code (art. 49). The amount will
                    be refunded within up to 7 business days, to the same payment method used in the
                    purchase. You'll get a confirmation at conta@shoppfy.com once it's processed.
                  </>
                ) : (
                  <>
                    Como o pagamento foi feito há menos de 7 dias, você tem direito de
                    arrependimento garantido pelo Código de Defesa do Consumidor (art. 49). O valor
                    será estornado em até 7 dias úteis, na mesma forma de pagamento usada na compra.
                    Você recebe uma confirmação em conta@shoppfy.com assim que for processado.
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {locale === "en" ? (
                  <>
                    By law (Brazilian consumer code, art. 49), the right of withdrawal with full
                    refund applies for up to 7 days after payment. Since {form.diasPagamento} days
                    have already passed, that window has closed, so the amount will not be refunded.
                    If you believe there was a billing error or technical issue, reply to the
                    confirmation email we sent to conta@shoppfy.com so we can review your case.
                  </>
                ) : (
                  <>
                    Pela lei (CDC, art. 49), o direito de arrependimento com reembolso integral vale
                    até 7 dias após o pagamento. Como já se passaram {form.diasPagamento} dias, esse
                    prazo já encerrou e, por isso, o valor não será estornado. Se você acredita que
                    houve um erro de cobrança ou problema técnico, responda o e-mail de confirmação
                    que enviamos pra conta@shoppfy.com pra revisarmos o caso.
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setForm(EMPTY_REFUND_FORM);
            setStatus("idle");
          }}
        >
          {t("Enviar outro pedido")}
        </Button>
      </SettingsCard>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        title={t("Solicitar reembolso")}
        description={t(
          "Sentiu que o Shopfy não é pra você? Preencha os dados abaixo pra pedir seu reembolso.",
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="refund-nome">{t("Nome completo")}</Label>
            <Input
              id="refund-nome"
              value={form.nome}
              onChange={(e) => update("nome")(e.target.value)}
              placeholder={t("Seu nome completo")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-cpf">{t("CPF")}</Label>
            <Input
              id="refund-cpf"
              value={form.cpf}
              onChange={(e) => update("cpf")(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-email">{t("E-mail")}</Label>
            <Input
              id="refund-email"
              type="email"
              value={form.email}
              onChange={(e) => update("email")(e.target.value)}
              placeholder={t("voce@exemplo.com")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-codigo">{t("Código da compra")}</Label>
            <Input
              id="refund-codigo"
              value={form.codigoCompra}
              onChange={(e) => update("codigoCompra")(e.target.value)}
              placeholder={t("Ex: PED-48213")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Plano da cobrança")}</Label>
            <Select value={form.plano} onValueChange={update("plano")}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={t("Selecione o plano")} />
              </SelectTrigger>
              <SelectContent>
                {BILLING_PLANS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {t(p.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-dias">{t("Há quantos dias você pagou?")}</Label>
            <Input
              id="refund-dias"
              type="number"
              min={0}
              value={form.diasPagamento}
              onChange={(e) => update("diasPagamento")(e.target.value)}
              placeholder={t("Ex: 3")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("Por que você quer reembolso?")}</Label>
          <Select value={form.motivo} onValueChange={update("motivo")}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder={t("Selecione um motivo")} />
            </SelectTrigger>
            <SelectContent>
              {REFUND_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSubmit} disabled={!isValid} className="gap-2">
          <Send className="size-4" />
          {t("Solicitar reembolso")}
        </Button>
      </SettingsCard>

      <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-card/40 px-4 py-3.5 text-[12px] leading-relaxed text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <p>
          {t(
            "Por lei (CDC, art. 49), compras feitas online têm direito a arrependimento e reembolso integral em até 7 dias do pagamento. Pagamentos com menos de 7 dias são estornados em até 7 dias úteis na forma de pagamento original; após esse prazo, o valor não é estornado — vale revisar o texto exato com um advogado antes de publicar.",
          )}
        </p>
      </div>
    </div>
  );
}

function ConfiguracoesPage() {
  const t = useT();
  const [tab, setTab] = useState<string>(SETTINGS_TABS[0].id);

  return (
    <div className="space-y-7">
      <PageHeader
        title={t("Configurações")}
        description={t("Conta, plano, segurança e preferências do sistema.")}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className={cn(
                "gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px]",
                "data-[state=active]:border-transparent data-[state=active]:bg-surface-hover data-[state=active]:shadow-none",
              )}
            >
              <Icon className="size-3.5" />
              {t(label)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="perfil" className="mt-5">
          <PerfilTab />
        </TabsContent>
        <TabsContent value="plano" className="mt-5">
          <PlanoTab />
        </TabsContent>
        <TabsContent value="seguranca" className="mt-5">
          <SegurancaTab />
        </TabsContent>
        <TabsContent value="notificacoes" className="mt-5">
          <NotificacoesTab />
        </TabsContent>
        <TabsContent value="regional" className="mt-5">
          <RegionalTab />
        </TabsContent>
        <TabsContent value="reembolso" className="mt-5">
          <ReembolsoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

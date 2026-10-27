import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Check,
  CreditCard,
  Globe,
  KeyRound,
  Loader2,
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
import { updateProfileFullName, updateProfilePlan } from "@/lib/profile";
import { createRefundRequest } from "@/lib/refund.functions";
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
  const onboardingDone = useAuthStore((s) => s.profile?.onboarding_done ?? false);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!userId) return;
    // Se esse ainda não tinha completado o onboarding, esse save É o passo
    // que libera o resto do app (updateProfileFullName marca onboarding_done).
    // Não existe mais gate de "cadastrar como afiliado" travando o app —
    // manda o usuário novo direto pra Integrações conectar a loja Shopee de
    // verdade (OAuth), em vez de deixar ele perdido no dashboard vazio.
    const isFirstOnboarding = !onboardingDone;
    setSaving(true);
    const { data, error } = await updateProfileFullName(userId, draft);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar agora", { description: error.message });
      return;
    }
    setName(draft);
    if (data) setProfile(data);
    if (isFirstOnboarding) {
      toast.success("Perfil criado! Agora conecte sua loja Shopee pra começar a publicar.");
      void navigate({ to: "/integracoes" });
      return;
    }
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

// Planos reais vigentes. Não temos gateway de pagamento integrado pra saber
// automaticamente em qual plano cada pessoa está — por isso ela declara aqui
// qual está usando, e isso fica salvo em profiles.plan.
const PLAN_OPTIONS: {
  value: "mensal" | "vitalicio";
  name: string;
  price: string;
  detail: string;
}[] = [
  {
    value: "mensal",
    name: "Plano Mensal",
    price: "R$ 149,00",
    detail: "por mês",
  },
  {
    value: "vitalicio",
    name: "Plano Vitalício",
    price: "R$ 249,00",
    detail: "pagamento único",
  },
];

function PlanoTab() {
  const t = useT();
  const userId = useAuthStore((s) => s.session?.user.id);
  const currentPlan = useAuthStore((s) => s.profile?.plan ?? null);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [selected, setSelected] = useState<"mensal" | "vitalicio" | null>(currentPlan);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!userId || !selected) return;
    setSaving(true);
    const { data, error } = await updateProfilePlan(userId, selected);
    setSaving(false);
    if (error) {
      toast.error(t("Não foi possível salvar agora"), { description: error.message });
      return;
    }
    if (data) setProfile(data);
    toast.success(t("Plano atualizado"));
  };

  return (
    <div className="space-y-5">
      <SettingsCard
        title={t("Seu plano")}
        description={t(
          "A gente ainda não sabe automaticamente qual plano você está usando — selecione abaixo.",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {PLAN_OPTIONS.map((plan) => {
            const isSelected = selected === plan.value;
            return (
              <button
                key={plan.value}
                type="button"
                onClick={() => setSelected(plan.value)}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
                  isSelected
                    ? "border-brand bg-brand/5"
                    : "border-border bg-card hover:border-ring/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground">{t(plan.name)}</p>
                  {isSelected && <Check className="size-4 shrink-0 text-brand" />}
                </div>
                <p className="text-[15px] font-semibold text-foreground">{plan.price}</p>
                <p className="text-[12px] text-muted-foreground">{t(plan.detail)}</p>
              </button>
            );
          })}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !selected || selected === currentPlan}
          className="gap-2"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {t("Salvar plano")}
        </Button>
        {currentPlan && (
          <p className="text-[12px] text-muted-foreground">
            {t("Plano atual:")} {t(PLAN_OPTIONS.find((p) => p.value === currentPlan)?.name ?? "")}
          </p>
        )}
      </SettingsCard>
    </div>
  );
}

function AlterarSenhaCard() {
  const t = useT();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < 6;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isValid = newPassword.length >= 6 && newPassword === confirmPassword;

  const handleChangePassword = async () => {
    if (!isValid) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error(t("Não foi possível alterar a senha"), { description: error.message });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success(t("Senha alterada com sucesso"));
  };

  return (
    <SettingsCard title={t("Senha")} description={t("Escolha uma nova senha para sua conta.")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-new-password">{t("Nova senha")}</Label>
          <Input
            id="settings-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("Mínimo de 6 caracteres")}
            autoComplete="new-password"
          />
          {tooShort && (
            <p className="text-[11.5px] text-destructive">
              {t("A senha precisa ter pelo menos 6 caracteres.")}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-confirm-password">{t("Confirmar nova senha")}</Label>
          <Input
            id="settings-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("Repita a nova senha")}
            autoComplete="new-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleChangePassword();
            }}
          />
          {mismatch && (
            <p className="text-[11.5px] text-destructive">{t("As senhas não coincidem.")}</p>
          )}
        </div>
      </div>
      <Button
        variant="outline"
        className="w-fit gap-2"
        onClick={handleChangePassword}
        disabled={saving || !isValid}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        {t("Alterar senha")}
      </Button>
    </SettingsCard>
  );
}

function SegurancaTab() {
  const t = useT();
  const [twoFactor, setTwoFactor] = useState(false);

  return (
    <div className="space-y-5">
      <AlterarSenhaCard />

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

// 17/09/2026: corrigido — esses dois valores estavam com preços genéricos de
// placeholder ("Pro — Mensal R$ 49,00/mês", "Pro — Anual R$ 470,00/ano") que
// nunca bateram com os planos reais vendidos (ver PLAN_OPTIONS acima, na aba
// "Plano e cobrança", que já tinha os valores certos). Alinhado aqui com os
// mesmos dois planos e preços reais.
const BILLING_PLANS = [
  { value: "mensal", label: "Plano Mensal (R$ 149,00/mês)" },
  { value: "vitalicio", label: "Plano Vitalício (R$ 249,00)" },
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

// 28/10/2026: o reembolso ganhou página própria (/reembolso), com formulário
// já preenchido e status do pedido. Aqui fica só o atalho.
function ReembolsoTab() {
  return (
    <SettingsCard
      title="Reembolso"
      description="Peça o reembolso e acompanhe o andamento na página de reembolso."
    >
      <Button asChild className="w-fit gap-2">
        <Link to="/reembolso">
          <Send className="size-4" />
          Ir pra página de reembolso
        </Link>
      </Button>
    </SettingsCard>
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

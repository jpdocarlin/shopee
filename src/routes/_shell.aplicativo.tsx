import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Apple, Bell, CheckCircle2, Smartphone } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AppNotificationsCard } from "@/components/notifications/app-notifications-card";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Coloque o Shoppfy na tela inicial do seu celular e receba notificação de produto novo, preço que baixou, reajuste e estoque.";

export const Route = createFileRoute("/_shell/aplicativo")({
  head: () => ({
    meta: [
      { title: "Aplicativo no celular · Shoppfy" },
      { name: "description", content: DESCRIPTION },
    ],
  }),
  component: AplicativoPage,
});

type Step = { title: string; text: React.ReactNode };

const IOS_STEPS: Step[] = [
  {
    title: "Abra no Safari",
    text: (
      <>
        No iPhone, abra o <b>shoppfy.online</b> no <b>Safari</b> (a bússola azul). Pelo Chrome, pelo
        Instagram ou pelo WhatsApp não funciona.
      </>
    ),
  },
  {
    title: "Toque em Compartilhar",
    text: (
      <>
        Na barra de baixo do Safari, toque no botão <b>Compartilhar</b> — o quadrado com uma setinha
        pra cima.
      </>
    ),
  },
  {
    title: "Adicionar à Tela de Início",
    text: (
      <>
        Role a lista pra baixo e toque em <b>Adicionar à Tela de Início</b>. Depois toque em{" "}
        <b>Adicionar</b>, no canto de cima.
      </>
    ),
  },
  {
    title: "Abra pelo ícone",
    text: (
      <>
        Feche o Safari e abra o Shoppfy pelo <b>ícone novo</b> na tela do iPhone. Entre na sua conta
        se ele pedir.
      </>
    ),
  },
  {
    title: "Ative as notificações",
    text: (
      <>
        Volte nesta página (menu → <b>Aplicativo no celular</b>), toque em{" "}
        <b>Ativar notificações</b> e depois em <b>Permitir</b>.
      </>
    ),
  },
];

const ANDROID_STEPS: Step[] = [
  {
    title: "Abra no Chrome",
    text: (
      <>
        No Android, abra o <b>shoppfy.online</b> no <b>Google Chrome</b>.
      </>
    ),
  },
  {
    title: "Toque nos três pontinhos",
    text: (
      <>
        No canto de cima, à direita, toque nos <b>três pontinhos</b> (⋮).
      </>
    ),
  },
  {
    title: "Instalar app",
    text: (
      <>
        Toque em <b>Instalar app</b> (em alguns celulares aparece <b>Adicionar à tela inicial</b>) e
        confirme em <b>Instalar</b>.
      </>
    ),
  },
  {
    title: "Abra pelo ícone",
    text: (
      <>
        Abra o Shoppfy pelo <b>ícone novo</b> na tela do celular. Entre na sua conta se ele pedir.
      </>
    ),
  },
  {
    title: "Ative as notificações",
    text: (
      <>
        Volte nesta página (menu → <b>Aplicativo no celular</b>), toque em{" "}
        <b>Ativar notificações</b> e depois em <b>Permitir</b>.
      </>
    ),
  },
];

const WHAT_YOU_GET = [
  "Produto novo no catálogo, pra anunciar antes de todo mundo",
  "Produto que baixou de preço (sua margem aumenta)",
  "Reajuste de preço, pra você corrigir o preço do anúncio e não vender no prejuízo",
  "Produto que esgotou, pra pausar o anúncio",
  "Produto que voltou ao estoque, pra reativar o anúncio",
];

function StepsCard({
  title,
  icon: Icon,
  steps,
  highlight,
}: {
  title: string;
  icon: typeof Apple;
  steps: Step[];
  highlight: boolean;
}) {
  return (
    <div className={cn("surface-card p-5", highlight && "ring-1 ring-brand/50")}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon className="size-5" />
          </div>
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
        </div>
        {highlight && (
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">
            Seu celular
          </span>
        )}
      </div>
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[12px] font-semibold text-brand">
              {i + 1}
            </span>
            <div className="space-y-0.5">
              <p className="text-[13.5px] font-medium text-foreground">{step.title}</p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AplicativoPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "desktop");
  }, []);

  const ios = (
    <StepsCard title="iPhone" icon={Apple} steps={IOS_STEPS} highlight={platform === "ios"} />
  );
  const android = (
    <StepsCard
      title="Android"
      icon={Smartphone}
      steps={ANDROID_STEPS}
      highlight={platform === "android"}
    />
  );

  return (
    <div className="space-y-7">
      <PageHeader title="Aplicativo no celular" description={DESCRIPTION} />

      <AppNotificationsCard variant="page" />

      <div className="grid gap-4 lg:grid-cols-2">
        {platform === "android" ? (
          <>
            {android}
            {ios}
          </>
        ) : (
          <>
            {ios}
            {android}
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="size-4 text-brand" />
            <p className="text-[14px] font-semibold text-foreground">O que chega no celular</p>
          </div>
          <ul className="space-y-2">
            {WHAT_YOU_GET.map((item) => (
              <li key={item} className="flex gap-2 text-[12.5px] text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card space-y-3 p-5">
          <p className="text-[14px] font-semibold text-foreground">Dúvidas comuns</p>
          <div className="space-y-1">
            <p className="text-[12.5px] font-medium text-foreground">
              Não aparece “Adicionar à Tela de Início” no iPhone
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Você não está no Safari. Copie o endereço shoppfy.online, abra o Safari e cole lá.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[12.5px] font-medium text-foreground">
              Não aparece o botão “Ativar notificações” no iPhone
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              No iPhone só funciona abrindo pelo ícone da tela inicial (iOS 16.4 ou mais novo). Se
              abriu pelo Safari, feche e abra pelo ícone.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[12.5px] font-medium text-foreground">
              Cliquei em “Não permitir” sem querer
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              iPhone: Ajustes → Notificações → Shoppfy → Permitir Notificações. Android: segure o
              ícone do Shoppfy → Informações do app → Notificações → Permitir. Depois abra o Shoppfy
              de novo.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[12.5px] font-medium text-foreground">Quero parar de receber</p>
            <p className="text-[12.5px] text-muted-foreground">
              Desative as notificações do Shoppfy nos ajustes do celular, do mesmo jeito acima.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

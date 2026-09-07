import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { watchForNewDeploy } from "../lib/reload-on-new-deploy";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/auth-provider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Erro clássico de conexão instável (celular, sinal fraco) ou de cache
// desatualizado logo após um deploy novo: o navegador falha ao buscar um dos
// ~60 chunks JS que a página carrega (cada ícone/rota é um arquivo separado)
// e o React Router captura isso como um erro de renderização qualquer,
// mostrando a tela de erro pro usuário sem necessidade — na prática, um
// simples reload quase sempre resolve, porque o chunk que falhou é só mais
// uma requisição de rede que pode ter sido uma falha pontual.
const CHUNK_LOAD_ERROR_PATTERN =
  /failed to fetch dynamically imported module|loading chunk|importing a module script failed|error loading dynamically imported module/i;

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_LOAD_ERROR_PATTERN.test(message);
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });

    // Só tenta recarregar sozinho uma vez por sessão de navegação — se o
    // reload não resolver (erro de verdade, não só uma requisição que
    // falhou), a tela de erro normal aparece na segunda vez, sem loop.
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      const key = "shoppfy:chunk-error-reload-attempted";
      try {
        if (!window.sessionStorage.getItem(key)) {
          window.sessionStorage.setItem(key, "1");
          window.location.reload();
        }
      } catch {
        // Alguns navegadores/webviews (Safari com cookies bloqueados,
        // in-app browser do Instagram/TikTok) lançam erro só de acessar
        // sessionStorage — nesse caso, ignora e mostra a tela de erro normal.
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shoppfy · Plataforma para afiliados Shopee e Mercado Livre" },
      {
        name: "description",
        content:
          "Shoppfy é o sistema premium para afiliados: mineração de produtos, comissões, pedidos e analytics em um só lugar.",
      },
      { name: "author", content: "Shoppfy" },
      {
        property: "og:title",
        content: "Shoppfy · Plataforma para afiliados Shopee e Mercado Livre",
      },
      {
        property: "og:description",
        content:
          "Mineração de produtos, comissões, pedidos e analytics para afiliados de marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    watchForNewDeploy();
    // A página renderizou de verdade — libera a trava de retry de chunk
    // (ver ErrorComponent) pra próxima vez que um chunk falhar, em vez de
    // deixar "gasta" pra sempre na mesma aba depois do primeiro reload.
  try {
    window.sessionStorage?.removeItem("shoppfy:chunk-error-reload-attempted");
  } catch {
    // Mesmo motivo do ErrorComponent acima: acessar sessionStorage pode
    // lançar erro em alguns navegadores/webviews — ignora e segue.
  }
    }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <AuthProvider />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

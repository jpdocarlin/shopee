// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Hard-pin o preset de deploy pra Vercel (o padrão do pacote da Lovable é
  // Cloudflare) — necessário pra rodar as server functions (ex: geração de
  // imagem com Gemini) como Vercel Functions em vez de Cloudflare Workers.
  nitro: {
    preset: "vercel",
    // `vercel` não está no tipo público do preset do pacote da Lovable, mas o
    // nitro aceita a chave em runtime — daí o cast.
    ...({
      vercel: { functions: { runtime: "nodejs22.x" } },
    } as Record<string, unknown>),
  },
  // Workaround for a known, still-open upstream bug class where Vite's SSR
  // module graph can observe an incomplete re-exported namespace from
  // @tanstack/react-start during the *first* ("cold") evaluation of a
  // circular import (src/start.ts -> @tanstack/react-start ->
  // @tanstack/react-start-client -> #tanstack-start-entry -> src/start.ts).
  // This is what caused `createCsrfMiddleware is not a function` in
  // production. See:
  //   https://github.com/TanStack/router/issues/7459 (confirms this exact
  //   `ssr.optimizeDeps.include` workaround: it flattens the re-export chain
  //   ahead of time so the facade namespace is always complete)
  //   https://github.com/TanStack/router/issues/7285
  //   https://github.com/vitejs/vite/issues/22491 (root cause in Vite core,
  //   fix proposed in vitejs/vite#22493 but not yet merged/released)
  // We've additionally moved the createMiddleware()/createCsrfMiddleware()
  // calls in src/start.ts to run lazily inside createStart(() => ({...}))
  // instead of eagerly at module top level, which avoids invoking them
  // during the unsafe circular re-entry window. Both mitigations are kept
  // together (belt and suspenders) until the upstream fix ships.
  vite: {
    ssr: {
      optimizeDeps: {
        include: ["@tanstack/react-start", "@tanstack/start-client-core"],
      },
    },
  },
});

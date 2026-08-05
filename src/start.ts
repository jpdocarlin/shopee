import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// NOTE: createMiddleware()/createCsrfMiddleware() are intentionally called
// INSIDE the createStart(() => ({ ... })) factory below instead of at this
// module's top level.
//
// Why: src/start.ts is resolved by TanStack Start via the
// `#tanstack-start-entry` virtual import, which creates a real circular
// module dependency:
//   src/start.ts -> @tanstack/react-start -> @tanstack/react-start-client
//     -> #tanstack-start-entry -> src/start.ts
// On a "cold" (first) module evaluation, code that runs at this file's top
// level can be re-entered while @tanstack/react-start's own barrel module is
// still mid-initialization, so named exports it re-exports (e.g.
// createCsrfMiddleware, createMiddleware, createStart) can transiently be
// `undefined` on that first pass, causing
// `TypeError: createCsrfMiddleware is not a function` (and the equivalent
// for createMiddleware/createStartHandler) even though the same code works
// fine afterwards. This is a known, still-open class of upstream bug in how
// Vite's SSR module runner (and, per this project's own repro, Rolldown's
// production bundling under Vite 8) resolves `export *` / re-exported
// bindings through circular facades — see:
//   https://github.com/TanStack/router/issues/7459
//   https://github.com/TanStack/router/issues/7285
//   https://github.com/vitejs/vite/issues/22491
// The createStart(() => (...)) callback is deliberately lazy (TanStack Start
// only invokes it once it actually needs the request/function pipeline), so
// deferring these calls into it sidesteps the unsafe "during circular
// re-entry" evaluation window entirely: by the time the factory runs, the
// full module graph has finished linking.
export const startInstance = createStart(() => {
  const errorMiddleware = createMiddleware().server(async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error != null && typeof error === "object" && "statusCode" in error) {
        throw error;
      }
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  });

  // Start installs this automatically when src/start.ts is absent; defining
  // the file opts out, so re-add it explicitly to keep server functions
  // protected from cross-site requests.
  const csrfMiddleware = createCsrfMiddleware({
    filter: (ctx) => ctx.handlerType === "serverFn",
  });

  return {
    functionMiddleware: [attachSupabaseAuth],
    requestMiddleware: [errorMiddleware, csrfMiddleware],
  };
});

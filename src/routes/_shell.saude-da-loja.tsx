import { createFileRoute, redirect } from "@tanstack/react-router";

// A Saúde da loja virou o Dashboard. Mantém o endereço antigo funcionando
// (links de e-mails e notificações já enviados).
export const Route = createFileRoute("/_shell/saude-da-loja")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});

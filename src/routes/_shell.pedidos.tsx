import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { PedidoForm } from "@/components/pedidos/pedido-form";
import { PedidosList } from "@/components/pedidos/pedidos-list";

const DESCRIPTION =
  "Registre cada venda com produto, custo, etiqueta e comprovante do PIX — tudo num só lugar.";

export const Route = createFileRoute("/_shell/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos · Shoppfy" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Pedidos · Shoppfy" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Pedidos"
        description="Quando fechar uma venda, registre aqui: produto, custo sem a sua margem, etiqueta de envio e comprovante do PIX. Assim a gente sempre sabe quem pediu o quê."
      />
      <PedidoForm onCreated={() => setRefreshKey((k) => k + 1)} />
      <PedidosList refreshKey={refreshKey} />
    </div>
  );
}

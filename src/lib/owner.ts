import { useAuthStore } from "@/stores/auth-store";

// Só quem tem a role "admin" (tabela user_roles, atribuída manualmente pra
// conta do dono via migration) enxerga os dados de demonstração (vendas,
// ganhos, ranking). Qualquer outra conta vê a ferramenta zerada, como um
// usuário novo de verdade. A aba Pedidos (Admin) NÃO depende mais disso —
// ver useIsPedidosAdmin() abaixo.
//
// Antes essa checagem comparava um e-mail fixo escrito aqui no código — como
// este arquivo roda no cliente, isso vazava o e-mail do dono no JavaScript
// público do site pra qualquer visitante (achado num relatório externo).
// Agora a decisão vem do banco (RLS: cada usuário só lê a própria role em
// user_roles), então nenhum identificador do dono precisa existir no bundle.

// true só depois que a sessão terminou de carregar E a role já foi
// carregada — enquanto `initialized` é false, retorna false (fail-safe:
// nunca mostra dado de demonstração antes de confirmar quem é o usuário).
export function useIsOwner(): boolean {
  const initialized = useAuthStore((s) => s.initialized);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  return initialized && isAdmin;
}

// Role restrita "pedidos_admin" (tabela user_roles) — conta dedicada que só
// enxerga a aba Pedidos (Admin) e mais nada (nem Dashboard, nem Ranking, nem
// o resto do menu). Separada de useIsOwner(): o dono pode não ter mais essa
// role, e essa conta não é dona de nada além de Pedidos.
export function useIsPedidosAdmin(): boolean {
  const initialized = useAuthStore((s) => s.initialized);
  const isPedidosAdmin = useAuthStore((s) => s.isPedidosAdmin);
  return initialized && isPedidosAdmin;
}

import { useAuthStore } from "@/stores/auth-store";

// Só quem tem a role "admin" (tabela user_roles, atribuída manualmente pra
// conta do dono via migration) enxerga os dados de demonstração (vendas,
// ganhos, ranking) e a aba de Pedidos (Admin). Qualquer outra conta vê a
// ferramenta zerada, como um usuário novo de verdade.
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

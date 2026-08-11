import { useAuthStore } from "@/stores/auth-store";

// Único e-mail que enxerga os dados de demonstração (vendas, ganhos, ranking).
// Qualquer outra conta que logar no app tem que ver a ferramenta zerada, como
// um usuário novo de verdade — sem nada da conta de demonstração vazando.
const OWNER_EMAIL = "jpnogueiraz@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}

// true só depois que a sessão terminou de carregar E o e-mail bate com o
// dono — enquanto `initialized` é false, retorna false (fail-safe: nunca
// mostra dado de demonstração antes de confirmar quem é o usuário).
export function useIsOwner(): boolean {
  const initialized = useAuthStore((s) => s.initialized);
  const email = useAuthStore((s) => s.profile?.email ?? s.session?.user.email);
  return initialized && isOwnerEmail(email);
}

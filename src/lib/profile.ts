import { supabase } from "@/integrations/supabase/client";

// Salva o nome no Supabase (profiles.full_name) e marca onboarding_done — editar
// o perfil é a primeira etapa obrigatória depois do login, então qualquer save
// aqui conta como "perfil completo", venha do modal do header ou de Configurações.
export async function updateProfileFullName(userId: string, fullName: string) {
  return supabase
    .from("profiles")
    .update({ full_name: fullName.trim(), onboarding_done: true })
    .eq("id", userId)
    .select("id, email, full_name, onboarding_done")
    .single();
}

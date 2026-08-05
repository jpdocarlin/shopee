import { useState } from "react";
import { CreditCard, LogOut, Settings, User, LifeBuoy } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditProfileModal } from "./edit-profile-modal";
import { getInitials, useProfileStore } from "@/stores/profile-store";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";

export function UserMenu() {
  const [editOpen, setEditOpen] = useState(false);
  const name = useProfileStore((s) => s.name);
  const email = useAuthStore((s) => s.profile?.email ?? s.session?.user.email);
  const initials = getInitials(name);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/login" });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu do perfil"
            className="rounded-full outline-none ring-offset-2 ring-offset-background transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="size-8 border border-border">
              <AvatarFallback className="bg-surface-hover text-[12px] font-medium text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium">{name || "Sua conta"}</span>
            <span className="truncate text-[11px] font-normal text-muted-foreground">
              {email ?? "Sua conta"}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <User className="size-4" /> Perfil
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/configuracoes">
              <CreditCard className="size-4" /> Plano e cobrança
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/configuracoes">
              <Settings className="size-4" /> Preferências
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <LifeBuoy className="size-4" /> Suporte
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => void handleLogout()}
          >
            <LogOut className="size-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LifeBuoy, Moon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { getNavigationForUser } from "@/config/navigation";
import { useIsOwner } from "@/lib/owner";
import { useUIStore } from "@/stores/ui-store";
import { useT } from "@/i18n/translations";

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const t = useT();
  const isOwner = useIsOwner();
  const navigation = getNavigationForUser(isOwner);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!useUIStore.getState().commandOpen);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  const go = (to: string) => {
    setOpen(false);
    void navigate({ to: to as never });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("Digite um comando ou pesquise…")} />
      <CommandList>
        <CommandEmpty>{t("Nenhum resultado encontrado.")}</CommandEmpty>
        {navigation.map((group) => (
          <CommandGroup key={group.id} heading={t(group.label)}>
            {group.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${t(item.label)} ${item.description} ${t(item.description)}`}
                onSelect={() => go(item.to)}
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span>{t(item.label)}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading={t("Ações")}>
          <CommandItem onSelect={() => go("/integracoes")}>
            <Moon className="size-4 text-muted-foreground" />
            {t("Conectar marketplace")}
          </CommandItem>
          <CommandItem onSelect={() => setOpen(false)}>
            <LifeBuoy className="size-4 text-muted-foreground" />
            {t("Falar com o suporte")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

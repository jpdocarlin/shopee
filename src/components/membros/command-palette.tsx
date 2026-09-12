import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { Command as CommandPrimitive } from "cmdk";
import { Layers, Lock, PlayCircle, Search } from "lucide-react";

import type { EnrichedModule } from "@/lib/membros";

// Command palette (⌘K / Ctrl+K) — busca de módulo/aula. Composto direto de
// Dialog + cmdk (em vez do wrapper CommandDialog de components/ui/command)
// pra poder aplicar a identidade visual própria da área de membros
// (.membros-scope) no conteúdo do modal.
export function CommandPalette({ modules }: { modules: EnrichedModule[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(to: string) {
    setOpen(false);
    void navigate({ to });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="membros-scope fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-[var(--mb-radius-lg)] border border-[var(--mb-border)] bg-[var(--mb-bg-elevated)] shadow-[var(--mb-shadow-elevated)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Buscar aula ou módulo</DialogPrimitive.Title>
          <CommandPrimitive className="flex flex-col" shouldFilter>
            <div className="flex items-center gap-2.5 border-b border-[var(--mb-border)] px-4">
              <Search className="size-4 shrink-0 text-[var(--mb-text-faint)]" />
              <CommandPrimitive.Input
                autoFocus
                placeholder="Buscar aula ou módulo..."
                className="h-12 w-full bg-transparent text-[13.5px] text-[var(--mb-text)] outline-none placeholder:text-[var(--mb-text-faint)]"
              />
            </div>
            <CommandPrimitive.List className="max-h-[360px] overflow-y-auto p-2">
              <CommandPrimitive.Empty className="py-8 text-center text-[13px] text-[var(--mb-text-faint)]">
                Nada encontrado.
              </CommandPrimitive.Empty>
              {modules.map((module) => (
                <CommandPrimitive.Group
                  key={module.id}
                  heading={module.title}
                  className="[&_[cmdk-group-heading]]:mb-eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
                >
                  <CommandPrimitive.Item
                    value={`modulo ${module.title}`}
                    onSelect={() => go(`/membros/${module.slug}`)}
                    disabled={module.state === "locked"}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[var(--mb-radius-sm)] px-2.5 py-2 text-[13.5px] text-[var(--mb-text)] data-[selected=true]:bg-white/[0.05] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40"
                  >
                    <Layers className="size-4 shrink-0 text-[var(--mb-text-muted)]" />
                    <span className="truncate">{module.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--mb-text-faint)]">
                      Módulo
                    </span>
                  </CommandPrimitive.Item>
                  {module.lessons.map((lesson) => (
                    <CommandPrimitive.Item
                      key={lesson.id}
                      value={`aula ${lesson.title} ${module.title}`}
                      onSelect={() => go(`/membros/${module.slug}/${lesson.slug}`)}
                      disabled={lesson.state === "locked"}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[var(--mb-radius-sm)] px-2.5 py-2 pl-8 text-[13.5px] text-[var(--mb-text)] data-[selected=true]:bg-white/[0.05] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40"
                    >
                      {lesson.state === "locked" ? (
                        <Lock className="size-3.5 shrink-0 text-[var(--mb-text-faint)]" />
                      ) : (
                        <PlayCircle className="size-3.5 shrink-0 text-[var(--mb-text-muted)]" />
                      )}
                      <span className="truncate">{lesson.title}</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              ))}
            </CommandPrimitive.List>
            <div className="flex items-center justify-between border-t border-[var(--mb-border)] px-4 py-2 text-[11px] text-[var(--mb-text-faint)]">
              <span>Navegar</span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[var(--mb-border)] px-1.5 py-0.5">Esc</kbd>
                fechar
              </span>
            </div>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

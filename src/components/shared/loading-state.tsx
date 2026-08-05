import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-border border-t-brand",
        className,
      )}
      role="status"
      aria-label="Carregando"
    />
  );
}

export function LoadingState({
  label = "Carregando…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground",
        className,
      )}
    >
      <Spinner />
      <span className="text-[13px]">{label}</span>
    </motion.div>
  );
}

export function TopProgressBar() {
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-100 h-0.5 origin-left bg-brand"
      initial={{ scaleX: 0, opacity: 1 }}
      animate={{ scaleX: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
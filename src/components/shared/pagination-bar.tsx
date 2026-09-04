import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationBarProps = {
  page: number;
  pageCount: number;
  total?: number;
  onPageChange: (page: number) => void;
};

export function PaginationBar({ page, pageCount, total, onPageChange }: PaginationBarProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <p className="text-[12px] text-muted-foreground">
        Página <span className="text-foreground">{page}</span> de {pageCount}
        {typeof total === "number" && ` · ${total} registros`}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

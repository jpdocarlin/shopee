import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { TableSkeleton } from "./skeletons";
import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  hideOnMobile?: boolean;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
};

export function DataTable<T>({
  data,
  columns,
  rowKey,
  isLoading,
  error,
  onRetry,
  onRowClick,
  emptyTitle = "Nenhum registro",
  emptyDescription = "Assim que houver dados eles aparecem aqui.",
  toolbar,
  footer,
}: DataTableProps<T>) {
  if (error) return <ErrorState onRetry={onRetry} />;
  if (isLoading) return <TableSkeleton cols={columns.length} />;

  return (
    <div className="surface-card overflow-hidden">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {toolbar}
        </div>
      )}
      {data.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          className="border-0 bg-transparent"
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.id}
                    style={{ width: col.width }}
                    className={cn(
                      "h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.hideOnMobile && "hidden md:table-cell",
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-border transition-colors duration-150 hover:bg-surface-hover",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        "py-3 text-[13px]",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.hideOnMobile && "hidden md:table-cell",
                      )}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {footer && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}
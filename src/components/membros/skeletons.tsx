import { cn } from "@/lib/utils";

export function ModuleCardSkeleton({ featured }: { featured?: boolean }) {
  return (
    <div
      className={cn(
        "mb-skeleton",
        featured ? "sm:col-span-2 sm:row-span-2 aspect-[16/11]" : "aspect-[4/3]",
      )}
    />
  );
}

export function LessonRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3">
      <div className="mb-skeleton aspect-video w-28 shrink-0 sm:w-36" />
      <div className="flex-1 space-y-2.5">
        <div className="mb-skeleton h-4 w-2/3 max-w-[240px]" />
        <div className="mb-skeleton h-3 w-16" />
      </div>
    </div>
  );
}

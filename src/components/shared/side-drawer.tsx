import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type SideDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "left" | "right";
  children?: ReactNode;
  footer?: ReactNode;
};

export function SideDrawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  children,
  footer,
}: SideDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className="flex w-full flex-col border-border bg-popover sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-[15px]">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-[13px]">{description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">{children}</div>
        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}

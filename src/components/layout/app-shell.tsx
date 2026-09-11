import type { ReactNode } from "react";

import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { MarketplaceLockGate } from "@/components/auth/marketplace-lock-gate";
import { useExtensionBridge } from "@/lib/extension-bridge";
import { useTrackingNotifications } from "@/lib/tracking-notifications";

export function AppShell({ children }: { children: ReactNode }) {
  useExtensionBridge();
  useTrackingNotifications();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8 lg:pb-28">
            {children}
          </div>
          <MarketplaceLockGate />
        </main>
      </div>

      <AppSidebar />
      <CommandPalette />
    </div>
  );
}

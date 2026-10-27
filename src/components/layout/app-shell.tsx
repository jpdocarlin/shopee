import type { ReactNode } from "react";

import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { WelcomeLessonNudge } from "./welcome-lesson-nudge";
import { useExtensionBridge } from "@/lib/extension-bridge";
import { useTrackingNotifications } from "@/lib/tracking-notifications";

export function AppShell({ children }: { children: ReactNode }) {
  useExtensionBridge();
  useTrackingNotifications();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-5 md:px-8 md:py-8 lg:pb-28">
            {children}
          </div>
        </main>
      </div>

      <AppSidebar />
      <CommandPalette />
      <WelcomeLessonNudge />
    </div>
  );
}

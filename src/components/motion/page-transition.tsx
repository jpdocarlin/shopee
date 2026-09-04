import { motion } from "motion/react";
import type { ReactNode } from "react";

import { easePremium } from "./motion-presets";

export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easePremium }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

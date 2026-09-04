import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

import { fadeIn, fadeUp, slideInLeft, staggerContainer } from "./motion-presets";

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  variant?: "fade" | "up" | "slide";
  delay?: number;
};

const variantMap = { fade: fadeIn, up: fadeUp, slide: slideInLeft } as const;

export function Reveal({ children, variant = "up", delay = 0, ...props }: RevealProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variantMap[variant]}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  stagger?: number;
  delay?: number;
};

export function Stagger({ children, stagger = 0.05, delay = 0, ...props }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(stagger, delay)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={fadeUp} {...props}>
      {children}
    </motion.div>
  );
}

import type { Transition, Variants } from "motion/react";

export const easePremium = [0.22, 1, 0.36, 1] as const;

export const transitionBase: Transition = {
  duration: 0.4,
  ease: easePremium,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: transitionBase },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionBase },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: transitionBase },
};

export const staggerContainer = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});
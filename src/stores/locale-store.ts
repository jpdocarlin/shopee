import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "pt" | "en";

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "pt",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "shoppfy.locale",
    },
  ),
);

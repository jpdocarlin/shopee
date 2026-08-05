import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProfileState = {
  name: string;
  setName: (name: string) => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      name: "",
      setName: (name) => set({ name: name.trim() }),
    }),
    {
      name: "shoppfy.profile",
    },
  ),
);

export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "FY";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

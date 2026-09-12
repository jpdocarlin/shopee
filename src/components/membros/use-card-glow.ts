import { useCallback } from "react";

// Halo radial extremamente sutil que acompanha o cursor nos cards — usa
// custom properties CSS (--mb-x/--mb-y) lidas em membros.css, em vez de
// re-renderizar o componente a cada movimento do mouse.
export function useCardGlow() {
  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--mb-x", `${x}%`);
    e.currentTarget.style.setProperty("--mb-y", `${y}%`);
  }, []);
}

// Páginas de "obrigado" do funil da Applyfy (depois do upsell do Acelerador).
// Visual igual ao da página do Acelerador: preto e cinza, tipografia Apple.
import type { ReactNode } from "react";

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Inter, system-ui, sans-serif';

export function ThanksLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col bg-black text-[#F5F5F7] antialiased"
      style={{ fontFamily: FONT, letterSpacing: "-0.011em" }}
    >
      <header className="mx-auto flex h-16 w-full max-w-[720px] items-center gap-2.5 border-b border-[#1F1F1F] px-6">
        <img src="/icon-192.png" alt="" className="size-6 rounded-md grayscale" />
        <span className="text-[16px] font-semibold tracking-tight">Shoppfy</span>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-6 py-16">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-[720px] border-t border-[#1F1F1F] px-6 py-6 text-[12px] text-[#6E6E73]">
        Shoppfy · shoppfy.online
      </footer>
    </div>
  );
}

export function Check() {
  return (
    <span className="grid size-12 place-items-center rounded-full bg-[#F5F5F7] text-black">
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-[#1F1F1F] py-5 last:border-b-0">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#2A2A2A] text-[13px] font-semibold text-[#A1A1A6]">
        {n}
      </span>
      <div className="text-[16px] leading-relaxed text-[#A1A1A6]">{children}</div>
    </div>
  );
}

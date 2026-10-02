"use client";

import { useSyncExternalStore } from "react";
import { cn, ui } from "@/lib/ui";

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};
const isLight = () => document.documentElement.dataset.theme === "light";

/** Cambia entre tema oscuro (por defecto) y claro; recuerda la elección en este navegador. */
export default function ThemeToggle() {
  const light = useSyncExternalStore(subscribe, isLight, () => false);
  function toggle() {
    const next = !light;
    if (next) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("cs-theme", next ? "light" : "dark");
    } catch {}
  }
  return (
    <button className={cn(ui.out, "size-[30px] px-0")} type="button" onClick={toggle} aria-label={light ? "Usar tema oscuro" : "Usar tema claro"} title={light ? "Tema oscuro" : "Tema claro"}>
      {light ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g></svg>
      )}
    </button>
  );
}

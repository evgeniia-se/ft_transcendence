// Theme preference: "system" follows the browser, "light"/"dark" are the user's choice.
// Stored per browser. Each page's <head> applies it before first paint.
// Only a change made by the user is animated, never the first load.
import { tick } from "svelte";

const STORAGE_KEY = "ft_theme";

export type ThemePref = "system" | "light" | "dark";

function readPref(): ThemePref {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref): void {
  if (pref === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
}

// reactive
export const theme = $state<{ pref: ThemePref }>({ pref: readPref() });

function resolved(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setThemePref(pref: ThemePref, origin?: { x: number; y: number }): void {
  const commit = () => {
    theme.pref = pref;
    apply(pref);
    try {
      if (pref === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // storage disabled: the choice is not saved
    }
  };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || resolved(theme.pref) === resolved(pref)) {
    commit();
    return;
  }
  animate(commit, origin);
}

// the new theme spreads in a circle from `origin`; browsers without View Transitions get a color fade
function animate(commit: () => void, origin?: { x: number; y: number }): void {
  const root = document.documentElement;

  if (typeof document.startViewTransition !== "function") {
    root.classList.add("theme-anim");
    commit();
    setTimeout(() => root.classList.remove("theme-anim"), 800);
    return;
  }

  const x = origin?.x ?? innerWidth / 2;
  const y = origin?.y ?? innerHeight / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  // theme.css starts the new snapshot as an empty circle at this point, so it never shows before the animation
  root.style.setProperty("--vt-x", `${x}px`);
  root.style.setProperty("--vt-y", `${y}px`);

  const transition = document.startViewTransition(async () => {
    commit();
    await tick();
  });
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 1100, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "both", pseudoElement: "::view-transition-new(root)" }
      )
    )
    .catch(() => {});
  void transition.finished.finally(() => {
    root.style.removeProperty("--vt-x");
    root.style.removeProperty("--vt-y");
  });
}

// applies the stored choice and syncs other tabs
export function initTheme(): void {
  theme.pref = readPref();
  apply(theme.pref);
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    theme.pref = readPref();
    apply(theme.pref);
  });
}

// system → light → dark → system
export function cycleTheme(origin?: { x: number; y: number }): ThemePref {
  const next: ThemePref = theme.pref === "system" ? "light" : theme.pref === "light" ? "dark" : "system";
  setThemePref(next, origin);
  return next;
}

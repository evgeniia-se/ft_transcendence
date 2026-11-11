// Interface language. Stored per browser (like the theme); without a saved choice it follows the browser's language.
// To add a language: create locales/<code>.ts typed against fr, then add it to DICTIONARIES and LANGUAGES.
import fr, { type Messages } from "./locales/fr";
import en from "./locales/en";
import ja from "./locales/ja";
import ru from "./locales/ru";
import zh from "./locales/zh";

const DICTIONARIES = { fr, en, ja, ru, zh } satisfies Record<string, Messages>;

export type Lang = keyof typeof DICTIONARIES;
export type MessageKey = keyof Messages;

// shown in the language switch, in their own language
export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ru", label: "Русский" },
  { value: "zh", label: "简体中文" },
];

const STORAGE_KEY = "ft_lang";
const DEFAULT_LANG: Lang = "fr";

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && value in DICTIONARIES;
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage disabled: fall back to the browser's language
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = tag.slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return DEFAULT_LANG;
}

// reactive: every t() read in a template re-renders when the language changes
export const i18n = $state<{ lang: Lang }>({ lang: readLang() });
document.documentElement.lang = i18n.lang;

export function setLang(lang: Lang): void {
  i18n.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage disabled: the choice lasts until the page is left
  }
}

// other tabs follow a change
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  i18n.lang = readLang();
  document.documentElement.lang = i18n.lang;
});

// t("auth.nameTooLong", { max: 60 }) replaces {max} in the message; a key missing from a language falls back to French
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text: string = DICTIONARIES[i18n.lang][key] ?? fr[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

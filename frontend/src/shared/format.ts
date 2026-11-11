import { i18n, t } from "./i18n.svelte";

// Intl formatters follow the interface language; rebuilt only when it changes
let formattersLang = "";
let rtf: Intl.RelativeTimeFormat;
let dateFmt: Intl.DateTimeFormat;
let dateShortFmt: Intl.DateTimeFormat;
let dateTimeFmt: Intl.DateTimeFormat;

function formatters() {
  if (formattersLang !== i18n.lang) {
    formattersLang = i18n.lang;
    rtf = new Intl.RelativeTimeFormat(i18n.lang, { numeric: "auto" });
    dateFmt = new Intl.DateTimeFormat(i18n.lang, { day: "numeric", month: "long", year: "numeric" });
    dateShortFmt = new Intl.DateTimeFormat(i18n.lang, { day: "numeric", month: "short", year: "numeric" });
    dateTimeFmt = new Intl.DateTimeFormat(i18n.lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  return { rtf, dateFmt, dateShortFmt, dateTimeFmt };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// e.g. "il y a 3 heures" / "3 hours ago"
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const { rtf } = formatters();
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return t("time.justNow");
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), "minute");
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? formatters().dateFmt.format(new Date(iso)) : "";
}

export function formatDateShort(iso: string | null | undefined): string {
  return iso ? formatters().dateShortFmt.format(new Date(iso)) : "";
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? formatters().dateTimeFmt.format(new Date(iso)) : "";
}

export function greeting(name: string): string {
  const hour = new Date().getHours();
  const first = name.split(/\s+/)[0];
  return hour < 5 || hour >= 18 ? t("greeting.evening", { name: first }) : t("greeting.day", { name: first });
}

import type { Role } from "../api/types";

export function roleLabel(role: Role): string {
  return t(`role.${role}`);
}

export function roleHint(role: Role): string {
  return t(`role.${role}.hint`);
}

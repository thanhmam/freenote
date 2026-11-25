// Minimal i18n. English strings are the keys; each locale file maps English → translation.
// To add a language: create src/locales/<code>.js and register it in LOCALES below.
import vi from "./locales/vi.js";
import * as bnLocales from "@blocknote/core/locales";

export const LOCALES = {
  en: { name: "English", dict: null, date: "en-US", editor: bnLocales.en },
  vi: { name: "Tiếng Việt", dict: vi, date: "vi-VN", editor: bnLocales.vi },
};

const saved = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
const browser = typeof navigator !== "undefined" ? (navigator.language || "en").slice(0, 2).toLowerCase() : "en";
export const lang = LOCALES[saved] ? saved : LOCALES[browser] ? browser : "en";
if (typeof document !== "undefined") document.documentElement.lang = lang;

export const dateLocale = LOCALES[lang].date;
export const editorDictionary = LOCALES[lang].editor;

/** t("Edited {time}", { time }) → translated string with {placeholders} filled in. */
export function t(key, vars) {
  let s = LOCALES[lang].dict?.[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return s;
}

/** Switching language reloads the UI so every module (and the editor) picks it up. */
export function setLang(code) {
  localStorage.setItem("lang", code);
  window.location.reload();
}

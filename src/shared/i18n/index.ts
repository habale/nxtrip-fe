import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './en/common.json';
import enErrors from './en/errors.json';
import viCommon from './vi/common.json';
import viErrors from './vi/errors.json';

export const SUPPORTED_LANGUAGES = ['en', 'vi'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'sxtrip.language';

const resources = {
  en: { common: enCommon, errors: enErrors },
  vi: { common: viCommon, errors: viErrors },
} as const;

function toSupportedLanguage(value: string | null | undefined) {
  const language = value?.trim().toLowerCase().split('-')[0];

  return SUPPORTED_LANGUAGES.find((supported) => supported === language);
}

function readPersistedLanguage() {
  try {
    return toSupportedLanguage(
      globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY),
    );
  } catch {
    return undefined;
  }
}

function readBrowserLanguage() {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  const browserLanguages = [...(navigator.languages ?? []), navigator.language];

  return browserLanguages
    .map(toSupportedLanguage)
    .find((language): language is SupportedLanguage => language !== undefined);
}

export function detectLanguage(): SupportedLanguage {
  return readPersistedLanguage() ?? readBrowserLanguage() ?? FALLBACK_LANGUAGE;
}

export function createI18n(language: string = detectLanguage()): I18nInstance {
  const instance = createInstance();

  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: ['common', 'errors'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    initAsync: false,
  });

  return instance;
}

export const i18n = createI18n();

function setDocumentLanguage(language: SupportedLanguage) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

setDocumentLanguage(detectLanguage());

export function changeLanguage(language: SupportedLanguage) {
  void i18n.changeLanguage(language);

  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selected language still applies for this session when storage is unavailable.
  }

  setDocumentLanguage(language);
}

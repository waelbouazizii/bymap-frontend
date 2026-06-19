// src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

const LANG_KEY = '@bymap_language';

// Map display name → i18next language code
export const LANGUAGE_MAP = {
  'Français':  'fr',
  'English':   'en',
  'العربية':   'ar',
};

export const LANGUAGE_NAMES = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
};

export async function getStoredLanguage() {
  try {
    const lang = await AsyncStorage.getItem(LANG_KEY);
    return lang || 'fr';
  } catch {
    return 'fr';
  }
}

export async function setStoredLanguage(langCode) {
  try {
    await AsyncStorage.setItem(LANG_KEY, langCode);
  } catch {}
}

export async function changeAppLanguage(langCode) {
  await setStoredLanguage(langCode);
  await i18n.changeLanguage(langCode);
  // RTL pour l'arabe
  const isRTL = langCode === 'ar';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
  }
}

// Initialisation synchrone avec langue par défaut = 'fr'
// La langue persistée sera chargée dans App.js avant le rendu
i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
    },
    lng:            'fr',
    fallbackLng:    'fr',
    interpolation:  { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

// Bilingual (ar/en) i18n. All UI strings live in ./locales/{ar,en}.json — keep
// the two files structurally identical (same keys) so every string has both
// languages. Arabic is the default + fallback, so a missing key still shows
// Arabic rather than a raw key. Switching language flips the document direction.

const resources = {
  ar: { translation: ar },
  en: { translation: en },
};

const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('nabta_lang')) || 'ar';

function applyDir(lng) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
}

i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

applyDir(saved);
i18n.on('languageChanged', (lng) => {
  applyDir(lng);
  try { localStorage.setItem('nabta_lang', lng); } catch { /* ignore */ }
});

export default i18n;

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Platform, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { changeLanguage, formatDateTime, formatHistoryNote, formatMoney, getLanguage, isLanguage, languageNames, subscribeLanguage, translate, type Language, type Parameters } from '@/lib/i18n';

const storageKey = 'saiway.mobile.language';
async function save(value: Language) {
  if (Platform.OS === 'web') window.localStorage.setItem(storageKey, value);
  else await SecureStore.setItemAsync(storageKey, value);
}
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'fr' as const);
  const t = useCallback((value: string, parameters?: Parameters) => translate(value, language, parameters), [language]);
  const money = useCallback((cents: number, currency = 'USD') => formatMoney(cents, currency, language), [language]);
  const dateTime = useCallback((value: string) => formatDateTime(value, language), [language]);
  const historyNote = useCallback((value: string | null) => formatHistoryNote(value, language), [language]);
  return { language, t, money, dateTime, historyNote };
}
export function LanguageProvider({ children }: PropsWithChildren) {
  const { t } = useLanguage();
  const [error, setError] = useState('');
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const currentRevision = revision.current;
    async function restore() {
      try {
        const saved = Platform.OS === 'web' ? window.localStorage.getItem(storageKey) : await SecureStore.getItemAsync(storageKey);
        if (saved !== null && !isLanguage(saved)) throw new Error('Unsupported saved language');
        if (active && currentRevision === revision.current && saved) changeLanguage(saved);
      } catch (failure) {
        console.warn('SAIWAY language restore failed', failure);
        if (active) setError('Impossible de restaurer la langue enregistrée.');
      }
    }
    void restore();
    return () => { active = false; };
  }, []);
  return <LanguageSettingsContext.Provider value={{
    error, choose: async value => {
      const current = ++revision.current;
      try {
        await save(value);
        if (current === revision.current) { changeLanguage(value); setError(''); }
      } catch (failure) {
        console.warn('SAIWAY language save failed', failure);
        if (current === revision.current) setError('Impossible d’enregistrer la langue. Réessayez.');
      }
    },
  }}>{children}{error ? <View accessibilityLiveRegion="polite" style={{ backgroundColor: '#FDEAEA', padding: 12 }}>
    <Text accessibilityRole="alert" style={{ color: '#A52B20' }}>{t(error)}</Text>
  </View> : null}</LanguageSettingsContext.Provider>;
}

const LanguageSettingsContext = createContext<{ error: string; choose: (value: Language) => Promise<void> } | null>(null);
export function useLanguageSettings() {
  const settings = useContext(LanguageSettingsContext);
  if (!settings) throw new Error('LanguageProvider missing');
  return settings;
}
export { languageNames };

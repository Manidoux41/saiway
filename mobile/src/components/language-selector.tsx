import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { languageNames, useLanguage, useLanguageSettings } from '@/providers/language';
import type { Language } from '@/lib/i18n';

export function LanguageSelector() {
  const { language, t } = useLanguage();
  const { choose } = useLanguageSettings();
  const [pending, setPending] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: '#101B3D', fontWeight: '600' }}>{t('Langue')}</Text>
    <View accessibilityLabel={t('Choisir la langue')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(Object.keys(languageNames) as Language[]).map(value => <Pressable key={value}
        accessibilityRole="button" accessibilityState={{ selected: language === value, disabled: pending }} disabled={pending}
        onPress={() => {
          setPending(true);
          void choose(value).finally(() => setPending(false));
        }} style={{ backgroundColor: language === value ? '#032EA1' : '#E6ECFA', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ color: language === value ? '#FFFFFF' : '#021F73', fontSize: 15, lineHeight: 24 }}>{languageNames[value]}</Text>
      </Pressable>)}
    </View>
  </View>;
}

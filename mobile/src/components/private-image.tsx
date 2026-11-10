import { useLanguage } from '@/providers/language';
import { useState } from 'react';
import { Image } from 'react-native';
import { authenticatedSource } from '@/lib/api';
import { Notice } from './native-ui';

export function PrivateImage({ path, label }: { path: string; label: string }) {
  const { t } = useLanguage();
  const [error, setError] = useState('');
  return <>
    <Image accessibilityLabel={label} source={authenticatedSource(path)}
      style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="contain"
      onError={() => setError(t("Impossible de charger {p0}. Actualisez les documents.", { p0: label }))} />
    <Notice error={error} />
  </>;
}

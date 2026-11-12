import { Text } from 'react-native';
import { useLanguage } from '@/providers/language';
import { useNotifications } from '@/providers/notifications';
import { Button, Card, Notice, styles } from './native-ui';

export function NotificationSettings() {
  const { t } = useLanguage();
  const push = useNotifications();
  return <Card>
    <Text style={styles.heading}>{t('Notifications de mes courses')}</Text>
    <Text style={styles.text}>{t('Recevez vos alertes même lorsque SAIWAY est fermé. Le service Expo transmet les notifications à Apple ou Google. Aucun nom, adresse ou position GPS ne figure dans les alertes.')}</Text>
    <Text style={styles.muted}>{t('La réception dépend du réseau et des réglages système. Un arrêt forcé, le mode concentration ou les économies de batterie peuvent bloquer les alertes.')}</Text>
    <Text style={styles.badge}>{push.enabled ? t('Notifications activées') : t('Notifications désactivées')}</Text>
    <Notice error={push.error} message={push.message} />
    <Button title={push.enabled ? t('Désactiver les notifications') : t('Activer les notifications')} disabled={push.pending}
      onPress={() => void (push.enabled ? push.disable() : push.enable())} />
    {push.enabled && <Button title={t('Envoyer une notification de test')} secondary disabled={push.pending} onPress={() => void push.test()} />}
    <Button title={t('Réglages de l’appareil')} secondary disabled={push.pending} onPress={() => void push.settings()} />
  </Card>;
}

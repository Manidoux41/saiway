import { Linking, Text } from 'react-native';
import { useLanguage } from '@/providers/language';
import { configuredOrigin } from '@/lib/api';
import { useOperation } from '@/hooks/use-api';
import { Button, Card, Notice, Page, styles } from '@/components/native-ui';

export default function Legal() {
  const { t } = useLanguage();
  const operation = useOperation();
  return <Page title={t('Informations légales')} subtitle={t('Consulter les documents SAIWAY')}>
    <Card>
      <Text style={styles.text}>{t('Les documents s’ouvrent sur le site SAIWAY.')}</Text>
      {[
        ['terms', t('Conditions générales')],
        ['privacy', t('Confidentialité')],
        ['cancellation-policy', t('Annulation')],
        ['contact', t('Contacter SAIWAY')],
      ].map(([path, label]) => <Button key={path} title={label} secondary disabled={operation.pending}
        onPress={() => void operation.run(async () => { await Linking.openURL(`${configuredOrigin()}/${path}`); })} />)}
      <Notice error={operation.error} />
    </Card>
  </Page>;
}

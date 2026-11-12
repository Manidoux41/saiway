import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { z } from 'zod';
import { client, configuredOrigin } from '@/lib/api';
import { useApi, useOperation } from '@/hooks/use-api';
import { useLanguage } from '@/providers/language';
import { Button, Card, Field, Notice, confirm, styles } from './native-ui';

const deletionSchema = z.object({ deletion: z.object({ id: z.string(), status: z.string(), createdAt: z.string() }) });
const deletionStatusSchema = deletionSchema.extend({ deletion: deletionSchema.shape.deletion.nullable() });
export function AccountDeletion() {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [reference, setReference] = useState('');
  const operation = useOperation();
  const existing = useApi('/api/account/deletion', deletionStatusSchema);
  const requestId = reference || existing.data?.deletion?.id;
  return <Card>
    <Text style={styles.heading}>{t('Supprimer mon compte et mes données')}</Text>
    <Text style={styles.text}>{t('SAIWAY traitera votre demande après vérification. La demande ne supprime pas immédiatement votre compte. Certains justificatifs de courses et paiements peuvent être conservés pour des obligations légales ou des litiges ; SAIWAY expliquera les exceptions et durées applicables.')}</Text>
    <Field label={t('Mot de passe actuel')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} />
    <Button danger title={t('Demander la suppression de mon compte')} disabled={operation.pending || !password} onPress={() => void operation.run(async () => {
      if (!await confirm(t('Suppression du compte'), t('Confirmer la demande de suppression de votre compte et de vos données auprès de SAIWAY ?'))) return;
      const result = await client().request('/api/account/deletion', deletionSchema, { method: 'POST', body: { password, confirmed: true } });
      setReference(result.deletion.id); setPassword('');
      existing.refresh();
    })} />
    {requestId && <Text style={styles.text}>{t('Référence : {p0}', { p0: requestId })}</Text>}
    <Button secondary title={t('Procédure de suppression sans l’application')} onPress={() => void operation.run(async () => {
      await Linking.openURL(`${configuredOrigin()}/account-deletion`);
    })} />
    <Notice error={operation.error || existing.error} message={reference ? t('Demande enregistrée. SAIWAY vous contactera sur l’email de votre compte.') : ''} />
  </Card>;
}

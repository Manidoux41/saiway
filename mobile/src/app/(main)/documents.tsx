import { useLanguage } from '@/providers/language';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { z } from 'zod';
import { useSession } from '@/providers/session';
import { useApi, useOperation } from '@/hooks/use-api';
import { client, configuredOrigin } from '@/lib/api';
import { contactQrSchema, licenseSchema } from '@/lib/contracts';
import { pickImage } from '@/lib/native-files';
import { PrivateImage } from '@/components/private-image';
import { Button, Card, confirm, Loading, Notice, Page, styles } from '@/components/native-ui';
import { Image } from 'expo-image';

const uploadedSchema = z.object({ image: z.object({ uploadedAt: z.string() }) });
const deletedSchema = z.object({ ok: z.boolean() });
export default function Documents() {
  const { t, dateTime } = useLanguage();
  const { user } = useSession();
  const driver = user?.role === 'driver';
  const license = useApi(driver ? '/api/driver/license' : null, licenseSchema);
  const contact = useApi(driver ? '/api/driver/contact-qr' : null, contactQrSchema);
  const operation = useOperation();
  const licenseData = license.data?.license;
  const contactData = contact.data?.driver;
  if (!driver) return <Redirect href="/(main)/trips" />;
  function uploadLicense(side: 'FRONT' | 'BACK') {
    void operation.run(async () => {
      const form = await pickImage();
      if (!form) return;
      form.append('side', side);
      await client().request('/api/driver/license', uploadedSchema, { method: 'POST', body: form });
      license.refresh();
    });
  }
  return <Page title={t("Mes documents")} refreshing={license.loading || contact.loading} onRefresh={() => { license.refresh(); contact.refresh(); }}>
    <Notice error={license.error || contact.error || operation.error} message={operation.message} />
    {license.loading && !license.data && <Loading />}
    {licenseData && <Card>
      <Text style={styles.heading}>{t("Permis de conduire")}</Text>
      <Text style={styles.text}>{t("N°")}{' '}{licenseData.licenseNo || t("Non renseigné")}</Text>
      <Text style={styles.muted}>{t("Expiration :")}{' '}{licenseData.licenseExpiresAt ? dateTime(licenseData.licenseExpiresAt) : t("Non renseignée")}</Text>
      {(['FRONT', 'BACK'] as const).map(side => {
        const image = licenseData.licenseImages.find(item => item.side === side);
        const label = side === 'FRONT' ? t("Recto du permis") : t("Verso du permis");
        return <Card key={side}><Text style={styles.label}>{label}</Text>
          {image && <PrivateImage key={image.uploadedAt} label={label}
            path={`/api/drivers/${encodeURIComponent(licenseData.id)}/license/${side}?v=${encodeURIComponent(image.uploadedAt)}`} />}
          <Button title={image ? t("Remplacer la photo") : t("Ajouter une photo")} secondary disabled={operation.pending} onPress={() => uploadLicense(side)} />
        </Card>;
      })}
      <Text style={styles.muted}>{t("JPEG, PNG ou WebP, 5 Mo maximum. Les photos sont envoyées uniquement au serveur SAIWAY.")}</Text>
    </Card>}
    {contactData && <Card>
      <Text style={styles.heading}>{t("Mes QR de contact")}</Text>
      {(['WHATSAPP', 'TELEGRAM'] as const).map(channel => {
        const image = contactData.contactQrImages.find(item => item.channel === channel);
        const path = `/api/drivers/${encodeURIComponent(contactData.id)}/contact-qr/${channel}`;
        return <Card key={channel}>
          <Text style={styles.label}>{channel}</Text>
          {image && <PrivateImage key={image.uploadedAt} label={`QR ${channel}`} path={`${path}?v=${encodeURIComponent(image.uploadedAt)}`} />}
          <Button title={image ? t("Remplacer mon QR") : t("Ajouter mon QR")} secondary disabled={operation.pending} onPress={() => void operation.run(async () => {
            const form = await pickImage();
            if (!form) return;
            await client().request(path, uploadedSchema, { method: 'PUT', body: form }); contact.refresh();
          })} />
          {image && <Button title={t("Supprimer mon QR")} danger disabled={operation.pending} onPress={() => void operation.run(async () => {
            if (!await confirm(t("Supprimer ce QR"), t("Confirmer la suppression du QR {p0} ?", { p0: channel }))) return;
            await client().request(path, deletedSchema, { method: 'DELETE' }); contact.refresh();
          })} />}
        </Card>;
      })}
    </Card>}
    <Card>
      <Text style={styles.heading}>{t("QR ABA SAIWAY")}</Text>
      <Image source={{ uri: `${configuredOrigin()}/aba_mobile_1792486034405.png` }} style={{ height: 300, width: '100%' }} contentFit="contain" />
      <Text style={styles.muted}>{t("Le scan du QR ne confirme pas automatiquement le paiement. Vérifiez la réception et enregistrez l’encaissement dans la course.")}</Text>
    </Card>
  </Page>;
}

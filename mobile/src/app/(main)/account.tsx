import { useLanguage } from '@/providers/language';
import { useState } from 'react';
import { router } from 'expo-router';
import { Linking, Text } from 'react-native';
import { useSession } from '@/providers/session';
import { useApi, useOperation } from '@/hooks/use-api';
import { client, configuredOrigin } from '@/lib/api';
import { okSchema, professionalSchema, profileSchema } from '@/lib/contracts';
import { Button, Card, confirm, Field, Notice, Page, styles } from '@/components/native-ui';
import { NotificationSettings } from '@/components/notification-settings';
import { AccountDeletion } from '@/components/account-deletion';

export default function Account() {
  const { t } = useLanguage();
  const session = useSession();
  const customer = session.user?.role === 'customer';
  const profile = useApi(customer ? '/api/account/profile' : null, profileSchema);
  const professional = useApi(customer ? '/api/professionals' : null, professionalSchema);
  const operation = useOperation();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  function save() {
    void operation.run(async () => {
      const details = {
        name: (name ?? profile.data?.name ?? '').trim(),
        phone: (phone ?? profile.data?.phone ?? '').trim(),
        address: (address ?? profile.data?.customer?.address ?? '').trim(),
      };
      if (!details.name) throw new Error(t("Votre nom est obligatoire."));
      const result = await client().request('/api/account/profile', profileSchema, { method: 'PATCH', body: details });
      await session.updateName(result.name); profile.setData(result);
    }, t("Profil enregistré."));
  }
  return <Page title={t("Mon compte")} subtitle={session.user?.email} refreshing={profile.loading} onRefresh={() => { profile.refresh(); professional.refresh(); }}>
    <Card hero><Text style={[styles.heading, { color: '#FFFFFF' }]}>{session.user?.name}</Text>
      <Text style={[styles.text, { color: '#E7EDFF' }]}>{customer ? t("Espace client") : t("Espace chauffeur")}</Text></Card>
    <Notice error={profile.error || professional.error || operation.error} message={operation.message} />
    {customer ? <Card>
      <Text style={styles.heading}>{t("Mes coordonnées")}</Text>
      <Field label={t("Nom complet")} value={name ?? profile.data?.name ?? ''} onChangeText={setName} maxLength={200} editable={Boolean(profile.data)} autoComplete="name" />
      <Field label={t("Téléphone")} value={phone ?? profile.data?.phone ?? ''} onChangeText={setPhone} maxLength={30} keyboardType="phone-pad" editable={Boolean(profile.data)} />
      <Field label={t("Adresse")} value={address ?? profile.data?.customer?.address ?? ''} onChangeText={setAddress} maxLength={500} multiline editable={Boolean(profile.data)} />
      <Button title={t("Enregistrer mon profil")} disabled={operation.pending || !profile.data} onPress={save} />
      <Text style={styles.muted}>{t("Le changement de mot de passe client n’est pas proposé par l’API actuelle.")}</Text>
    </Card> : <Card>
      <Text style={styles.heading}>{t("Changer mon mot de passe")}</Text>
      <Field label={t("Mot de passe actuel")} value={password.currentPassword} onChangeText={value => setPassword(current => ({ ...current, currentPassword: value }))} secureTextEntry autoCapitalize="none" />
      <Field label={t("Nouveau mot de passe")} value={password.newPassword} onChangeText={value => setPassword(current => ({ ...current, newPassword: value }))} secureTextEntry autoCapitalize="none" maxLength={128} />
      <Field label={t("Confirmer le nouveau mot de passe")} value={password.confirmPassword} onChangeText={value => setPassword(current => ({ ...current, confirmPassword: value }))} secureTextEntry autoCapitalize="none" maxLength={128} />
      <Button title={t("Modifier mon mot de passe")} disabled={operation.pending} onPress={() => void operation.run(async () => {
        if (!password.currentPassword || password.newPassword.length < 8 || password.newPassword !== password.confirmPassword || password.newPassword === password.currentPassword) {
          throw new Error(t("Le nouveau mot de passe doit être différent, contenir au moins 8 caractères et être confirmé à l’identique."));
        }
        await client().request('/api/account/password', okSchema, { method: 'POST', body: password });
        setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }, t("Mot de passe modifié."))} />
    </Card>}
    {professional.data?.professional && <Card>
      <Text style={styles.heading}>{t("Compte professionnel")}</Text>
      <Text style={styles.text}>{professional.data.professional.companyName}</Text>
      <Text style={styles.badge}>{t(professional.data.professional.status)}</Text>
      <Text style={styles.muted}>{professional.data.professional.address}</Text>
      <Text style={styles.muted}>{professional.data.professional.contactName} · {professional.data.professional.contactPhone}</Text>
    </Card>}
    <NotificationSettings />
    <Card><Text style={styles.heading}>{t("Informations et assistance")}</Text>
      <Button title={t('Informations légales')} secondary onPress={() => router.push('/legal')} />
      {[['contact', t("Contacter SAIWAY")], ['help', t("Aide")], ['terms', t("Conditions générales")], ['privacy', t("Confidentialité")], ['cancellation-policy', t("Annulation")]].map(([path, label]) =>
        <Button key={path} title={label} secondary onPress={() => void operation.run(async () => { await Linking.openURL(`${configuredOrigin()}/${path}`); })} />)}
      <Text style={styles.muted}>{t("Les notifications peuvent arriver lorsque l’application est fermée. Le GPS ne fonctionne qu’au premier plan : gardez SAIWAY ouvert pendant une course au compteur.")}</Text>
    </Card>
    <AccountDeletion />
    <Button title={t("Se déconnecter")} danger disabled={operation.pending} onPress={() => void operation.run(async () => {
      if (!await confirm(t("Déconnexion"), t("Arrêter le partage GPS et fermer cette session sur cet appareil ?"))) return;
      await session.signOut();
    })} />
  </Page>;
}

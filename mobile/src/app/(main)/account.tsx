import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { useSession } from '@/providers/session';
import { useApi, useOperation } from '@/hooks/use-api';
import { client, configuredOrigin } from '@/lib/api';
import { okSchema, professionalSchema, profileSchema } from '@/lib/contracts';
import { Button, Card, confirm, Field, Notice, Page, styles } from '@/components/native-ui';

export default function Account() {
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
      if (!details.name) throw new Error('Votre nom est obligatoire.');
      const result = await client().request('/api/account/profile', profileSchema, { method: 'PATCH', body: details });
      await session.updateName(result.name); profile.setData(result);
    }, 'Profil enregistré.');
  }
  return <Page title="Mon compte" subtitle={session.user?.email} refreshing={profile.loading} onRefresh={() => { profile.refresh(); professional.refresh(); }}>
    <Card hero><Text style={[styles.heading, { color: '#FFFFFF' }]}>{session.user?.name}</Text>
      <Text style={[styles.text, { color: '#E7EDFF' }]}>{customer ? 'Espace client' : 'Espace chauffeur'}</Text></Card>
    <Notice error={profile.error || professional.error || operation.error} message={operation.message} />
    {customer ? <Card>
      <Text style={styles.heading}>Mes coordonnées</Text>
      <Field label="Nom complet" value={name ?? profile.data?.name ?? ''} onChangeText={setName} maxLength={200} editable={Boolean(profile.data)} autoComplete="name" />
      <Field label="Téléphone" value={phone ?? profile.data?.phone ?? ''} onChangeText={setPhone} maxLength={30} keyboardType="phone-pad" editable={Boolean(profile.data)} />
      <Field label="Adresse" value={address ?? profile.data?.customer?.address ?? ''} onChangeText={setAddress} maxLength={500} multiline editable={Boolean(profile.data)} />
      <Button title="Enregistrer mon profil" disabled={operation.pending || !profile.data} onPress={save} />
      <Text style={styles.muted}>Le changement de mot de passe client n’est pas proposé par l’API actuelle.</Text>
    </Card> : <Card>
      <Text style={styles.heading}>Changer mon mot de passe</Text>
      <Field label="Mot de passe actuel" value={password.currentPassword} onChangeText={value => setPassword(current => ({ ...current, currentPassword: value }))} secureTextEntry autoCapitalize="none" />
      <Field label="Nouveau mot de passe" value={password.newPassword} onChangeText={value => setPassword(current => ({ ...current, newPassword: value }))} secureTextEntry autoCapitalize="none" maxLength={128} />
      <Field label="Confirmer le nouveau mot de passe" value={password.confirmPassword} onChangeText={value => setPassword(current => ({ ...current, confirmPassword: value }))} secureTextEntry autoCapitalize="none" maxLength={128} />
      <Button title="Modifier mon mot de passe" disabled={operation.pending} onPress={() => void operation.run(async () => {
        if (!password.currentPassword || password.newPassword.length < 8 || password.newPassword !== password.confirmPassword || password.newPassword === password.currentPassword) {
          throw new Error('Le nouveau mot de passe doit être différent, contenir au moins 8 caractères et être confirmé à l’identique.');
        }
        await client().request('/api/account/password', okSchema, { method: 'POST', body: password });
        setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }, 'Mot de passe modifié.')} />
    </Card>}
    {professional.data?.professional && <Card>
      <Text style={styles.heading}>Compte professionnel</Text>
      <Text style={styles.text}>{professional.data.professional.companyName}</Text>
      <Text style={styles.badge}>{professional.data.professional.status}</Text>
      <Text style={styles.muted}>{professional.data.professional.address}</Text>
      <Text style={styles.muted}>{professional.data.professional.contactName} · {professional.data.professional.contactPhone}</Text>
    </Card>}
    <Card><Text style={styles.heading}>Informations et assistance</Text>
      {[['contact', 'Contacter SAIWAY'], ['help', 'Aide'], ['terms', 'Conditions générales'], ['privacy', 'Confidentialité'], ['cancellation-policy', 'Annulation']].map(([path, label]) =>
        <Button key={path} title={label} secondary onPress={() => void operation.run(async () => { await Linking.openURL(`${configuredOrigin()}/${path}`); })} />)}
      <Text style={styles.muted}>L’application fonctionne en ligne. Les notifications push natives et le GPS en arrière-plan ne sont pas activés ; gardez l’application au premier plan pendant le service.</Text>
    </Card>
    <Button title="Se déconnecter" danger disabled={operation.pending} onPress={() => void operation.run(async () => {
      if (!await confirm('Déconnexion', 'Arrêter le partage GPS et fermer cette session sur cet appareil ?')) return;
      await session.signOut();
    })} />
  </Page>;
}

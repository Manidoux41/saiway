import { useLanguage } from '@/providers/language';
import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { z } from 'zod';
import { client } from '@/lib/api';
import { Text } from 'react-native';
import { Button, Card, Choices, Field, Loading, Notice, Page, styles } from '@/components/native-ui';
import { useSession } from '@/providers/session';
import { useOperation } from '@/hooks/use-api';

export default function Auth() {
  const { t } = useLanguage();
  const session = useSession();
  const operation = useOperation();
  const [role, setRole] = useState<'customer' | 'driver'>('customer');
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [professional, setProfessional] = useState(false);
  const [company, setCompany] = useState({ companyName: '', category: 'HOTEL', address: '', contactPhone: '' });
  if (!session.ready) return <Page title="SAIWAY"><Loading /></Page>;
  if (session.user) return <Redirect href="/(main)/trips" />;
  function submit() {
    void operation.run(async () => {
      if (!email.trim() || !password || (register && (!name.trim() || password.length < 8))) {
        throw new Error(t("Renseignez votre email, votre mot de passe et, pour l’inscription, votre nom (mot de passe : 8 caractères minimum)."));
      }
      if (register && professional) {
        if (company.companyName.trim().length < 2 || company.address.trim().length < 3 || company.contactPhone.replace(/\D/g, '').length < 8) {
          throw new Error(t("Renseignez le nom, l’adresse et le téléphone de votre établissement."));
        }
        await client().request('/api/professionals', z.object({ status: z.string() }), {
          method: 'POST', body: { ...company, contactName: name.trim(), email: email.trim().toLowerCase(), password },
        });
        await session.signIn({ email, password, role: 'customer' });
      } else await session.signIn({ email, password, role, ...(register ? { name: name.trim() } : {}) }, register);
    });
  }
  return <Page title={t("Votre trajet, en confiance.")} subtitle={t("Aéroport, ville et temples de Siem Reap.")}>
    <Card hero><Text style={[styles.heading, { color: '#FFFFFF' }]}>{t("Bienvenue chez SAIWAY")}</Text>
      <Text style={[styles.text, { color: '#E7EDFF' }]}>{t("Un service local. Une expérience sereine.")}</Text></Card>
    <Card>
      <Choices value={role} disabled={operation.pending} onChange={value => { setRole(value); setRegister(false); }}
        options={[{ value: 'customer', label: t("Espace client") }, { value: 'driver', label: t("Espace chauffeur") }]} />
      <Text style={styles.heading}>{register ? t("Créer mon compte client") : t("Connexion")}</Text>
      {register && <Field label={t("Nom complet")} value={name} onChangeText={setName} autoComplete="name" maxLength={200} />}
      {register && <>
        <Choices value={professional ? 'professional' : 'personal'} onChange={value => setProfessional(value === 'professional')}
          options={[{ value: 'personal', label: t("Particulier") }, { value: 'professional', label: t("Professionnel") }]} />
        {professional && <>
          <Field label={t("Établissement")} value={company.companyName} onChangeText={value => setCompany(current => ({ ...current, companyName: value }))} maxLength={200} />
          <Choices value={company.category} onChange={value => setCompany(current => ({ ...current, category: value }))}
            options={[{ value: 'HOTEL', label: t("Hôtel") }, { value: 'GUESTHOUSE', label: t("Guesthouse") }, { value: 'AGENCY', label: t("Agence") }, { value: 'OTHER', label: t("Autre") }]} />
          <Field label={t("Adresse de l’établissement")} value={company.address} onChangeText={value => setCompany(current => ({ ...current, address: value }))} maxLength={500} />
          <Field label={t("Téléphone professionnel")} value={company.contactPhone} onChangeText={value => setCompany(current => ({ ...current, contactPhone: value }))} keyboardType="phone-pad" maxLength={30} />
          <Text style={styles.muted}>{t("Votre compte doit être approuvé par SAIWAY avant de pouvoir réserver pour vos passagers.")}</Text>
        </>}
      </>}
      <Field label={t("Email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} />
      <Field label={t("Mot de passe")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
        autoComplete={register ? 'new-password' : 'current-password'} maxLength={register ? 128 : 1024} />
      <Notice error={session.error || operation.error} />
      {session.error && <Button title={t("Réessayer la connexion au serveur")} secondary onPress={session.retry} />}
      <Button title={operation.pending ? t("Connexion…") : register ? t("Créer mon compte") : t("Se connecter")} disabled={operation.pending || Boolean(session.error)} onPress={submit} />
      {role === 'customer' && <Button title={register ? t("J’ai déjà un compte") : t("Créer un compte client")} secondary
        disabled={operation.pending} onPress={() => setRegister(!register)} />}
      {role === 'driver' && <Text style={styles.muted}>{t("Votre compte chauffeur est créé par l’administration SAIWAY.")}</Text>}
    </Card>
    <Button title={t("Commander sans compte")} secondary onPress={() => router.push('/guest')} />
    <Button title={t('Informations légales')} secondary onPress={() => router.push('/legal')} />
  </Page>;
}

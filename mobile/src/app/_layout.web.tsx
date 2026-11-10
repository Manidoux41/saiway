import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, Notice, Page, styles } from '@/components/native-ui';
import { apiOrigin } from '@/lib/transport';

export default function WebLayout() {
  const [error, setError] = useState('');
  async function openApp(expoGo = false) {
    setError('');
    try {
      const url = expoGo ? `${window.location.protocol === 'https:' ? 'exps' : 'exp'}://${window.location.host}` : 'saiway://';
      await Linking.openURL(url);
    } catch {
      setError('Impossible d’ouvrir l’application. Installez SAIWAY ou utilisez Expo Go avec le QR code du terminal.');
    }
  }
  async function openWebsite() {
    setError('');
    try {
      await Linking.openURL(apiOrigin(process.env.EXPO_PUBLIC_API_URL ?? '', __DEV__));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Impossible d’ouvrir le site SAIWAY.');
    }
  }
  return <SafeAreaProvider><StatusBar style="dark" />
    <Page title="SAIWAY sur votre téléphone" subtitle="Votre application client et chauffeur pour Android et iOS.">
      <Card>
        <Text style={styles.heading}>Ouvrir l’application native</Text>
        <Text style={styles.text}>Cette page vous permet de lancer SAIWAY sur votre téléphone. La connexion, les réservations et le GPS s’utilisent dans l’application Android ou iOS.</Text>
        <Button title="Ouvrir SAIWAY" onPress={() => void openApp()} />
        <Text style={styles.muted}>Ce bouton nécessite une version SAIWAY installée. Si rien ne s’ouvre, utilisez Expo Go pendant le développement.</Text>
      </Card>
      {__DEV__ && <Card>
        <Text style={styles.heading}>Tester avec Expo Go</Text>
        <Text style={styles.text}>Sur téléphone, installez Expo Go SDK 58, puis scannez le QR code affiché par « npm start » dans le terminal. Le téléphone et l’ordinateur doivent partager le même réseau Wi-Fi.</Text>
        <Button title="Ouvrir dans Expo Go sur ce téléphone" secondary onPress={() => void openApp(true)} />
        <Text style={styles.muted}>Sur ordinateur, utilisez le QR code du terminal ou lancez « npm run ios » / « npm run android » pour un simulateur.</Text>
      </Card>}
      <Card>
        <Text style={styles.heading}>Continuer dans le navigateur</Text>
        <Text style={styles.text}>Le site SAIWAY existant reste votre interface web complète.</Text>
        <Button title="Accéder au site SAIWAY" secondary onPress={() => void openWebsite()} />
      </Card>
      <View accessibilityLiveRegion="polite"><Notice error={error} /></View>
    </Page>
  </SafeAreaProvider>;
}

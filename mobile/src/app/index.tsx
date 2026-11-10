import { Redirect } from 'expo-router';
import { Button, Card, Loading, Notice, Page } from '@/components/native-ui';
import { useSession } from '@/providers/session';
import { useOperation } from '@/hooks/use-api';

export default function Index() {
  const session = useSession();
  const operation = useOperation();
  if (!session.ready) return <Page title="Bienvenue"><Loading /></Page>;
  if (session.error) return <Page title="Connexion au serveur">
    <Card>
      <Notice error={session.error} />
      <Button title="Réessayer" onPress={session.retry} />
      <Button title="Déconnecter la session" secondary disabled={operation.pending}
        onPress={() => void operation.run(session.signOut)} />
      <Notice error={operation.error} />
    </Card>
  </Page>;
  return <Redirect href={session.user ? '/(main)/trips' : '/auth'} />;
}

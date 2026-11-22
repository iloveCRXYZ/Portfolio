import { router } from 'expo-router';
import { Screen, Gap, Button, EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Gap h={80} />
      <EmptyState icon="explore-off" title="This page doesn't exist" body="The link may be old or mistyped." actions={<Button title="Go home" onPress={() => router.replace('/')} />} />
    </Screen>
  );
}

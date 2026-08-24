import { EmptyState } from '../components/EmptyState';

export function Stub({ label }: { label: string }) {
  return (
    <EmptyState
      icon="barricade"
      title={`${label} is the next milestone`}
      body="This route is ready for the persisted review workflow in the approved completion plan."
    />
  );
}

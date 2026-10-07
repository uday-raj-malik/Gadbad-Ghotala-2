import PageHeader from '@/components/ui/PageHeader';
import RecoveryPlanner from '@/components/recovery/RecoveryPlanner';

export default function RecoveryPage() {
  return (
    <>
      <PageHeader title="Recovery Mission Planner" description="Turn verified detections into a sequenced recovery run from the Mumbai Port jetty to the waste handling quay." />
      <RecoveryPlanner />
    </>
  );
}


import type { FC } from 'react';
import { Suspense } from 'react';
import { ReelsPageSkeleton } from '@/components/reels-page-skeleton';
import ReelsViewer from '@/components/reels-viewer';
import { getSession } from '../auth/actions';

export const dynamic = 'force-dynamic';

// This component can now be simplified as the ReelsViewer fetches its own data.
async function ReelsLoader() {
  const { user: sessionUser } = await getSession();

  // ReelsViewer will now handle its own data fetching.
  return <ReelsViewer sessionUser={sessionUser} />;
}

const ReelsPage: FC = () => {
  return (
    <Suspense fallback={<ReelsPageSkeleton />}>
      <ReelsLoader />
    </Suspense>
  );
};

export default ReelsPage;


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
    // This div ensures the ReelsViewer has a container with a defined height
    // that fills the viewport below the sticky headers (each is h-14, total 7rem).
    <div className="h-[calc(100svh-7rem)]">
        <Suspense fallback={<ReelsPageSkeleton />}>
          <ReelsLoader />
        </Suspense>
    </div>
  );
};

export default ReelsPage;

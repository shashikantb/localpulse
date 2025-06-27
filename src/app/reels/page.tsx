
import type { FC } from 'react';
import { Suspense } from 'react';
import { getMediaPosts } from '@/app/actions';
import { ReelsPageSkeleton } from '@/components/reels-page-skeleton';
import ReelsViewer from '@/components/reels-viewer';
import { getSession } from '../auth/actions';

const REELS_PER_PAGE = 10;

async function ReelsLoader() {
  // Fetch the first page of reel posts on the server
  const [initialPosts, { user: sessionUser }] = await Promise.all([
    getMediaPosts({ page: 1, limit: REELS_PER_PAGE }),
    getSession()
  ]);

  // Pass the pre-fetched posts to the client component
  return <ReelsViewer initialPosts={initialPosts} sessionUser={sessionUser} />;
}

const ReelsPage: FC = () => {
  return (
    <Suspense fallback={<ReelsPageSkeleton />}>
      <ReelsLoader />
    </Suspense>
  );
};

export default ReelsPage;

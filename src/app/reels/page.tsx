
import type { FC } from 'react';
import { Suspense } from 'react';
import { getMediaPosts } from '@/app/actions';
import { ReelsPageSkeleton } from '@/components/reels-page-skeleton';
import ReelsViewer from '@/components/reels-viewer';

const REELS_PER_PAGE = 10;

async function ReelsLoader() {
  // Fetch the first page of reel posts on the server
  const initialPosts = await getMediaPosts({ page: 1, limit: REELS_PER_PAGE });

  // Pass the pre-fetched posts to the client component
  return <ReelsViewer initialPosts={initialPosts} />;
}

const ReelsPage: FC = () => {
  return (
    <Suspense fallback={<ReelsPageSkeleton />}>
      <ReelsLoader />
    </Suspense>
  );
};

export default ReelsPage;

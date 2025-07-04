
import type { FC } from 'react';
import { Suspense } from 'react';
import { getSession } from './auth/actions';
import PostComposerLoader, { PostComposerSkeleton } from '@/components/post-composer-loader';
import PostFeedLoader from '@/components/post-feed-loader';
import StatusFeed from '@/components/status-feed';
import { StatusFeedSkeleton } from '@/components/status-feed-skeleton';

// This new component fetches the session data for the composer inside a Suspense boundary.
async function PostComposerWithSession() {
  const { user } = await getSession();
  return <PostComposerLoader sessionUser={user} />;
}

async function StatusFeedWithSession() {
  const { user } = await getSession();
  return <StatusFeed sessionUser={user} />;
}


const HomePage: FC = () => {
  return (
    <div className="flex flex-col items-center">
      <div className="container mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6 md:p-8">
        
        <Suspense fallback={<StatusFeedSkeleton />}>
          <StatusFeedWithSession />
        </Suspense>

        <Suspense fallback={<PostComposerSkeleton />}>
          <PostComposerWithSession />
        </Suspense>
        
        {/* The "Nearby Pulses" heading is now managed inside the PostFeedLoader/PostFeedClient component */}
        <PostFeedLoader />
      </div>
    </div>
  );
};

export default HomePage;

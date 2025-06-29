
import type { FC } from 'react';
import { Suspense } from 'react';
import PostFeedClient from '@/components/post-feed-client';
import type { Post } from '@/lib/db-types';
import { getSession } from './auth/actions';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import { Rss } from 'lucide-react';
import PostComposerLoader, { PostComposerSkeleton } from '@/components/post-composer-loader';

const POSTS_PER_PAGE = 5;

// This async component will be wrapped in Suspense.
// It now only fetches the user session.
async function FeedLoader() {
  const { user } = await getSession();
  // By passing an empty array, we force the client to fetch the initial data.
  // This makes the initial server-rendered page much smaller and faster.
  return <PostFeedClient initialPosts={[]} sessionUser={user} />;
}

// This new component fetches the session data for the composer inside a Suspense boundary.
async function PostComposerWithSession() {
  const { user } = await getSession();
  return <PostComposerLoader sessionUser={user} />;
}


const HomePage: FC = () => { // This component is now static, no longer async
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        
        {/* The PostComposer is now wrapped in its own Suspense boundary */}
        <Suspense fallback={<PostComposerSkeleton />}>
          <PostComposerWithSession />
        </Suspense>
        
        <div className="border-b-2 border-primary/30 pb-3">
            <h2 className="text-4xl font-bold text-primary pl-1 flex items-center">
                <Rss className="w-9 h-9 mr-3 text-accent opacity-90" />
                Nearby Pulses
            </h2>
        </div>

        {/* The PostFeed remains in its Suspense boundary */}
        <Suspense fallback={<PostFeedSkeleton />}>
          <FeedLoader />
        </Suspense>
      </div>
    </main>
  );
};

export default HomePage;

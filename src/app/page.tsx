import type { FC } from 'react';
import { Suspense } from 'react';
import { getSession } from './auth/actions';
import PostComposerLoader, { PostComposerSkeleton } from '@/components/post-composer-loader';
import PostFeedLoader from '@/components/post-feed-loader';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import StatusFeed from '@/components/status-feed';
import { StatusFeedSkeleton } from '@/components/status-feed-skeleton';
import { getPosts } from './actions';
import type { Post } from '@/lib/db-types';

export const revalidate = 20; // Revalidate every 20 seconds

async function PostComposerWithSession() {
  const { user } = await getSession();
  return <PostComposerLoader sessionUser={user} />;
}

async function StatusFeedWithSession() {
  const { user } = await getSession();
  return <StatusFeed sessionUser={user} />;
}

async function PostFeedWithInitialData() {
  const { user } = await getSession();
  // Fetch the first page of posts on the server.
  // Location is not available on the server, so we fetch the newest posts globally.
  // The client component will then re-fetch if location becomes available.
  const initialPosts: Post[] = await getPosts({ page: 1, limit: 5, sortBy: 'newest' });
  return <PostFeedLoader sessionUser={user} initialPosts={initialPosts} />;
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
        
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeedWithInitialData />
        </Suspense>
      </div>
    </div>
  );
};

export default HomePage;

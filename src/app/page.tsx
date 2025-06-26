
import type { FC } from 'react';
import { Suspense } from 'react';
import { getPosts } from './actions';
import PostFeedClient from '@/components/post-feed-client';
import type { Post } from '@/lib/db-types';
import { getSession } from './auth/actions';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';

const POSTS_PER_PAGE = 5;

// This new async component will be wrapped in Suspense.
// It fetches the data, and its rendering is deferred until the data is ready.
async function FeedLoader() {
  const { user } = await getSession();
  let initialPosts: Post[] = [];

  try {
    initialPosts = await getPosts({ page: 1, limit: POSTS_PER_PAGE });
  } catch (error) {
    console.error("Error fetching initial posts for server component:", error);
    // In case of an error, we'll render the component with an empty array.
    // The component itself can then show an error message.
    initialPosts = [];
  }
  
  return <PostFeedClient initialPosts={initialPosts} sessionUser={user} />;
}


const HomePage: FC = async () => {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <Suspense fallback={<PostFeedSkeleton />}>
          <FeedLoader />
        </Suspense>
      </div>
    </main>
  );
};

export default HomePage;

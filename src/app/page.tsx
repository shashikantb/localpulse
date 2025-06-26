
import type { FC } from 'react';
import { getPosts } from './actions';
import PostFeedClient from '@/components/post-feed-client';
import type { Post } from '@/lib/db-types';
import { getSession } from './auth/actions';

const POSTS_PER_PAGE = 5;

const HomePage: FC = async () => {
  const { user } = await getSession();
  let initialPosts: Post[] = [];

  try {
    initialPosts = await getPosts({ page: 1, limit: POSTS_PER_PAGE });
  } catch (error) {
    console.error("Error fetching initial posts for server component:", error);
    initialPosts = [];
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <PostFeedClient initialPosts={initialPosts} sessionUser={user} />
      </div>
    </main>
  );
};

export default HomePage;


'use client';

import dynamic from 'next/dynamic';
import { PostFeedSkeleton } from './post-feed-skeleton';

const PostFeedClient = dynamic(() => import('@/components/post-feed-client'), {
  ssr: false,
  loading: () => <PostFeedSkeleton />,
});

// This loader component now correctly uses dynamic import with ssr:false in a client boundary.
export default function PostFeedLoader() {
  // initialPosts will now be fetched inside PostFeedClient itself.
  return <PostFeedClient initialPosts={[]} />;
}

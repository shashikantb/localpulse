
'use client';

import dynamic from 'next/dynamic';
import type { User } from '@/lib/db-types';
import { PostFeedSkeleton } from './post-feed-skeleton';

const PostFeedClient = dynamic(() => import('@/components/post-feed-client'), {
  ssr: false,
  loading: () => <PostFeedSkeleton />,
});

interface PostFeedLoaderProps {
  sessionUser: User | null;
}

export default function PostFeedLoader({ sessionUser }: PostFeedLoaderProps) {
  return <PostFeedClient sessionUser={sessionUser} />;
}

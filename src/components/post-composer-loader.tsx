
'use client';

import type { FC } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap } from 'lucide-react';
import type { User } from '@/lib/db-types';

export const PostComposerSkeleton = () => (
  <Card className="overflow-hidden shadow-2xl border border-primary/30 rounded-xl bg-card/90 backdrop-blur-md">
    <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/5 p-5">
      <div className="flex items-center">
        <Zap className="w-7 h-7 mr-2 text-accent drop-shadow-sm" />
        <Skeleton className="h-7 w-48" />
      </div>
       <Skeleton className="h-4 w-36 mt-1" />
    </CardHeader>
    <CardContent className="p-5 space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-12 w-full" />
    </CardContent>
  </Card>
);

const PostComposer = dynamic(() => import('@/components/post-composer'), {
  ssr: false,
  loading: () => <PostComposerSkeleton />,
});

interface PostComposerLoaderProps {
    sessionUser: User | null;
}

const PostComposerLoader: FC<PostComposerLoaderProps> = ({ sessionUser }) => {
    return <PostComposer sessionUser={sessionUser} />;
}

export default PostComposerLoader;

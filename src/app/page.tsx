
import type { FC } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from './auth/actions';
import PostComposerLoader, { PostComposerSkeleton } from '@/components/post-composer-loader';
import PostFeedLoader from '@/components/post-feed-loader';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import StatusFeed from '@/components/status-feed';
import { StatusFeedSkeleton } from '@/components/status-feed-skeleton';
import { getPosts } from './actions';
import { Button } from '@/components/ui/button';
import { Map, Sparkles } from 'lucide-react';

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
  const initialPosts = await getPosts({ page: 1, limit: 5 });
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

        <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" asChild className="h-16 text-base shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300">
                <Link href="/map">
                    <Map className="mr-3 h-6 w-6 text-primary"/>
                    Live Map
                </Link>
            </Button>
            <Button variant="outline" asChild className="h-16 text-base shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300">
                <Link href="/helper">
                    <Sparkles className="mr-3 h-6 w-6 text-accent"/>
                    AI Helper
                </Link>
            </Button>
        </div>
        
        <Suspense fallback={<PostFeedSkeleton />}>
          <PostFeedWithInitialData />
        </Suspense>
      </div>
    </div>
  );
};

export default HomePage;

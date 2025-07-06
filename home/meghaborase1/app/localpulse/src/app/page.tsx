
import type { FC } from 'react';
import { Suspense } from 'react';
import { getSession } from '@/app/auth/actions';
import PostComposerLoader, { PostComposerSkeleton } from '@/components/post-composer-loader';
import PostFeedLoader from '@/components/post-feed-loader';
import StatusFeed from '@/components/status-feed';
import { StatusFeedSkeleton } from '@/components/status-feed-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from '@/components/ui/card';
import { Users } from 'lucide-react';

// This new component fetches the session data for the composer inside a Suspense boundary.
async function PostComposerWithSession() {
  const { user } = await getSession();
  return <PostComposerLoader sessionUser={user} />;
}

async function StatusFeedWithSession() {
  const { user } = await getSession();
  return <StatusFeed sessionUser={user} />;
}


const HomePage: FC = async () => {
  const { user } = await getSession();

  return (
    <div className="flex flex-col items-center">
      <div className="container mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6 md:p-8">
        
        <Suspense fallback={<StatusFeedSkeleton />}>
          <StatusFeedWithSession />
        </Suspense>

        <Suspense fallback={<PostComposerSkeleton />}>
          <PostComposerWithSession />
        </Suspense>
        
        <Tabs defaultValue="public" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="public">Nearby Pulses</TabsTrigger>
            <TabsTrigger value="family" disabled={!user}>Family Pulses</TabsTrigger>
          </TabsList>
          <TabsContent value="public" className="pt-4">
            <PostFeedLoader feedType="public" />
          </TabsContent>
          <TabsContent value="family" className="pt-4">
            {user ? (
              <PostFeedLoader feedType="family" />
            ) : (
              <Card className="text-center p-8 text-muted-foreground mt-4">
                <Users className="mx-auto h-12 w-12 mb-4" />
                <p className="font-semibold">Log in to view family posts.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default HomePage;

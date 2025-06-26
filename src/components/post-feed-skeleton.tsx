
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const PostFeedSkeleton = () => {
  return (
    <div className="space-y-8">
      {/* Skeleton for PostForm */}
      <Card className="overflow-hidden shadow-2xl border border-primary/30 rounded-xl">
        <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/5 p-5">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-5 w-64 rounded-md mt-2" />
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="flex justify-end">
            <Skeleton className="h-12 w-48 rounded-lg" />
          </div>
        </CardContent>
      </Card>
      
      {/* Skeletons for PostCards */}
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="overflow-hidden shadow-xl rounded-xl">
          <CardHeader className="flex flex-row items-start space-x-4 p-5">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
             <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg mt-4">
                <Skeleton className="h-full w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

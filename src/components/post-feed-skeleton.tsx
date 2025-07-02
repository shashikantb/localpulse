import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const PostFeedSkeleton = () => {
  return (
    <div className="space-y-8 pt-4">
      {/* Skeleton for filter bar to prevent CLS */}
      <div className="flex justify-end items-center mb-4 px-1 gap-2 h-10">
        <Skeleton className="h-full w-[150px]" />
        <Skeleton className="h-full w-[100px]" />
      </div>

      {/* Skeletons for PostCards */}
      {[...Array(2)].map((_, i) => (
        <Card key={i} className="overflow-hidden shadow-xl rounded-xl">
          <CardHeader className="flex flex-row items-start space-x-4 p-5">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

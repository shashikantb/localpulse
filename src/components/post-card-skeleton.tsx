
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const PostCardSkeleton = () => {
  return (
    <Card className="overflow-hidden shadow-xl rounded-xl">
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
        <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg mt-4">
          <Skeleton className="h-full w-full" />
        </div>
      </CardContent>
    </Card>
  );
};

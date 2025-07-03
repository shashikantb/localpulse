
import { Skeleton } from '@/components/ui/skeleton';

export const StatusFeedSkeleton = () => (
  <div className="py-4 border-b">
    <div className="flex space-x-4 p-2 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex flex-col items-center space-y-2 flex-shrink-0">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  </div>
);

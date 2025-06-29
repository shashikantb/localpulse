
import { Skeleton } from './ui/skeleton';

export const ReelCommentsSkeleton = () => (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/80 backdrop-blur-md rounded-t-lg max-h-[40%] overflow-y-auto z-20 flex flex-col">
        <div className="flex justify-between items-center mb-2 flex-shrink-0">
            <Skeleton className="h-5 w-24 bg-gray-700/50" />
            <Skeleton className="h-7 w-7 rounded-full bg-gray-700/50" />
        </div>
        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
            <Skeleton className="h-10 w-full bg-gray-700/50" />
            <Skeleton className="h-10 w-full bg-gray-700/50" />
            <Skeleton className="h-10 w-full bg-gray-700/50" />
        </div>
        <div className="mt-3 pt-3 border-t border-white/20 flex-shrink-0">
            <Skeleton className="h-8 w-full bg-gray-700/50" />
        </div>
    </div>
);

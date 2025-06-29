
import { Loader2 } from 'lucide-react';

export const ReelsPageSkeleton = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-svh bg-black text-white p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg">Loading Reels...</p>
    </div>
  );
};

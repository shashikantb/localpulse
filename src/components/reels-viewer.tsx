
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Post } from '@/lib/db-types';
import { getMediaPosts } from '@/app/actions';
import { ReelItem } from '@/components/reel-item';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Home, Loader2, Film } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSwipeable } from 'react-swipeable';

const REELS_PER_PAGE = 10;

interface ReelsViewerProps {
  initialPosts: Post[];
}

const ReelsViewer: FC<ReelsViewerProps> = ({ initialPosts }) => {
  const { toast } = useToast();
  const router = useRouter();
  const [reelPosts, setReelPosts] = useState<Post[]>(initialPosts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // Only for loading *more* posts
  const [currentPage, setCurrentPage] = useState(2); // Start at page 2, since page 1 is preloaded
  const [hasMore, setHasMore] = useState(initialPosts.length === REELS_PER_PAGE);

  const fetchReelPosts = useCallback(async (page: number) => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const newPosts = await getMediaPosts({ page, limit: REELS_PER_PAGE });

      if (newPosts.length > 0) {
        setReelPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNewPosts = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNewPosts];
        });
        setCurrentPage(page + 1);
        if (newPosts.length < REELS_PER_PAGE) {
            setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more posts for reels:", error);
      toast({
        variant: "destructive",
        title: "Fetch Error",
        description: "Could not load more reels. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, isLoading, hasMore]);

  // Fetch more posts when user gets close to the end of the current list.
  useEffect(() => {
    if (hasMore && !isLoading && reelPosts.length > 0 && currentIndex >= reelPosts.length - 3) {
      fetchReelPosts(currentPage);
    }
  }, [currentIndex, reelPosts.length, hasMore, isLoading, currentPage, fetchReelPosts]);

  const goToPreviousReel = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : 0));
  }, []);

  const goToNextReel = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex < reelPosts.length - 1 ? prevIndex + 1 : prevIndex));
  }, [reelPosts.length]);

  const swipeHandlers = useSwipeable({
    onSwipedUp: () => {
      if (reelPosts.length > 1) goToNextReel();
    },
    onSwipedDown: () => {
       if (reelPosts.length > 1) goToPreviousReel();
    },
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        goToNextReel();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        goToPreviousReel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextReel, goToPreviousReel]);
  
  useEffect(() => {
      if (initialPosts.length === 0) {
        toast({
          variant: "default",
          title: "No Reels Yet",
          description: "There are no image or video posts to show in Reels right now.",
          duration: 5000,
        });
      }
  }, [initialPosts, toast]);

  if (reelPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 text-center">
        <Film className="h-20 w-20 text-muted-foreground mb-6" />
        <AlertTitle className="text-2xl font-semibold mb-2">No Reels to Show</AlertTitle>
        <AlertDescription className="text-base text-muted-foreground mb-8">
          It looks like there are no image or video posts available right now.
        </AlertDescription>
        <Button asChild variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary">
          <Link href="/">
            <Home className="mr-2 h-5 w-5" />
            Back to Main Feed
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div {...swipeHandlers} className="h-screen w-screen overflow-hidden flex flex-col bg-black touch-none">
      <div className="absolute top-0 left-0 z-30 p-4">
        <Button
          onClick={() => router.push('/')}
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full"
          aria-label="Back to Feed"
        >
          <Home className="h-6 w-6" />
        </Button>
      </div>
      
      <div className="flex-grow relative w-full h-full overflow-hidden">
        {reelPosts.map((post, index) => {
            // Only render the current, previous, and next items to optimize performance
            if (Math.abs(index - currentIndex) > 1) {
                return null;
            }

            const getTransform = () => {
                if (index < currentIndex) return 'translateY(-100%)';
                if (index > currentIndex) return 'translateY(100%)';
                return 'translateY(0)';
            };

            return (
                <div
                    key={post.id}
                    className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out"
                    style={{ 
                        transform: getTransform(),
                        zIndex: index === currentIndex ? 20 : 10,
                     }}
                >
                    <ReelItem
                        post={post}
                        isActive={index === currentIndex}
                    />
                </div>
            );
        })}

        {isLoading && currentIndex >= reelPosts.length - 1 && hasMore && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                <Loader2 className="w-10 h-10 animate-spin text-white"/>
            </div>
        )}
      </div>

      {reelPosts.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-between items-center p-3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none">
          <Button 
            onClick={goToPreviousReel} 
            variant="ghost" 
            size="lg" 
            className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full p-3 disabled:opacity-50 pointer-events-auto"
            aria-label="Previous Reel"
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
          
          <div className="text-xs text-white/80 bg-black/30 px-2 py-1 rounded-md backdrop-blur-sm flex items-center">
            {isLoading && hasMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>{currentIndex + 1} / {reelPosts.length}</span>
            )}
          </div>
          
          <Button 
            onClick={goToNextReel} 
            variant="ghost" 
            size="lg" 
            className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full p-3 disabled:opacity-50 pointer-events-auto"
            aria-label="Next Reel"
            disabled={currentIndex === reelPosts.length - 1 && !hasMore}
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReelsViewer;

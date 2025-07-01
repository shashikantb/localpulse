
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Post, User } from '@/lib/db-types';
import { getMediaPosts } from '@/app/actions';
import { ReelItem } from '@/components/reel-item';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Home, Loader2, Film } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { AlertDescription, AlertTitle, Alert } from '@/components/ui/alert';
import { useSwipeable } from 'react-swipeable';
import { ReelsPageSkeleton } from './reels-page-skeleton';

const REELS_PER_PAGE = 10;

interface ReelsViewerProps {
  sessionUser: User | null;
}

const ReelsViewer: FC<ReelsViewerProps> = ({ sessionUser }) => {
  const { toast } = useToast();
  const router = useRouter();
  const [reelPosts, setReelPosts] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [isLoadingMore, setIsLoadingMore] = useState(false); // For subsequent "infinite scroll" loads
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Effect for fetching the very first set of reels
  useEffect(() => {
    const fetchInitialReels = async () => {
      setIsLoading(true);
      try {
        const newPosts = await getMediaPosts({ page: 1, limit: REELS_PER_PAGE });
        setReelPosts(newPosts);
        setHasMore(newPosts.length === REELS_PER_PAGE);
      } catch (error) {
        console.error("Error fetching initial reels:", error);
        toast({
          variant: "destructive",
          title: "Fetch Error",
          description: "Could not load reels.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialReels();
  }, [toast]);


  const fetchMoreReelPosts = useCallback(async (page: number) => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const newPosts = await getMediaPosts({ page, limit: REELS_PER_PAGE });

      if (newPosts.length > 0) {
         setReelPosts(prev => {
          // Append new posts, avoiding duplicates
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNewPosts = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNewPosts];
        });
        setCurrentPage(page);
        setHasMore(newPosts.length === REELS_PER_PAGE);
      } else {
        setHasMore(false);
        if (reelPosts.length > 0) {
            toast({title: "That's all for now!", description: "You've seen all the available reels."});
        }
      }
    } catch (error) {
      console.error("Error fetching more posts for reels:", error);
      toast({
        variant: "destructive",
        title: "Fetch Error",
        description: "Could not load more reels.",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [toast, isLoadingMore, hasMore, reelPosts.length]);
  

  // Fetch more posts when user gets close to the end of the current list.
  useEffect(() => {
    if (hasMore && !isLoading && !isLoadingMore && reelPosts.length > 0 && currentIndex >= reelPosts.length - 3) {
      fetchMoreReelPosts(currentPage + 1);
    }
  }, [currentIndex, reelPosts.length, hasMore, isLoading, isLoadingMore, currentPage, fetchMoreReelPosts]);

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
  
  if (isLoading) {
    return <ReelsPageSkeleton />;
  }
  
  if (reelPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-svh bg-black text-white p-4 text-center">
        <Alert className="max-w-md bg-gray-900/80 border-gray-700 text-white">
          <Film className="h-5 w-5 text-primary" />
          <AlertTitle className="text-xl font-semibold mb-2">No Reels to Show</AlertTitle>
          <AlertDescription className="text-base text-gray-300 mb-6">
            It looks like there are no image or video posts available right now. Create one from the main feed!
          </AlertDescription>
           <Button asChild variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary w-full">
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Back to Main Feed
            </Link>
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div {...swipeHandlers} className="h-svh w-screen overflow-hidden flex flex-col bg-black touch-none">
      <div className="absolute top-4 left-4 z-30">
        <Button
          onClick={() => router.push('/')}
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full h-11 w-11"
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
                        sessionUser={sessionUser}
                    />
                </div>
            );
        })}

        {isLoadingMore && hasMore && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                <Loader2 className="w-10 h-10 animate-spin text-white"/>
            </div>
        )}
      </div>

      {reelPosts.length > 1 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
          <Button 
            onClick={goToPreviousReel} 
            variant="ghost" 
            size="icon"
            className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full h-11 w-11 disabled:opacity-30 pointer-events-auto"
            aria-label="Previous Reel"
            disabled={currentIndex === 0}
          >
            <ChevronUp className="h-7 w-7" />
          </Button>
          
          <div className="text-xs text-white/80 bg-black/30 px-2 py-1 rounded-md backdrop-blur-sm flex items-center pointer-events-auto">
            {isLoadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>{currentIndex + 1} / {reelPosts.length}</span>
            )}
          </div>
          
          <Button 
            onClick={goToNextReel} 
            variant="ghost" 
            size="icon"
            className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full h-11 w-11 disabled:opacity-30 pointer-events-auto"
            aria-label="Next Reel"
            disabled={currentIndex === reelPosts.length - 1 && !hasMore}
          >
            <ChevronDown className="h-7 w-7" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReelsViewer;

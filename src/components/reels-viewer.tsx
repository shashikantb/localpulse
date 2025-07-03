
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Post, User } from '@/lib/db-types';
import { getMediaPosts } from '@/app/actions';
import { ReelItem } from '@/components/reel-item';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Loader2, Film } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { AlertDescription, AlertTitle, Alert } from '@/components/ui/alert';
import { useSwipeable } from 'react-swipeable';
import { ReelsPageSkeleton } from './reels-page-skeleton';

const REELS_PER_PAGE = 10;
const REELS_CACHE_KEY = 'localpulse-reels-cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CachedReels {
  timestamp: number;
  posts: Post[];
  hasMore: boolean;
  currentPage: number;
}

const ReelsViewer: FC<{ sessionUser: User | null }> = ({ sessionUser }) => {
  const { toast } = useToast();
  const router = useRouter();
  
  const [reelPosts, setReelPosts] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Function to save data to cache
  const saveToCache = useCallback((posts: Post[], page: number, more: boolean) => {
    try {
      const cacheData: CachedReels = {
        timestamp: Date.now(),
        posts: posts,
        currentPage: page,
        hasMore: more,
      };
      localStorage.setItem(REELS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Failed to save reels to cache:", error);
    }
  }, []);

  // Function to fetch posts, which will be used for both initial load and revalidation
  const fetchAndCacheReels = useCallback(async (page: number, append: boolean = false) => {
    if (!append) { // If it's a refresh/revalidation, not loading more
       setIsLoading(true);
    } else { // If it's for "infinite scroll"
       if (isLoadingMore || !hasMore) return;
       setIsLoadingMore(true);
    }

    try {
      const newPosts = await getMediaPosts({ page, limit: REELS_PER_PAGE });
      
      setReelPosts(prev => {
        const updatedPosts = append ? [...prev, ...newPosts.filter(p => !prev.some(ep => ep.id === p.id))] : newPosts;
        saveToCache(updatedPosts, page, newPosts.length === REELS_PER_PAGE);
        return updatedPosts;
      });

      setCurrentPage(page);
      setHasMore(newPosts.length === REELS_PER_PAGE);

      if (append && newPosts.length === 0) {
        toast({ title: "That's all for now!", description: "You've seen all the available reels." });
      }

    } catch (error) {
      console.error("Error fetching reels:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [toast, saveToCache, isLoadingMore, hasMore]);


  // Effect for initial load and revalidation logic (Stale-While-Revalidate)
  useEffect(() => {
    let isMounted = true;
    
    // 1. Load from cache immediately
    try {
      const cachedItem = localStorage.getItem(REELS_CACHE_KEY);
      if (cachedItem) {
        const cachedData: CachedReels = JSON.parse(cachedItem);
        const isCacheStale = (Date.now() - cachedData.timestamp) > CACHE_EXPIRY_MS;
        
        if (cachedData.posts.length > 0) {
            setReelPosts(cachedData.posts);
            setCurrentPage(cachedData.currentPage);
            setHasMore(cachedData.hasMore);
            setIsLoading(false); // We have something to show, so stop initial loading state
        }
        
        // 2. Revalidate in the background if cache is stale
        if (isCacheStale) {
          console.log("Reels cache is stale, revalidating in background...");
          fetchAndCacheReels(1, false);
        }
      } else {
         // No cache, so fetch fresh data
         fetchAndCacheReels(1, false);
      }
    } catch (error) {
      console.warn("Failed to read cache, fetching fresh data.", error);
      fetchAndCacheReels(1, false);
    }

    // 3. Revalidate on focus
    const handleRevalidate = () => {
      if (isMounted && !document.hidden) {
        console.log("Tab is focused, checking for stale reels data...");
        fetchAndCacheReels(1, false);
      }
    };
    window.addEventListener('visibilitychange', handleRevalidate);

    return () => {
      isMounted = false;
      window.removeEventListener('visibilitychange', handleRevalidate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty to run only once on mount

  
  // Effect to fetch more posts when user gets close to the end
  useEffect(() => {
    if (hasMore && !isLoading && !isLoadingMore && reelPosts.length > 0 && currentIndex >= reelPosts.length - 3) {
      fetchAndCacheReels(currentPage + 1, true);
    }
  }, [currentIndex, reelPosts.length, hasMore, isLoading, isLoadingMore, currentPage, fetchAndCacheReels]);


  const goToPreviousReel = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : 0));
  }, []);

  const goToNextReel = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex < reelPosts.length - 1 ? prevIndex + 1 : prevIndex));
  }, [reelPosts.length]);
  
  const handleRefresh = () => {
    if (isLoading) return;
    toast({ title: 'Refreshing Reels...', description: 'Fetching the latest content.' });
    fetchAndCacheReels(1, false);
  };

  const swipeHandlers = useSwipeable({
    onSwipedUp: () => { if (reelPosts.length > 1) goToNextReel(); },
    onSwipedDown: () => {
      if (currentIndex === 0) {
        handleRefresh();
      } else {
        goToPreviousReel();
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') goToNextReel();
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        if (currentIndex === 0) {
          handleRefresh();
        } else {
          goToPreviousReel();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextReel, goToPreviousReel, currentIndex]);
  
  if (isLoading && reelPosts.length === 0) {
    return <ReelsPageSkeleton />;
  }
  
  if (!isLoading && reelPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4 text-center">
        <Alert className="max-w-md bg-gray-900/80 border-gray-700 text-white">
          <Film className="h-5 w-5 text-primary" />
          <AlertTitle className="text-xl font-semibold mb-2">No Reels to Show</AlertTitle>
          <AlertDescription className="text-base text-gray-300">
            It looks like there are no image or video posts available right now. You can create one from the Home feed!
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div {...swipeHandlers} className="h-full w-full overflow-hidden flex flex-col bg-black touch-none">
      <div className="flex-grow relative w-full h-full overflow-hidden">
        {reelPosts.map((post, index) => {
            if (Math.abs(index - currentIndex) > 2) return null; // Render current, next, and previous

            const getTransform = () => {
                if (index < currentIndex) return 'translateY(-100%)';
                if (index > currentIndex) return 'translateY(100%)';
                return 'translateY(0)';
            };

            return (
                <div key={post.id} className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out" style={{ transform: getTransform(), zIndex: index === currentIndex ? 20 : 10 }}>
                    <ReelItem post={post} isActive={index === currentIndex} sessionUser={sessionUser} />
                </div>
            );
        })}

        {(isLoadingMore || (isLoading && reelPosts.length > 0)) && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                <Loader2 className="w-10 h-10 animate-spin text-white"/>
            </div>
        )}
      </div>

      {reelPosts.length > 1 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
          <Button onClick={goToPreviousReel} variant="ghost" size="icon" className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full h-11 w-11 disabled:opacity-30 pointer-events-auto" aria-label="Previous Reel" disabled={currentIndex === 0}>
            <ChevronUp className="h-7 w-7" />
          </Button>
          
          <div className="text-xs text-white/80 bg-black/30 px-2 py-1 rounded-md backdrop-blur-sm flex items-center pointer-events-auto">
            {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{currentIndex + 1} / {reelPosts.length}</span>}
          </div>
          
          <Button onClick={goToNextReel} variant="ghost" size="icon" className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full h-11 w-11 disabled:opacity-30 pointer-events-auto" aria-label="Next Reel" disabled={currentIndex === reelPosts.length - 1 && !hasMore}>
            <ChevronDown className="h-7 w-7" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReelsViewer;

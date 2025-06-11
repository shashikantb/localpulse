
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Post } from '@/lib/db-types';
import { getPosts } from '@/app/actions';
import { ReelItem } from '@/components/reel-item';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Home, Loader2, Film } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ReelsPage: FC = () => {
  const { toast } = useToast();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [reelPosts, setReelPosts] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReelPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedPosts = await getPosts();
      setAllPosts(fetchedPosts);
      const mediaPosts = fetchedPosts.filter(post => 
        post.mediaurl && (post.mediatype === 'image' || post.mediatype === 'video')
      );
      setReelPosts(mediaPosts);
      if (mediaPosts.length === 0) {
        toast({
          variant: "default",
          title: "No Reels Yet",
          description: "There are no image or video posts to show in Reels right now.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Error fetching posts for reels:", error);
      toast({
        variant: "destructive",
        title: "Fetch Error",
        description: "Could not load posts for reels. Please try again later.",
      });
      setReelPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReelPosts();
  }, [fetchReelPosts]);

  const goToPreviousReel = () => {
    setCurrentIndex(prevIndex => (prevIndex === 0 ? reelPosts.length - 1 : prevIndex - 1));
  };

  const goToNextReel = () => {
    setCurrentIndex(prevIndex => (prevIndex === reelPosts.length - 1 ? 0 : prevIndex + 1));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Loading Reels...</p>
      </div>
    );
  }

  if (!reelPosts.length) {
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

  const currentPost = reelPosts[currentIndex];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-black">
      {/* Header with Back Button - Optional, can be part of ReelItem or global layout */}
      <div className="absolute top-0 left-0 z-20 p-4">
        <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full">
          <Link href="/">
            <Home className="h-6 w-6" />
            <span className="sr-only">Back to Feed</span>
          </Link>
        </Button>
      </div>
      
      {/* Reel Item Display */}
      <div className="flex-grow relative">
        {currentPost && <ReelItem post={currentPost} isActive={true} />}
      </div>

      {/* Bottom Navigation Controls */}
      {reelPosts.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-between items-center p-3 bg-gradient-to-t from-black/50 to-transparent">
          <Button 
            onClick={goToPreviousReel} 
            variant="ghost" 
            size="lg" 
            className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full p-3"
            aria-label="Previous Reel"
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
          <p className="text-xs text-white/80 bg-black/30 px-2 py-1 rounded-md backdrop-blur-sm">
            {currentIndex + 1} / {reelPosts.length}
          </p>
          <Button 
            onClick={goToNextReel} 
            variant="ghost" 
            size="lg" 
            className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full p-3"
            aria-label="Next Reel"
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReelsPage;

    
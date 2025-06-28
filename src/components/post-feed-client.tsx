
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Post, User } from '@/lib/db-types';
import { getPosts, registerDeviceToken, checkForNewerPosts } from '@/app/actions';
import { PostCard } from '@/components/post-card';
import { HASHTAG_CATEGORIES } from '@/components/post-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2, Filter, SlidersHorizontal, Rss, Tag, ChevronDown, Bell, BellOff, BellRing, ListPlus, RefreshCw, Lock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

interface AndroidInterface {
  getFCMToken?: () => string | null;
}

declare global {
  interface Window {
    Android?: AndroidInterface;
  }
}

const POSTS_PER_PAGE = 5;
const NEW_POST_POLL_INTERVAL = 30000;
const CACHE_KEY = 'localpulse-posts-cache';
const CACHE_VERSION = 'v1.1'; // Increment to invalidate old cache structures

// Helper to get initial posts from cache or server data
const getInitialCachedPosts = (serverInitialPosts: Post[]): Post[] => {
  if (typeof window === 'undefined') {
    return serverInitialPosts;
  }
  try {
    const cachedItem = localStorage.getItem(CACHE_KEY);
    if (cachedItem) {
      const cachedData = JSON.parse(cachedItem);
      if (cachedData.version === CACHE_VERSION && Array.isArray(cachedData.posts)) {
        return cachedData.posts.length > 0 ? cachedData.posts : serverInitialPosts;
      }
    }
  } catch (error) {
    console.warn("Failed to read post cache:", error);
  }
  return serverInitialPosts;
};


interface PostFeedClientProps {
  initialPosts: Post[];
  sessionUser: User | null;
}

const PostFeedClient: FC<PostFeedClientProps> = ({ initialPosts, sessionUser }) => {
  const { toast } = useToast();
  const [allPosts, setAllPosts] = useState<Post[]>(() => getInitialCachedPosts(initialPosts));
  const [filteredAndSortedPosts, setFilteredAndSortedPosts] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [latestPostIdClientKnows, setLatestPostIdClientKnows] = useState<number>(0);
  const [newPulsesAvailable, setNewPulsesAvailable] = useState(false);
  const [newPulsesCount, setNewPulsesCount] = useState(0);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  const [hasMorePosts, setHasMorePosts] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [distanceFilterKm, setDistanceFilterKm] = useState<number>(101); 
  const [showAnyDistance, setShowAnyDistance] = useState<boolean>(true);
  const [filterHashtags, setFilterHashtags] = useState<string[]>([]);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<string>('default');

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }, []);

  // Effect to get user location
  useEffect(() => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error("Geolocation error in feed:", error);
          setIsLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsLoadingLocation(false);
    }
  }, []);

  // Effect to save posts to cache
  useEffect(() => {
    try {
      const cacheData = {
        version: CACHE_VERSION,
        timestamp: new Date().toISOString(),
        posts: allPosts.slice(0, POSTS_PER_PAGE * 2), // Cache up to 2 pages of posts
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Failed to save posts to cache:", error);
    }
  }, [allPosts]);

  const handleNotificationRegistration = async () => {
    // ... (existing notification logic)
  };

  const refreshPosts = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const newInitialPosts = await getPosts({ page: 1, limit: POSTS_PER_PAGE });
      setAllPosts(newInitialPosts);
      setCurrentPage(1);
      setHasMorePosts(newInitialPosts.length === POSTS_PER_PAGE);
      setNewPulsesAvailable(false);
      setNewPulsesCount(0);
      if (window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Error",
        description: "Could not refresh posts.",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [toast]);

  useEffect(() => {
    if (allPosts.length > 0) {
        setLatestPostIdClientKnows(allPosts.reduce((max, p) => p.id > max ? p.id : max, 0));
    }
  }, [allPosts]);

  useEffect(() => {
    let processedPosts = [...allPosts];

    // Role-based sorting logic
    if (sessionUser?.role === 'Gorakshak' && location) {
        processedPosts.sort((a, b) => {
            const isAGorakshak = a.authorrole === 'Gorakshak';
            const isBGorakshak = b.authorrole === 'Gorakshak';
            const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
            const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
            const NEARBY_THRESHOLD_KM = 20; 
            const isANearbyGorakshak = isAGorakshak && (distA <= NEARBY_THRESHOLD_KM);
            const isBNearbyGorakshak = isBGorakshak && (distB <= NEARBY_THRESHOLD_KM);

            if (isANearbyGorakshak && !isBNearbyGorakshak) return -1;
            if (!isANearbyGorakshak && isBNearbyGorakshak) return 1;
            if (isAGorakshak && !isBGorakshak) return -1;
            if (!isAGorakshak && isBGorakshak) return 1;

            if (isAGorakshak && isBGorakshak) {
                return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
            }
            if (!isAGorakshak && !isBGorakshak) {
                if (Math.abs(distA - distB) < 0.1) {
                    return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
                }
                return distA - distB;
            }
            return 0;
        });
    } else if (location) { // Default logic for Business/anonymous users with location
        processedPosts.sort((a, b) => {
            const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
            const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
            if (Math.abs(distA - distB) < 0.1) {
                return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
            }
            return distA - distB;
        });
    }
    
    // Apply user-defined filters AFTER sorting
    if (location && !showAnyDistance) {
      processedPosts = processedPosts.filter(p => 
        p.latitude && p.longitude && 
        calculateDistance(location.latitude, location.longitude, p.latitude, p.longitude) <= distanceFilterKm
      );
    }
    if (filterHashtags.length > 0) {
      processedPosts = processedPosts.filter(p => 
        p.hashtags && p.hashtags.length > 0 && 
        filterHashtags.some(fh => p.hashtags!.includes(fh))
      );
    }
    
    setFilteredAndSortedPosts(processedPosts);
  }, [allPosts, location, distanceFilterKm, showAnyDistance, filterHashtags, sessionUser, calculateDistance]);


  // Polling for new posts, now more bfcache-friendly.
  useEffect(() => {
    if (isLoadingLocation) return;

    let timeoutId: NodeJS.Timeout;

    const pollForNewPosts = async () => {
      // Only poll if the tab is visible.
      // This helps with performance and makes the page more eligible for bfcache.
      if (!document.hidden) {
        try {
          const result = await checkForNewerPosts(latestPostIdClientKnows);
          if (result.hasNewerPosts) {
            setNewPulsesAvailable(true);
            setNewPulsesCount(result.count);
          }
        } catch (error) {
          console.warn("Polling for new posts failed:", error);
        }
      }
      
      // Schedule the next poll.
      timeoutId = setTimeout(pollForNewPosts, NEW_POST_POLL_INTERVAL);
    };

    // Start the polling loop.
    timeoutId = setTimeout(pollForNewPosts, NEW_POST_POLL_INTERVAL);

    // Cleanup function.
    return () => clearTimeout(timeoutId);
  }, [isLoadingLocation, latestPostIdClientKnows]);


  const handleLoadNewPulses = async () => {
    toast({ title: "Refreshing Pulses...", description: "Fetching the latest vibes for you." });
    await refreshPosts();
  };
  
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMorePosts) return; 

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
        const newPosts = await getPosts({ page: nextPage, limit: POSTS_PER_PAGE });
        if (newPosts.length > 0) {
            setAllPosts(prevPosts => [...prevPosts, ...newPosts]);
            setCurrentPage(nextPage);
            if (newPosts.length < POSTS_PER_PAGE) {
                setHasMorePosts(false);
            }
        } else {
            setHasMorePosts(false);
            toast({
                title: "You've reached the end!",
                description: "No more pulses to show for now.",
            });
        }
    } catch (error) {
        console.error("Error loading more posts:", error);
        toast({ variant: "destructive", title: "Fetch Error", description: "Could not load more posts." });
    } finally {
        setIsLoadingMore(false);
    }
  };

  const handleDistanceChange = (value: number[]) => {
    setDistanceFilterKm(value[0]);
    setShowAnyDistance(value[0] > 100);
  };

  const handleHashtagFilterChange = (tag: string, checked: boolean) => {
    setFilterHashtags(prev =>
      checked ? [...prev, tag] : prev.filter(ht => ht !== tag)
    );
  };
  
  const resetAllFilters = () => {
    setDistanceFilterKm(101);
    setShowAnyDistance(true);
    setFilterHashtags([]);
  };

  const FilterSheetContent = () => (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center"><Filter className="w-5 h-5 mr-2 text-accent" /> Filter Pulses</SheetTitle>
        <SheetDescription>
          Adjust filters to find relevant pulses. Your current location is used for distance.
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className="h-[calc(100vh-16rem)] pr-3">
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="distance-filter-slider" className="text-muted-foreground flex justify-between items-center">
              <span>Max Distance:</span>
              <span className="font-semibold text-primary">
                {showAnyDistance ? "Any Distance" : `${distanceFilterKm} km`}
              </span>
            </Label>
            <Slider
              id="distance-filter-slider"
              min={1}
              max={101} 
              step={1}
              value={[distanceFilterKm]} 
              onValueChange={handleDistanceChange} 
              disabled={!location || isLoadingMore}
              aria-label="Distance filter"
            />
            {!location && <p className="text-xs text-destructive mt-1">Enable location services to use distance filter.</p>}
          </div>

          <div className="space-y-3">
            <Label className="text-muted-foreground flex items-center mb-1">
              <Tag className="w-4 h-4 mr-1.5 text-primary" />
              Filter by Hashtags:
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={isLoadingMore}>
                  <span>Select Hashtags ({filterHashtags.length || 0} selected)</span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(var(--radix-dropdown-menu-trigger-width)_-_2px)] max-h-80 overflow-y-auto">
                {HASHTAG_CATEGORIES.map((category, catIndex) => (
                  <DropdownMenuGroup key={category.name}>
                    <DropdownMenuLabel>{category.name}</DropdownMenuLabel>
                    {category.hashtags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag}
                        checked={filterHashtags.includes(tag)}
                        onCheckedChange={(checked) => handleHashtagFilterChange(tag, !!checked)}
                        disabled={isLoadingMore}
                      >
                        {tag}
                      </DropdownMenuCheckboxItem>
                    ))}
                    {catIndex < HASHTAG_CATEGORIES.length - 1 && <DropdownMenuSeparator />}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
              variant="outline"
              onClick={resetAllFilters}
              disabled={isLoadingMore && (showAnyDistance && filterHashtags.length === 0)}
              className="w-full"
          >
              Reset All Filters
          </Button>
        </div>
      </ScrollArea>
      <SheetFooter className="mt-4 border-t pt-4">
        <SheetClose asChild>
          <Button variant="outline">Close</Button>
        </SheetClose>
      </SheetFooter>
    </>
  );

  const activeFilterCount = (filterHashtags.length > 0 ? 1 : 0) + (!showAnyDistance ? 1 : 0);

  if (initialPosts.length === 0 && allPosts.length === 0) {
    return (
        <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm mt-8">
            <CardContent className="flex flex-col items-center">
                <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
                <p className="text-2xl text-muted-foreground font-semibold">The air is quiet here...</p>
                <p className="text-md text-muted-foreground/80 mt-2">No pulses found. Be the first to post!</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-end items-center sticky top-6 z-30 mb-4 px-1 gap-2">
          <Button
              variant="outline"
              className="shadow-lg hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary"
              onClick={handleNotificationRegistration}
          >
              {notificationPermissionStatus === 'granted' ? (
                  <BellRing className="w-5 h-5 mr-2 text-green-500" />
              ) : (
                  <Bell className="w-5 h-5 mr-2" />
              )}
              <span className="hidden sm:inline">Notifications</span>
          </Button>
          <Sheet>
              <SheetTrigger asChild>
                  <Button variant="outline" className="shadow-lg hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary">
                  <SlidersHorizontal className="w-5 h-5 mr-2" />
                  Filters {activeFilterCount > 0 && <span className="ml-2 bg-accent text-accent-foreground text-xs px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
                  </Button>
              </SheetTrigger>
              <SheetContent className="bg-card/95 backdrop-blur-md border-border w-full sm:max-w-md flex flex-col">
                  <FilterSheetContent />
              </SheetContent>
          </Sheet>
      </div>

      <div className="space-y-6">
          <div className="flex justify-between items-center border-b-2 border-primary/30 pb-3 mb-6">
              <h2 className="text-4xl font-bold text-primary pl-1 flex items-center">
              <Rss className="w-9 h-9 mr-3 text-accent opacity-90" />
              Nearby Pulses
              </h2>
              {newPulsesAvailable && (
                  <Button variant="outline" size="sm" onClick={handleLoadNewPulses} className="animate-pulse bg-accent/10 hover:bg-accent/20 border-accent/50 text-accent hover:text-accent/90 shadow-md">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Load {newPulsesCount} New {newPulsesCount === 1 ? "Pulse" : "Pulses"}
                  </Button>
              )}
          </div>

          {filteredAndSortedPosts.length > 0 ? (
              <>
              {filteredAndSortedPosts.map((post, index) => (
                  <PostCard key={post.id} post={post} userLocation={location} sessionUser={sessionUser} isFirst={index === 0} />
              ))}
              {hasMorePosts && (
                  <Button onClick={handleLoadMore} variant="outline" className="w-full mt-6 py-3 text-lg shadow-md hover:shadow-lg transition-shadow bg-card hover:bg-muted" disabled={isLoadingMore}>
                     {isLoadingMore ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ListPlus className="mr-2 h-5 w-5" /> }
                      Load More Pulses
                  </Button>
              )}
              </>
          ) : (
            <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center">
                <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
                <p className="text-2xl text-muted-foreground font-semibold">The air is quiet here...</p>
                <p className="text-md text-muted-foreground/80 mt-2">No pulses found for your current filters. Try adjusting them!</p>
                </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
};

export default PostFeedClient;

    

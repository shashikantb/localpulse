

'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Post, User } from '@/lib/db-types';
import { getPosts, registerDeviceToken } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { PostCard } from '@/components/post-card';
import { PostFeedSkeleton } from './post-feed-skeleton';
import { HASHTAG_CATEGORIES } from '@/components/post-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2, Filter, SlidersHorizontal, Rss, Tag, ChevronDown, Bell, BellOff, BellRing, ListPlus, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSwipeable } from 'react-swipeable';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


interface AndroidInterface {
  getFCMToken?: () => string | null;
}

declare global {
  interface Window {
    Android?: AndroidInterface;
  }
}

const POSTS_PER_PAGE = 5;
const POSTS_CACHE_KEY = 'localpulse-posts-cache';
const CACHE_VERSION = 'v1.1'; // Increment to invalidate old cache structures


// Helper to get initial posts from cache or server data
const getInitialCachedPosts = (serverInitialPosts: Post[]): Post[] => {
  if (typeof window === 'undefined') {
    return serverInitialPosts;
  }
  try {
    const cachedItem = localStorage.getItem(POSTS_CACHE_KEY);
    if (cachedItem) {
      const cachedData = JSON.parse(cachedItem);
      if (cachedData.version === CACHE_VERSION && Array.isArray(cachedData.posts)) {
        return cachedData.posts.length > 0 ? cachedData.posts : serverInitialPosts;
      }
    }
  } catch (error) {
    console.warn("Failed to read posts cache:", error);
  }
  return serverInitialPosts;
};


interface PostFeedClientProps {
  initialPosts: Post[];
}

// --- Helper Components ---

function FilterSheetContent({
  distanceFilterKm,
  showAnyDistance,
  handleDistanceChange,
  location,
  isLoadingMore,
  filterHashtags,
  handleHashtagFilterChange,
  resetAllFilters,
}: {
  distanceFilterKm: number;
  showAnyDistance: boolean;
  handleDistanceChange: (value: number[]) => void;
  location: { latitude: number; longitude: number } | null;
  isLoadingMore: boolean;
  filterHashtags: string[];
  handleHashtagFilterChange: (tag: string, checked: boolean) => void;
  resetAllFilters: () => void;
}) {
  return (
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
}

function NotificationButtonContent({
  notificationPermissionStatus,
}: {
  notificationPermissionStatus: 'default' | 'loading' | 'granted' | 'denied';
}) {
  switch (notificationPermissionStatus) {
    case 'loading':
      return <><Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> <span className="hidden sm:inline">Checking...</span></>;
    case 'granted':
      return <><BellRing className="w-4 h-4 sm:mr-2 text-green-500" /> <span className="hidden sm:inline">Subscribed</span></>;
    case 'denied':
      return <><BellOff className="w-4 h-4 sm:mr-2 text-destructive" /> <span className="hidden sm:inline">Setup</span></>;
    case 'default':
    default:
      return <><Bell className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Notify Me</span></>;
  }
}

function NoPostsContent({
  isLoading,
  activeFilterCount,
}: {
  isLoading: boolean;
  activeFilterCount: number;
}) {
  if (isLoading) {
    return null; // Don't show this if we are still loading
  }

  const hasFilters = activeFilterCount > 0;

  return (
    <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center">
        <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
        <p className="text-2xl text-muted-foreground font-semibold">The air is quiet here...</p>
        {hasFilters ? (
          <p className="text-md text-muted-foreground/80 mt-2">No pulses found for your current filters. Try adjusting them!</p>
        ) : (
          <p className="text-md text-muted-foreground/80 mt-2">No pulses found nearby. Be the first to post!</p>
        )}
      </CardContent>
    </Card>
  );
}


// --- Main Component ---

const PostFeedClient: FC<PostFeedClientProps> = ({ initialPosts }) => {
  const { toast } = useToast();
  
  const [allPosts, setAllPosts] = useState<Post[]>(() => getInitialCachedPosts(initialPosts));
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(allPosts.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [distanceFilterKm, setDistanceFilterKm] = useState<number>(101); 
  const [showAnyDistance, setShowAnyDistance] = useState<boolean>(true);
  const [filterHashtags, setFilterHashtags] = useState<string[]>([]);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<'default' | 'loading' | 'granted' | 'denied'>('default');
  const [showTroubleshootingDialog, setShowTroubleshootingDialog] = useState(false);
  
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

  // Effect to save posts to cache
  useEffect(() => {
    try {
      const cacheData = {
        version: CACHE_VERSION,
        timestamp: new Date().toISOString(),
        posts: allPosts.slice(0, POSTS_PER_PAGE * 2), // Cache up to 2 pages of posts
      };
      localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Failed to save posts to cache:", error);
    }
  }, [allPosts]);


  // Effect for initial load (stale-while-revalidate)
  useEffect(() => {
    const loadInitialData = async () => {
      // If we have cached posts, show them first.
      setIsLoading(allPosts.length === 0);

      // Fetch fresh data and other info in the background
      const sessionPromise = getSession();
      const locationPromise = new Promise<{ latitude: number; longitude: number } | null>(resolve => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          resolve(null);
        }
      });

      try {
        const [session, loc] = await Promise.all([sessionPromise, locationPromise]);
        
        setSessionUser(session.user);
        setLocation(loc);

        // NOW fetch posts with the location data
        const freshPosts = await getPosts({ 
            page: 1, 
            limit: POSTS_PER_PAGE,
            latitude: loc?.latitude, // Pass location if available
            longitude: loc?.longitude
        });
        
        // Update state with fresh data
        setAllPosts(freshPosts); // This replaces cached data with fresh data
        setCurrentPage(1);
        setHasMorePosts(freshPosts.length === POSTS_PER_PAGE);
      } catch (error: any) {
        // Silently fail but log the error
        console.error("Silent background refresh failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  // We only want this effect to run once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleNotificationRegistration = async () => {
    if (notificationPermissionStatus === 'granted') {
      toast({ title: "Notifications Enabled", description: "You are already set up to receive notifications." });
      return;
    }
    if (notificationPermissionStatus === 'denied') {
       setShowTroubleshootingDialog(true);
      return;
    }

    setNotificationPermissionStatus('loading');
    
    const getTokenWithRetries = (retries = 3, delay = 500): Promise<string | null> => {
        return new Promise((resolve) => {
            let attempts = 0;
            const tryGetToken = () => {
                if (window.Android && typeof window.Android.getFCMToken === 'function') {
                    const token = window.Android.getFCMToken();
                    if (token) {
                        resolve(token);
                        return;
                    }
                }
                
                attempts++;
                if (attempts < retries) {
                    setTimeout(tryGetToken, delay);
                } else {
                    resolve(null);
                }
            };
            tryGetToken();
        });
    };

    try {
      if (window.Android && typeof window.Android.getFCMToken === 'function') {
        const token = await getTokenWithRetries();
        if (token) {
          const result = await registerDeviceToken(token, location?.latitude, location?.longitude);
          if (result.success) {
            setNotificationPermissionStatus('granted');
            toast({ title: "Success!", description: "You are now set up for notifications."});
          } else {
             // Silently fail but log the error
             console.error("Could not register for notifications:", result.error);
             setNotificationPermissionStatus('denied');
          }
        } else {
          setShowTroubleshootingDialog(true);
          setNotificationPermissionStatus('denied');
        }
      } else {
        toast({ title: "Web Notifications", description: "Web push notifications are not yet available. Please use our Android app for real-time updates." });
        setNotificationPermissionStatus('denied');
      }
    } catch (error) {
        console.error("Error during notification registration:", error);
        setShowTroubleshootingDialog(true);
        setNotificationPermissionStatus('denied');
    }
  };


  const refreshPosts = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const newInitialPosts = await getPosts({ 
        page: 1, 
        limit: POSTS_PER_PAGE, 
        latitude: location?.latitude, 
        longitude: location?.longitude 
      });
      setAllPosts(newInitialPosts);
      setCurrentPage(1);
      setHasMorePosts(newInitialPosts.length === POSTS_PER_PAGE);
      if (window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error: any) {
      console.error("Error refreshing posts:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [location]);
  
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMorePosts) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
        const newPosts = await getPosts({ 
          page: nextPage, 
          limit: POSTS_PER_PAGE, 
          latitude: location?.latitude, 
          longitude: location?.longitude 
        });
        if (newPosts.length > 0) {
            setAllPosts(prevPosts => {
                const existingIds = new Set(prevPosts.map(p => p.id));
                const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
                return [...prevPosts, ...uniqueNewPosts];
            });
            setCurrentPage(nextPage);
            if (newPosts.length < POSTS_PER_PAGE) {
                setHasMorePosts(false);
            }
        } else {
            setHasMorePosts(false);
        }
    } catch (error: any) {
      console.error("Error loading more posts:", error.message);
    } finally {
        setIsLoadingMore(false);
    }
  }, [currentPage, hasMorePosts, isLoadingMore, location]);


  const observer = useRef<IntersectionObserver>();
  const loaderRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMorePosts) {
        handleLoadMore();
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoadingMore, hasMorePosts, handleLoadMore]);


  const filteredPosts = useMemo(() => {
    if (isLoading) {
        return [];
    }

    let processedPosts = [...allPosts];
    
    // FILTERING ONLY - primary sorting is now done on the server.
    if (location && !showAnyDistance) {
      processedPosts = processedPosts.filter(p => 
        p.latitude != null && p.longitude != null && 
        calculateDistance(location.latitude, location.longitude, p.latitude, p.longitude) <= distanceFilterKm
      );
    }
    if (filterHashtags.length > 0) {
      processedPosts = processedPosts.filter(p => 
        p.hashtags && p.hashtags.length > 0 && 
        filterHashtags.some(fh => p.hashtags!.includes(fh))
      );
    }

    return processedPosts;
  }, [allPosts, location, distanceFilterKm, showAnyDistance, filterHashtags, calculateDistance, isLoading]);
  
  const handleRefresh = async () => {
    if (isLoading || isLoadingMore || isRefreshing) return;
    toast({ title: "Refreshing Feed...", description: "Fetching the latest pulses for you." });
    await refreshPosts();
  };

  const swipeHandlers = useSwipeable({
    onSwipedDown: () => {
      // Only refresh if scrolled to the very top of the page
      if (window.scrollY === 0) {
        handleRefresh();
      }
    },
    trackMouse: true,
  });

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

  if (isLoading && allPosts.length === 0) {
    return <PostFeedSkeleton />;
  }
  
  const activeFilterCount = (filterHashtags.length > 0 ? 1 : 0) + (!showAnyDistance ? 1 : 0);

  return (
    <div {...swipeHandlers}>
      <AlertDialog open={showTroubleshootingDialog} onOpenChange={setShowTroubleshootingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
              Enable Background Notifications
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 text-left pt-2 text-foreground/80">
                <p>To receive notifications reliably on your device, please enable these two settings for the LocalPulse app:</p>
                <ol className="list-decimal list-inside space-y-2 font-medium bg-muted p-3 rounded-md border">
                    <li><span className="font-semibold">Enable "Autostart"</span> (or "Auto-launch").</li>
                    <li><span className="font-semibold">Set Battery Saver to "No restrictions"</span>.</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-1">
                    These options are usually found in your phone's Settings app under "Apps" or "Security". Unfortunately, we cannot open this page for you automatically.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogFooter>
          <AlertDialogFooter>
            <AlertDialogCancel>I'll check later</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowTroubleshootingDialog(false);
              handleNotificationRegistration();
            }}>I've checked, Try Again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-between items-center border-b-2 border-primary/30 pb-3 mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-primary pl-1 flex items-center">
          <Rss className="w-6 h-6 sm:w-8 sm:h-8 mr-2 text-accent opacity-90" />
          Nearby Pulses
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="shadow-md hover:shadow-lg transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary"
            onClick={handleNotificationRegistration}
            disabled={notificationPermissionStatus === 'loading'}
            aria-label="Toggle Notifications"
          >
            <NotificationButtonContent notificationPermissionStatus={notificationPermissionStatus} />
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="shadow-md hover:shadow-lg transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary" aria-label="Open filters">
                  <SlidersHorizontal className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && <span className="ml-2 bg-accent text-accent-foreground text-xs px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-card/95 backdrop-blur-md border-border w-full sm:max-w-md flex flex-col">
              <FilterSheetContent 
                distanceFilterKm={distanceFilterKm}
                showAnyDistance={showAnyDistance}
                handleDistanceChange={handleDistanceChange}
                location={location}
                isLoadingMore={isLoadingMore}
                filterHashtags={filterHashtags}
                handleHashtagFilterChange={handleHashtagFilterChange}
                resetAllFilters={resetAllFilters}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {isRefreshing && (
        <div className="flex justify-center items-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      <div className="space-y-6">
        {filteredPosts.length > 0 ? (
            <>
              {filteredPosts.map((post, index) => (
                  <PostCard key={post.id} post={post} userLocation={location} sessionUser={sessionUser} isFirst={index === 0} />
              ))}
              
              {/* Sentinel loader to trigger infinite scroll */}
              <div ref={loaderRef} className="h-1 w-full" />
              
              {isLoadingMore && (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {!hasMorePosts && filteredPosts.length > 0 && (
                <div className="text-center text-muted-foreground py-10">
                  <Zap className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p className="font-semibold">You've reached the end of the line!</p>
                  <p className="text-sm">No more pulses to show for now.</p>
                </div>
              )}
            </>
        ) : (
          <NoPostsContent isLoading={isLoading} activeFilterCount={activeFilterCount} />
        )}
      </div>
    </div>
  );
};

export default PostFeedClient;

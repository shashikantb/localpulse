
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Post, User } from '@/lib/db-types';
import { getPosts, registerDeviceToken, checkForNewerPosts } from '@/app/actions';
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
const NEW_POST_POLL_INTERVAL = 30000;
const POST_CACHE_KEY = 'localpulse-posts-cache';
const LOCATION_CACHE_KEY = 'localpulse-location-cache';
const CACHE_VERSION = 'v1.3'; // Increment to invalidate old cache structures


interface PostFeedClientProps {
  initialPosts: Post[];
  sessionUser: User | null;
}

const PostFeedClient: FC<PostFeedClientProps> = ({ initialPosts, sessionUser }) => {
  const { toast } = useToast();
  
  const [allPosts, setAllPosts] = useState<Post[]>(initialPosts);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [filteredAndSortedPosts, setFilteredAndSortedPosts] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [latestPostIdClientKnows, setLatestPostIdClientKnows] = useState<number>(0);
  const [newPulsesAvailable, setNewPulsesAvailable] = useState(false);
  const [newPulsesCount, setNewPulsesCount] = useState(0);
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

  // Effect to get user location & hydrate state from cache, now safe from hydration errors.
  useEffect(() => {
    let isMounted = true;

    // --- Hydrate state after initial render ---
    
    // 1. Posts from localStorage
    try {
      const cachedItem = localStorage.getItem(POST_CACHE_KEY);
      if (cachedItem) {
        const cachedData = JSON.parse(cachedItem);
        if (cachedData.version === CACHE_VERSION && Array.isArray(cachedData.posts) && cachedData.posts.length > 0 && isMounted && allPosts.length === 0) {
          setAllPosts(cachedData.posts);
        }
      }
    } catch (error) {
      console.warn("Failed to read post cache:", error);
    }

    // 2. Location from sessionStorage
    const cachedLocationJSON = sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (cachedLocationJSON) {
        try {
            const cachedLocation = JSON.parse(cachedLocationJSON);
            if (isMounted) {
                setLocation(cachedLocation);
                setIsLoadingLocation(false);
            }
        } catch (e) {
            console.warn("Failed to parse cached location:", e);
            if (isMounted) setIsLoadingLocation(false);
        }
    } else {
       // 3. If no cached location, get from navigator
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (isMounted) {
              const newLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              setLocation(newLocation);
              sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(newLocation));
              setIsLoadingLocation(false);
            }
          },
          (error) => {
            if (isMounted) {
              console.error("Geolocation error in feed:", error);
              setIsLoadingLocation(false);
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
          if (isMounted) setIsLoadingLocation(false);
      }
    }
    
    return () => { isMounted = false; };
  }, [allPosts.length]); // Re-run if initialPosts changes (e.g. from empty to filled by server)


  // Effect to save posts to cache
  useEffect(() => {
    // Only save if posts have been loaded
    if (allPosts.length > 0) {
      try {
        const cacheData = {
          version: CACHE_VERSION,
          timestamp: new Date().toISOString(),
          posts: allPosts.slice(0, POSTS_PER_PAGE * 2), // Cache up to 2 pages of posts
        };
        localStorage.setItem(POST_CACHE_KEY, JSON.stringify(cacheData));
      } catch (error) {
        console.warn("Failed to save posts to cache:", error);
      }
    }
  }, [allPosts]);

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
          toast({
            duration: 15000,
            title: "Your Device Token",
            description: (
              <div className="w-full break-words">
                <p className="mb-2">Use this token for testing push notifications:</p>
                <code className="text-xs bg-muted p-1 rounded font-mono">{token}</code>
              </div>
            ),
          });
          const result = await registerDeviceToken(token, location?.latitude, location?.longitude);
          if (result.success) {
            setNotificationPermissionStatus('granted');
            toast({ title: "Success!", description: "Notification token registered."});
          } else {
             toast({ variant: "destructive", title: "Registration Error", description: result.error || "Could not register for notifications." });
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
    setIsLoadingMore(true);
    setNewPulsesAvailable(false);
    setNewPulsesCount(0);
    try {
      const newInitialPosts = await getPosts({ page: 1, limit: POSTS_PER_PAGE });
      setAllPosts(newInitialPosts);
      setCurrentPage(1);
      setHasMorePosts(newInitialPosts.length === POSTS_PER_PAGE);
      if (window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Error",
        description: "Could not refresh posts.",
      });
      setNewPulsesAvailable(true); // Re-enable button if refresh fails
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
    if (isLoadingLocation) {
        return;
    }

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
    } else { // Fallback if no location: sort by newest
       processedPosts.sort((a, b) => new Date(b.createdat).getTime() - new Date(a.createdat).getTime());
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
  }, [allPosts, location, distanceFilterKm, showAnyDistance, filterHashtags, sessionUser, calculateDistance, isLoadingLocation]);


  // Polling for new posts, now more bfcache-friendly.
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const pollForNewPosts = async () => {
      try {
        const result = await checkForNewerPosts(latestPostIdClientKnows);
        if (result.hasNewerPosts) {
          setNewPulsesAvailable(true);
          setNewPulsesCount(result.count);
          // Once we know there are new posts, we can stop polling.
          if (intervalId) clearInterval(intervalId);
          intervalId = null;
        }
      } catch (error) {
        console.warn("Polling for new posts failed:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, clear the interval to stop polling.
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      } else {
        // Tab is visible, start a new interval if one isn't already running.
        if (!newPulsesAvailable) { // Don't restart polling if we already found new posts
            pollForNewPosts(); // Poll immediately
            if (intervalId === null) {
              intervalId = setInterval(pollForNewPosts, NEW_POST_POLL_INTERVAL);
            }
        }
      }
    };

    // Run on initial mount
    handleVisibilityChange();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [latestPostIdClientKnows, newPulsesAvailable]);


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
  
  const NotificationButtonContent = () => {
    switch(notificationPermissionStatus) {
        case 'loading':
            return <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> <span className="hidden sm:inline">Checking...</span></>;
        case 'granted':
            return <><BellRing className="w-5 h-5 mr-2 text-green-500" /> <span className="hidden sm:inline">Subscribed</span></>;
        case 'denied':
            return <><BellOff className="w-5 h-5 mr-2 text-destructive" /> <span className="hidden sm:inline">Setup Failed</span></>;
        case 'default':
        default:
             return <><Bell className="w-5 h-5 mr-2" /> <span className="hidden sm:inline">Notifications</span></>;
    }
  };

  const showSkeletons = isLoadingLocation && allPosts.length === 0;

  if (allPosts.length === 0 && !isLoadingLocation) {
    return (
        <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center">
                <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
                <p className="text-2xl text-muted-foreground font-semibold">The air is quiet here...</p>
                <p className="text-md text-muted-foreground/80 mt-2">No pulses found. Be the first to post!</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <>
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
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>I'll check later</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowTroubleshootingDialog(false);
              handleNotificationRegistration();
            }}>I've checked, Try Again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-end items-center sticky top-6 z-30 mb-4 px-1 gap-2 flex-wrap">
          {newPulsesAvailable && (
              <Button variant="outline" size="sm" onClick={handleLoadNewPulses} className="animate-pulse bg-accent/10 hover:bg-accent/20 border-accent/50 text-accent hover:text-accent/90 shadow-md mr-auto">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Load {newPulsesCount} New {newPulsesCount === 1 ? "Pulse" : "Pulses"}
              </Button>
          )}

          <Button
              variant="outline"
              className="shadow-lg hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary"
              onClick={handleNotificationRegistration}
              disabled={notificationPermissionStatus === 'loading'}
              aria-label="Toggle Notifications"
          >
              <NotificationButtonContent />
          </Button>
          <Sheet>
              <SheetTrigger asChild>
                  <Button variant="outline" className="shadow-lg hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary" aria-label="Open filters">
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
        {showSkeletons ? (
            <>
                <PostFeedSkeleton />
            </>
        ) : filteredAndSortedPosts.length > 0 ? (
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
    </>
  );
};

export default PostFeedClient;

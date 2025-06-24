
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post, NewPost } from '@/lib/db-types';
import { getPosts, addPost, registerDeviceToken, checkForNewerPosts } from '@/app/actions'; // Actions are server-side
import { PostCard } from '@/components/post-card';
import { PostForm, HASHTAG_CATEGORIES } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2, Filter, SlidersHorizontal, Rss, Tag, ChevronDown, Bell, BellOff, BellRing, ListPlus, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
const NEW_POST_POLL_INTERVAL = 30000; // 30 seconds

interface PostFeedClientProps {
  initialPosts: Post[];
}

const PostFeedClient: FC<PostFeedClientProps> = ({ initialPosts }) => {
  const { toast } = useToast();
  const [allPosts, setAllPosts] = useState<Post[]>(initialPosts);
  const [filteredAndSortedPosts, setFilteredAndSortedPosts] = useState<Post[]>([]);
  const [postsToDisplay, setPostsToDisplay] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [latestPostIdClientKnows, setLatestPostIdClientKnows] = useState<number>(0);
  const [newPulsesAvailable, setNewPulsesAvailable] = useState(false);
  const [newPulsesCount, setNewPulsesCount] = useState(0);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [clientSideLoading, setClientSideLoading] = useState(true);
  const [isFullListLoaded, setIsFullListLoaded] = useState<boolean>(initialPosts.length === 0);
  
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [distanceFilterKm, setDistanceFilterKm] = useState<number>(101); 
  const [showAnyDistance, setShowAnyDistance] = useState<boolean>(true);
  const [filterHashtags, setFilterHashtags] = useState<string[]>([]);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<string>('default');


  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
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

  useEffect(() => {
    setLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError(null);
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          let errorMessage = `Error getting location: ${error.message}. Please ensure location services are enabled.`;
          if (error.code === error.PERMISSION_DENIED && error.message.includes('Only secure origins are allowed')) {
            errorMessage = `Error getting location: Location access is only available on secure (HTTPS) connections. Functionality might be limited. Enable HTTPS for your site.`;
          }
          setLocationError(errorMessage);
          setLoadingLocation(false);
          toast({
            variant: "destructive",
            title: "Location Error",
            description: errorMessage,
            duration: 9000,
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
      setLoadingLocation(false);
      toast({
        variant: "destructive",
        title: "Location Error",
        description: "Geolocation is not supported. Filters and sorting by distance will be affected.",
      });
    }
  }, [toast]);

  // This effect loads the full list of posts in the background after the initial page (with 5 posts) has rendered.
  // This makes the site feel fast, while still enabling full client-side filtering.
  useEffect(() => {
    const fetchAllPostsInBackground = async () => {
      try {
        const allServerPosts = await getPosts(); // Fetches all posts
        setAllPosts(allServerPosts); // Replace the initial small list with the full list
      } catch (error) {
        console.error("Failed to load full post list in background", error);
        toast({
            variant: "destructive",
            title: "Could not load all posts",
            description: "Filtering may be incomplete.",
        });
      } finally {
        setIsFullListLoaded(true);
      }
    };

    if (!isFullListLoaded) {
      fetchAllPostsInBackground();
    }
  }, [isFullListLoaded, toast]);

  const handleNotificationRegistration = async () => {
    if (notificationPermissionStatus === 'granted') {
      toast({ title: 'Notifications are already on!', description: 'You will continue to receive updates for nearby pulses.' });
      return;
    }
    if (notificationPermissionStatus === 'denied' || notificationPermissionStatus === 'unavailable') {
      toast({ title: 'Notifications are unavailable', description: 'Permission was denied or your browser is not supported yet.', variant: 'destructive' });
      return;
    }

    if (typeof window !== 'undefined' && window.Android && typeof window.Android.getFCMToken === 'function') {
      try {
        const fcmToken = window.Android.getFCMToken();
        if (fcmToken) {
          const result = await registerDeviceToken(fcmToken, location?.latitude, location?.longitude);
          if (result.success) {
            toast({ title: 'Notifications Enabled!', description: 'You will now be notified of nearby pulses.' });
            setNotificationPermissionStatus('granted');
          } else {
            toast({ title: 'Notification Setup Failed', description: result.error, variant: 'destructive' });
            setNotificationPermissionStatus('denied');
          }
        } else {
          setNotificationPermissionStatus('denied');
          toast({ title: 'Notification Error', description: 'Could not get a valid notification token from the app.', variant: 'destructive' });
        }
      } catch (error) {
        console.error('Error interacting with Android FCM interface:', error);
        toast({ title: 'Notification Error', description: 'Could not communicate with the app to set up notifications.', variant: 'destructive' });
        setNotificationPermissionStatus('denied');
      }
    } else {
      setNotificationPermissionStatus('unavailable');
      toast({
        title: 'Web Notifications Coming Soon!',
        description: 'This feature is currently designed for our native Android app. Support for web browsers is under development.',
        duration: 7000,
      });
    }
  };


  const fetchAndSetAllPosts = useCallback(async () => {
    // This function is for manual refresh, so it should get everything and show loading state
    setClientSideLoading(true);
    try {
      const fetchedPosts = await getPosts(); // Fetches all posts
      setAllPosts(fetchedPosts);
      if (fetchedPosts.length > 0) {
        setLatestPostIdClientKnows(fetchedPosts.reduce((max, p) => p.id > max ? p.id : max, 0));
      }
      setIsFullListLoaded(true); // After a refresh, the list is full
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({
        variant: "destructive",
        title: "Fetch Error",
        description: "Could not load posts. Please try again later.",
      });
      setAllPosts([]); // Keep existing or clear based on strategy
    } finally {
      setClientSideLoading(false);
    }
  }, [toast]);

  // Initialize latestPostIdClientKnows from initialPosts
  useEffect(() => {
    if (allPosts.length > 0) {
        setLatestPostIdClientKnows(allPosts.reduce((max, p) => p.id > max ? p.id : max, 0));
    }
    // Set clientSideLoading to false after first effect run
    setClientSideLoading(false); 
  }, [allPosts]);


  // This useEffect handles filtering, sorting, and pagination based on `allPosts`, `location`, and filters
  useEffect(() => {
    // Don't run if location is still loading and we rely on it for sorting/filtering
    if (loadingLocation && (!showAnyDistance || !location)) { 
      // If "Any Distance" is true or location is available, we can proceed even if loadingLocation is true
      // but if we need distance and location is not available, we wait.
      // Or, if using location and it's null, wait.
      if (!showAnyDistance && !location && !locationError) return;
    }
    
    const processAndDisplayPosts = () => {
        let filtered = allPosts;

        if (location && !showAnyDistance) {
            filtered = allPosts.filter(p =>
            p.latitude && p.longitude &&
            calculateDistance(location.latitude, location.longitude, p.latitude, p.longitude) <= distanceFilterKm
            );
        }

        if (filterHashtags.length > 0) {
            filtered = filtered.filter(p =>
            p.hashtags && p.hashtags.length > 0 && filterHashtags.some(fh => p.hashtags!.includes(fh))
            );
        }

        const sorted = [...filtered];
        if (location) {
            sorted.sort((a, b) => {
            if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) return 0; 
            const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
            const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
            if (Math.abs(distA - distB) < 0.1) { 
                return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
            }
            return distA - distB;
            });
        } else {
            sorted.sort((a, b) => new Date(b.createdat).getTime() - new Date(a.createdat).getTime());
        }
        return sorted;
    };
    
    const processed = processAndDisplayPosts();
    setFilteredAndSortedPosts(processed);
    
    // Reset current page when filters change
    if (allPosts !== initialPosts) {
      setCurrentPage(1); 
      setPostsToDisplay(processed.slice(0, POSTS_PER_PAGE));
    } else {
      setPostsToDisplay(processed.slice(0, currentPage * POSTS_PER_PAGE));
    }

  }, [
    allPosts,
    initialPosts,
    location,
    distanceFilterKm,
    showAnyDistance,
    filterHashtags,
    calculateDistance, 
    loadingLocation,  
    locationError,
    currentPage
  ]);

  // Polling for new posts
  useEffect(() => {
    // Don't poll if client is still performing its initial setup or loading posts
    if (clientSideLoading || loadingLocation) return; 

    const intervalId = setInterval(async () => {
      if (document.hidden) return; 
      
      const result = await checkForNewerPosts(latestPostIdClientKnows);
      if (result.hasNewerPosts) {
        setNewPulsesAvailable(true);
        setNewPulsesCount(result.count); 
      }
    }, NEW_POST_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [clientSideLoading, loadingLocation, latestPostIdClientKnows]);

  const handleLoadNewPulses = async () => {
    setNewPulsesAvailable(false);
    setNewPulsesCount(0);
    toast({ title: "Refreshing Pulses...", description: "Fetching the latest vibes for you." });
    await fetchAndSetAllPosts(); // This will re-fetch all posts
  };


  const handleAddPost = async (content: string, hashtags: string[], mediaUrl?: string, mediaType?: 'image' | 'video') => {
    if (!location && !locationError) { 
      const errMessage = "Cannot determine location. Please enable location services or try again.";
      toast({ variant: "destructive", title: "Post Error", description: errMessage });
      return;
    }
     if (!content.trim()) {
      toast({ variant: "destructive", title: "Post Error", description: "Post content cannot be empty." });
      return;
    }

    setFormSubmitting(true);
    try {
      const postData: NewPost = {
        content,
        latitude: location ? location.latitude : 0, 
        longitude: location ? location.longitude : 0,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        hashtags: hashtags || [],
      };
      const result = await addPost(postData);

      if (result.error) {
        toast({ variant: "destructive", title: "Post Error", description: result.error || "Failed to add post." });
      } else if (result.post) {
        // Add to allPosts, which will trigger re-filtering and display update
        setAllPosts(prevPosts => [result.post!, ...prevPosts]); 
        setLatestPostIdClientKnows(prevLatestId => Math.max(prevLatestId, result.post!.id));
        toast({ title: "Post Added!", description: "Your pulse is now live!", variant: "default", className: "bg-primary text-primary-foreground"});
        setNewPulsesAvailable(false); 
        setNewPulsesCount(0);
      } else {
         toast({ variant: "destructive", title: "Post Error", description: "An unexpected issue occurred." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Post Error", description: error.message || "An unexpected error." });
    } finally {
      setFormSubmitting(false);
    }
  };
  
  const handleLoadMore = () => {
    if (clientSideLoading) return; 
    const nextPage = currentPage + 1;
    const newPostsToDisplay = filteredAndSortedPosts.slice(0, nextPage * POSTS_PER_PAGE);
    setPostsToDisplay(newPostsToDisplay);
    setCurrentPage(nextPage);
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
              disabled={!location || clientSideLoading}
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
                <Button variant="outline" className="w-full justify-between" disabled={clientSideLoading}>
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
                        disabled={clientSideLoading}
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
              disabled={clientSideLoading && (showAnyDistance && filterHashtags.length === 0)}
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
  const hasMorePostsToDisplay = postsToDisplay.length < filteredAndSortedPosts.length;

  return (
    <div className="space-y-8">
        {loadingLocation && (
            <Card className="flex flex-col items-center justify-center space-y-3 p-6 rounded-lg shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Locating Your Vibe...</p>
            <Skeleton className="h-4 w-3/4 bg-muted-foreground/10 rounded-md" />
            <Skeleton className="h-4 w-1/2 bg-muted-foreground/10 rounded-md" />
            </Card>
        )}

        {locationError && !loadingLocation && (
            <Alert variant="destructive" className="shadow-xl border-destructive/70">
            <Terminal className="h-6 w-6" />
            <AlertTitle className="text-lg font-semibold">Location Access Denied</AlertTitle>
            <AlertDescription className="text-base">{locationError}</AlertDescription>
            </Alert>
        )}

        {!loadingLocation && (
            <>
            <Card className="overflow-hidden shadow-2xl border border-primary/30 rounded-xl bg-card/90 backdrop-blur-md transform hover:shadow-primary/20 transition-all duration-300 hover:border-primary/60">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/5 p-5">
                <CardTitle className="text-2xl font-semibold text-primary flex items-center">
                <Zap className="w-7 h-7 mr-2 text-accent drop-shadow-sm" />
                Share Your Pulse
                </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
                <PostForm onSubmit={handleAddPost} submitting={formSubmitting} />
                {location && (
                    <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary/80" />
                    Pulse Origin: {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
                    </p>
                )}
                {locationError && !location && ( 
                    <p className="text-xs text-destructive mt-4 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    Location unavailable. Posts will have an unknown city.
                    </p>
                )}
            </CardContent>
            </Card>

            <div className="flex justify-end items-center sticky top-6 z-30 mb-4 px-1 gap-2">
                <Button
                    variant="outline"
                    className="shadow-lg hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary"
                    onClick={handleNotificationRegistration}
                >
                    {notificationPermissionStatus === 'granted' ? (
                        <BellRing className="w-5 h-5 mr-2 text-green-500" />
                    ) : notificationPermissionStatus === 'denied' || notificationPermissionStatus === 'unavailable' ? (
                        <BellOff className="w-5 h-5 mr-2 text-red-500" />
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
                        <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadNewPulses}
                        className="animate-pulse bg-accent/10 hover:bg-accent/20 border-accent/50 text-accent hover:text-accent/90 shadow-md"
                        >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Load {newPulsesCount} New {newPulsesCount === 1 ? "Pulse" : "Pulses"}
                        </Button>
                    )}
                </div>

                {clientSideLoading && postsToDisplay.length === 0 && !locationError ? (
                  Array.from({ length: Math.min(POSTS_PER_PAGE, 3) }).map((_, index) => (
                      <div key={index} className="space-y-4 p-5 bg-card/70 backdrop-blur-sm rounded-xl shadow-xl animate-pulse border border-border/30">
                      <div className="flex items-center space-x-3">
                          <Skeleton className="h-12 w-12 rounded-full bg-muted/50" />
                          <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-1/3 bg-muted/50" />
                          <Skeleton className="h-3 w-1/4 bg-muted/50" />
                          </div>
                      </div>
                      <Skeleton className="h-5 w-full bg-muted/50" />
                      <Skeleton className="h-5 w-5/6 bg-muted/50" />
                      <Skeleton className="h-40 w-full bg-muted/50 rounded-md" data-ai-hint="placeholder content" />
                      </div>
                  ))
                ) : postsToDisplay.length > 0 ? (
                    <>
                    {postsToDisplay.map((post) => (
                        <PostCard
                        key={post.id}
                        post={post}
                        userLocation={location}
                        calculateDistance={calculateDistance}
                        />
                    ))}
                    {hasMorePostsToDisplay && (
                        <Button 
                            onClick={handleLoadMore} 
                            variant="outline" 
                            className="w-full mt-6 py-3 text-lg shadow-md hover:shadow-lg transition-shadow bg-card hover:bg-muted"
                            disabled={clientSideLoading}
                        >
                           {clientSideLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ListPlus className="mr-2 h-5 w-5" /> }
                            Load More Pulses
                        </Button>
                    )}
                    </>
                ) : (
                <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center">
                    <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
                    <p className="text-2xl text-muted-foreground font-semibold">
                        {(!clientSideLoading && allPosts.length > 0 && activeFilterCount > 0) || (!clientSideLoading && allPosts.length > 0 && location === null && !showAnyDistance && !locationError) 
                            ? "No pulses match your current filters or location." 
                            : (locationError && allPosts.length === 0 ? "Could not determine location or fetch pulses." : "The air is quiet here...")
                        }
                    </p>
                    <p className="text-md text-muted-foreground/80 mt-2">
                        {(!clientSideLoading && allPosts.length > 0 && activeFilterCount > 0) || (!clientSideLoading && allPosts.length > 0 && location === null && !showAnyDistance && !locationError) 
                            ? "Try adjusting your filters or enabling location. " 
                            : (locationError && allPosts.length === 0 ? "Please check your connection and location settings." : "")}
                        Be the first to make some noise!
                    </p>
                    </CardContent>
                </Card>
                )}
            </div>
            </>
        )}
    </div>
  );
};

export default PostFeedClient;

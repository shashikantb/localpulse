
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Post, NewPost, User } from '@/lib/db-types';
import { getPosts, addPost, registerDeviceToken, checkForNewerPosts } from '@/app/actions';
import { PostCard } from '@/components/post-card';
import { PostForm, HASHTAG_CATEGORIES } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2, Filter, SlidersHorizontal, Rss, Tag, ChevronDown, Bell, BellOff, BellRing, ListPlus, RefreshCw, Lock } from 'lucide-react';
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
const NEW_POST_POLL_INTERVAL = 30000;

interface PostFeedClientProps {
  initialPosts: Post[];
  sessionUser: User | null;
}

const PostFeedClient: FC<PostFeedClientProps> = ({ initialPosts, sessionUser }) => {
  const { toast } = useToast();
  const [allPosts, setAllPosts] = useState<Post[]>(initialPosts);
  const [filteredAndSortedPosts, setFilteredAndSortedPosts] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [latestPostIdClientKnows, setLatestPostIdClientKnows] = useState<number>(0);
  const [newPulsesAvailable, setNewPulsesAvailable] = useState(false);
  const [newPulsesCount, setNewPulsesCount] = useState(0);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  const [hasMorePosts, setHasMorePosts] = useState<boolean>(initialPosts.length === POSTS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [distanceFilterKm, setDistanceFilterKm] = useState<number>(101); 
  const [showAnyDistance, setShowAnyDistance] = useState<boolean>(true);
  const [filterHashtags, setFilterHashtags] = useState<string[]>([]);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<string>('default');

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity; // Put posts with no location data at the end.
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
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
      setLoadingLocation(false);
    }
  }, []);

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

  // This effect handles both filtering and sorting of posts on the client-side.
  useEffect(() => {
    let processedPosts = [...allPosts];

    // 1. Filtering Logic
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

    // 2. Sorting Logic
    if (sessionUser?.role === 'Gorakshak') {
      // For Gorakshak users, prioritize other Gorakshak posts, then sort by time.
      processedPosts.sort((a, b) => {
        const roleA = a.authorrole === 'Gorakshak' ? 0 : 1;
        const roleB = b.authorrole === 'Gorakshak' ? 0 : 1;
        if (roleA !== roleB) {
          return roleA - roleB; // Gorakshak posts (0) come before others (1).
        }
        // If roles are the same, sort by most recent time.
        return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
      });
    } else {
      // For Business and Anonymous users, sort by distance, then by time.
      if (location) {
        processedPosts.sort((a, b) => {
          const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
          const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
          
          // If distances are very similar (e.g., within 100m), fall back to time-based sorting.
          if (Math.abs(distA - distB) < 0.1) {
            return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
          }
          
          return distA - distB; // Sort by closest distance first.
        });
      }
      // If no location is available, posts remain sorted by time (the default from the DB), which is a sensible fallback.
    }
    
    setFilteredAndSortedPosts(processedPosts);
  }, [allPosts, location, distanceFilterKm, showAnyDistance, filterHashtags, sessionUser, calculateDistance]);


  useEffect(() => {
    // We don't want to poll if the page is not visible.
    if (loadingLocation || document.hidden) return;

    const intervalId = setInterval(async () => {
      if (document.hidden) return; 
      
      const result = await checkForNewerPosts(latestPostIdClientKnows);
      if (result.hasNewerPosts) {
        setNewPulsesAvailable(true);
        setNewPulsesCount(result.count); 
      }
    }, NEW_POST_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [loadingLocation, latestPostIdClientKnows]);

  const handleLoadNewPulses = async () => {
    toast({ title: "Refreshing Pulses...", description: "Fetching the latest vibes for you." });
    await refreshPosts();
  };


  const handleAddPost = async (content: string, hashtags: string[], mediaUrl?: string, mediaType?: 'image' | 'video') => {
    if (!location) { 
      const errMessage = locationError || "Cannot determine location. Please enable location services and refresh.";
      toast({ variant: "destructive", title: "Location Error", description: errMessage });
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
        latitude: location.latitude, 
        longitude: location.longitude,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        hashtags: hashtags || [],
        authorId: sessionUser ? sessionUser.id : undefined,
      };
      const result = await addPost(postData);

      if (result.error) {
        toast({ variant: "destructive", title: "Post Error", description: result.error || "Failed to add post." });
      } else if (result.post) {
        setAllPosts(prevPosts => [result.post!, ...prevPosts]); 
        setLatestPostIdClientKnows(prevLatestId => Math.max(prevLatestId, result.post!.id));
        toast({ title: "Post Added!", description: "Your pulse is now live!", variant: "default", className: "bg-primary text-primary-foreground"});
        setNewPulsesAvailable(false); 
        setNewPulsesCount(0);
        await refreshPosts();
      } else {
         toast({ variant: "destructive", title: "Post Error", description: "An unexpected issue occurred." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Post Error", description: error.message || "An unexpected error." });
    } finally {
      setFormSubmitting(false);
    }
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

  return (
    <div className="space-y-8">
      {locationError && (
          <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Location Error</AlertTitle>
              <AlertDescription>
                  {locationError}
              </AlertDescription>
          </Alert>
      )}

      <Card className="overflow-hidden shadow-2xl border border-primary/30 rounded-xl bg-card/90 backdrop-blur-md transform hover:shadow-primary/20 transition-all duration-300 hover:border-primary/60">
          <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/5 p-5">
              <CardTitle className="text-2xl font-semibold text-primary flex items-center">
                  <Zap className="w-7 h-7 mr-2 text-accent drop-shadow-sm" />
                  Share Your Pulse
              </CardTitle>
              {loadingLocation && (
                <p className="text-sm text-muted-foreground flex items-center pt-1">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Determining your location...
                </p>
              )}
          </CardHeader>
          <CardContent className="p-5">
              <PostForm onSubmit={handleAddPost} submitting={formSubmitting || loadingLocation} />
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
              {filteredAndSortedPosts.map((post) => (
                  <PostCard key={post.id} post={post} userLocation={location} sessionUser={sessionUser} />
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
              <p className="text-md text-muted-foreground/80 mt-2">No pulses found. Try adjusting your filters or be the first to post!</p>
              </CardContent>
          </Card>
          )}
      </div>
    </div>
  );
};

export default PostFeedClient;


'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Post, NewPost } from '@/lib/db-types';
import { getPosts, addPost, registerDeviceToken } from './actions';
import { PostCard } from '@/components/post-card';
import { PostForm, HASHTAG_CATEGORIES } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2, Filter, SlidersHorizontal, Rss, Tag, ChevronDown, BellDot } from 'lucide-react';
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

// Define a type for the Android interface for better type safety
interface AndroidInterface {
  getFCMToken?: () => string | null; // Make it optional as it might not exist
  // Add other methods if your Android app exposes them
}

// Extend the Window interface
declare global {
  interface Window {
    Android?: AndroidInterface;
  }
}


const Home: FC = () => {
  const { toast } = useToast();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
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

  const processAndSetPosts = useCallback((
    postsToProcess: Post[],
    currentLocation: { latitude: number; longitude: number } | null,
    currentDistanceFilterKm: number,
    currentShowAnyDistance: boolean,
    currentFilterHashtags: string[]
  ) => {
    let filtered = postsToProcess;

    // Filter by distance
    if (currentLocation && !currentShowAnyDistance) {
      filtered = postsToProcess.filter(p =>
        p.latitude && p.longitude && // Ensure post has location
        calculateDistance(currentLocation.latitude, currentLocation.longitude, p.latitude, p.longitude) <= currentDistanceFilterKm
      );
    }

    // Filter by hashtags
    if (currentFilterHashtags.length > 0) {
      filtered = filtered.filter(p =>
        p.hashtags && p.hashtags.length > 0 && currentFilterHashtags.some(fh => p.hashtags!.includes(fh))
      );
    }

    const sorted = [...filtered];
    if (currentLocation) {
      sorted.sort((a, b) => {
        if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) return 0; // Handle posts without location
        const distA = calculateDistance(currentLocation.latitude, currentLocation.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(currentLocation.latitude, currentLocation.longitude, b.latitude, b.longitude);
        if (Math.abs(distA - distB) < 0.1) { // If distances are very similar, sort by recency
          return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
        }
        return distA - distB; // Otherwise, sort by distance
      });
    } else {
      // Fallback sort by recency if no location
      sorted.sort((a, b) => new Date(b.createdat).getTime() - new Date(a.createdat).getTime());
    }
    setDisplayedPosts(sorted);
  }, [calculateDistance]);


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

  // Effect for FCM Token Registration
  useEffect(() => {
    const attemptRegisterFcmToken = async (currentLocation: { latitude: number; longitude: number } | null) => {
      if (typeof window !== 'undefined' && window.Android && typeof window.Android.getFCMToken === 'function') {
        try {
          console.log("Attempting to get FCM token from Android interface...");
          const fcmToken = window.Android.getFCMToken();
          if (fcmToken) {
            console.log('FCM Token received from Android:', fcmToken.substring(0,20) + "...");
            const lat = currentLocation?.latitude;
            const lon = currentLocation?.longitude;
            const result = await registerDeviceToken(fcmToken, lat, lon);
            if (result.success) {
              toast({ title: 'Notifications Ready', description: 'You will be notified of nearby pulses.', variant: 'default' });
              setNotificationPermissionStatus('granted'); // Assume granted if token is sent
            } else {
              toast({ title: 'Notification Setup Failed', description: result.error, variant: 'destructive' });
               setNotificationPermissionStatus('denied');
            }
          } else {
            console.log('FCM Token not available from Android interface or Android.getFCMToken is not defined.');
            // Silently fail or inform user based on UX preference
             setNotificationPermissionStatus('default'); // Or 'unavailable'
          }
        } catch (error) {
          console.error('Error interacting with Android FCM interface:', error);
          toast({ title: 'Notification Error', description: 'Could not set up notifications with the app.', variant: 'destructive' });
           setNotificationPermissionStatus('denied');
        }
      } else {
        console.log('Not running in an Android WebView with FCM interface, or interface not ready.');
         setNotificationPermissionStatus('unavailable'); // Custom status
      }
    };

    if (!loadingLocation) { // Only attempt after location is resolved (or failed)
      attemptRegisterFcmToken(location);
    }
  }, [location, loadingLocation, toast]);


  useEffect(() => {
    const fetchInitialPosts = async () => {
      setLoadingPosts(true);
      try {
        const fetchedPosts = await getPosts();
        setAllPosts(fetchedPosts);
      } catch (error) {
        console.error("Error fetching posts:", error);
        toast({
          variant: "destructive",
          title: "Fetch Error",
          description: "Could not load posts. Please try again later.",
        });
      } finally {
        setLoadingPosts(false);
      }
    };

    if (!loadingLocation) { 
        fetchInitialPosts();
    }
  }, [loadingLocation, toast]);

  useEffect(() => {
    if (!loadingPosts) { 
        processAndSetPosts(allPosts, location, distanceFilterKm, showAnyDistance, filterHashtags);
    }
  }, [allPosts, location, distanceFilterKm, showAnyDistance, filterHashtags, processAndSetPosts, loadingPosts]);


  const handleAddPost = async (content: string, hashtags: string[], mediaUrl?: string, mediaType?: 'image' | 'video') => {
    if (!location) {
      const errMessage = "Cannot post without location. Please enable location services.";
      setLocationError(errMessage);
      toast({
        variant: "destructive",
        title: "Post Error",
        description: errMessage,
      });
      return;
    }
    
    if (!content.trim()) {
      // This should ideally be caught by form validation, but as a safeguard:
      toast({
        variant: "destructive",
        title: "Post Error",
        description: "Post content cannot be empty.",
      });
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
      };

      const result = await addPost(postData);

      if (result.error) {
        toast({
          variant: "destructive",
          title: "Post Error",
          description: result.error || "Failed to add your post. Please try again.",
        });
      } else if (result.post) {
        setAllPosts(prevPosts => [result.post!, ...prevPosts]); // Ensure result.post is not undefined
        toast({
          title: "Post Added!",
          description: "Your pulse is now live!",
          variant: "default",
          className: "bg-primary text-primary-foreground",
        });
      } else {
         toast({
          variant: "destructive",
          title: "Post Error",
          description: "An unexpected issue occurred. Failed to add your post.",
        });
      }

    } catch (error: any) {
      console.error("Error adding post (client-side catch):", error);
      toast({
        variant: "destructive",
        title: "Post Error",
        description: error.message || "An unexpected client-side error occurred. Please try again.",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDistanceChange = (value: number[]) => {
    setDistanceFilterKm(value[0]);
    if (value[0] > 100) {
        setShowAnyDistance(true);
    } else {
        setShowAnyDistance(false);
    }
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
              disabled={!location || loadingPosts}
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
                <Button variant="outline" className="w-full justify-between" disabled={loadingPosts}>
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
                        disabled={loadingPosts}
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
              disabled={loadingPosts && (showAnyDistance && filterHashtags.length === 0)}
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
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 md:p-8 lg:p-16 bg-gradient-to-br from-background to-muted/30">
        <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <header className="text-center space-y-1 sm:space-y-2 py-2 sm:py-3 md:py-4 bg-card/90 backdrop-blur-lg rounded-xl shadow-2xl border border-border/50 transform hover:scale-[1.01] transition-transform duration-300 md:mb-8">
            <div className="flex items-center justify-center space-x-1 sm:space-x-2">
              <Rss className="h-6 w-6 sm:h-8 md:h-10 text-accent drop-shadow-[0_0_15px_rgba(var(--accent-hsl),0.5)]" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary tracking-tight drop-shadow-lg">
                LocalPulse
              </h1>
            </div>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground font-medium">Catch the Vibe, Share the Pulse.</p>
        </header>

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
            <div className="space-y-8">
            {location && (
                <Card className="overflow-hidden shadow-2xl border border-primary/30 rounded-xl bg-card/90 backdrop-blur-md transform hover:shadow-primary/20 transition-all duration-300 hover:border-primary/60">
                <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/5 p-5">
                    <CardTitle className="text-2xl font-semibold text-primary flex items-center">
                    <Zap className="w-7 h-7 mr-2 text-accent drop-shadow-sm" />
                    Share Your Pulse
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                    <PostForm onSubmit={handleAddPost} submitting={formSubmitting} />
                    <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary/80" />
                    Pulse Origin: {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
                    </p>
                </CardContent>
                </Card>
            )}

            <div className="flex justify-between items-center sticky top-6 z-30 mb-4">
                <div>
                    {notificationPermissionStatus === 'granted' && (
                        <span className="text-xs text-green-600 flex items-center"><BellDot className="w-3 h-3 mr-1"/> Notifications on</span>
                    )}
                    {notificationPermissionStatus === 'denied' && (
                        <span className="text-xs text-red-600 flex items-center"><BellDot className="w-3 h-3 mr-1"/> Notifications off</span>
                    )}
                     {/* You can add more statuses like 'default' or 'unavailable' if needed */}
                </div>
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
                <h2 className="text-4xl font-bold text-primary pl-1 flex items-center border-b-2 border-primary/30 pb-3 mb-6">
                <Rss className="w-9 h-9 mr-3 text-accent opacity-90" />
                Nearby Pulses
                </h2>
                {loadingPosts && !allPosts.length ? (
                Array.from({ length: 3 }).map((_, index) => (
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
                    <Skeleton className="h-40 w-full bg-muted/50 rounded-md data-ai-hint='placeholder content' " />
                    </div>
                ))
                ) : displayedPosts.length > 0 ? (
                displayedPosts.map((post) => (
                    <PostCard
                    key={post.id}
                    post={post}
                    userLocation={location}
                    calculateDistance={calculateDistance}
                    />
                ))
                ) : (
                <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center">
                    <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
                    <p className="text-2xl text-muted-foreground font-semibold">
                        {(allPosts.length > 0 && activeFilterCount > 0) || (allPosts.length > 0 && location === null && !showAnyDistance) 
                            ? "No pulses match your current filters or location." 
                            : "The air is quiet here..."
                        }
                    </p>
                    <p className="text-md text-muted-foreground/80 mt-2">
                        {(allPosts.length > 0 && activeFilterCount > 0) || (allPosts.length > 0 && location === null && !showAnyDistance) 
                            ? "Try adjusting your filters or enabling location. " 
                            : ""}
                        Be the first to make some noise!
                    </p>
                    </CardContent>
                </Card>
                )}
            </div>
            </div>
        )}
        </div>
    </main>
  );
};

export default Home;

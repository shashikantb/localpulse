
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Post, NewPost } from '@/lib/db';
import { getPosts, addPost } from './actions';
import { PostCard } from '@/components/post-card';
import { PostForm } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2, Filter, SlidersHorizontal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const Home: FC = () => {
  const { toast } = useToast();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [distanceFilterKm, setDistanceFilterKm] = useState<number>(50); // Max distance in KM
  const [showAnyDistance, setShowAnyDistance] = useState<boolean>(false); // Toggle for "Any Distance"

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

  const processAndSetPosts = useCallback((postsToProcess: Post[], currentLocation: { latitude: number; longitude: number } | null, currentDistanceFilterKm: number, currentShowAnyDistance: boolean) => {
    let filtered = postsToProcess;
    if (currentLocation && !currentShowAnyDistance) { 
      filtered = postsToProcess.filter(p => 
        calculateDistance(currentLocation.latitude, currentLocation.longitude, p.latitude, p.longitude) <= currentDistanceFilterKm
      );
    }

    const sorted = [...filtered];
    if (currentLocation) {
      sorted.sort((a, b) => {
        const distA = calculateDistance(currentLocation.latitude, currentLocation.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(currentLocation.latitude, currentLocation.longitude, b.latitude, b.longitude);
        if (Math.abs(distA - distB) < 0.1) { 
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return distA - distB; 
      });
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
          setLocationError(`Error getting location: ${error.message}. Please ensure location services are enabled.`);
          setLoadingLocation(false);
          toast({
            variant: "destructive",
            title: "Location Error",
            description: `Could not get location: ${error.message}. Filters and sorting by distance will be affected.`,
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
        processAndSetPosts(allPosts, location, distanceFilterKm, showAnyDistance);
    }
  }, [allPosts, location, distanceFilterKm, showAnyDistance, processAndSetPosts, loadingPosts]);


  const handleAddPost = async (content: string, mediaUrl?: string, mediaType?: 'image' | 'video') => {
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
    setFormSubmitting(true);
    try {
      const postData: NewPost = {
        content,
        latitude: location.latitude,
        longitude: location.longitude,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
      };
      const newPost = await addPost(postData);
      setAllPosts(prevPosts => [newPost, ...prevPosts]);
      toast({
        title: "Post Added!",
        description: "Your pulse is now live!",
        variant: "default",
        className: "bg-primary text-primary-foreground",
      });

    } catch (error) {
      console.error("Error adding post:", error);
      toast({
        variant: "destructive",
        title: "Post Error",
        description: "Failed to add your post. Please try again.",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDistanceChange = (value: number[]) => {
    setDistanceFilterKm(value[0]);
    if (value[0] > 100) { // Max value of slider if used for "Any"
        setShowAnyDistance(true);
    } else {
        setShowAnyDistance(false);
    }
  };

  const FilterSheetContent = () => (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center"><Filter className="w-5 h-5 mr-2 text-accent" /> Filter Pulses</SheetTitle>
        <SheetDescription>
          Adjust the distance to find pulses near you. Your current location is used as the center.
        </SheetDescription>
      </SheetHeader>
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
            max={101} // 101 represents "Any" via showAnyDistance toggle
            step={1}
            defaultValue={[distanceFilterKm > 100 && showAnyDistance ? 101 : distanceFilterKm]}
            onValueChange={handleDistanceChange}
            disabled={!location || loadingPosts}
            aria-label="Distance filter"
          />
          {!location && <p className="text-xs text-destructive mt-1">Enable location services to use distance filter.</p>}
        </div>
        <Button 
            variant={showAnyDistance ? "default" : "outline"} 
            onClick={() => {
                setShowAnyDistance(!showAnyDistance);
                if (!showAnyDistance) { // If toggling to "Any"
                    setDistanceFilterKm(101); // Set slider to max to reflect "Any"
                } else { // If toggling off "Any"
                    setDistanceFilterKm(50); // Reset to default or last used
                }
            }}
            disabled={!location || loadingPosts}
            className="w-full"
        >
            {showAnyDistance ? "Set Specific Distance" : "Show Pulses from Any Distance"}
        </Button>
      </div>
      <SheetFooter>
        <SheetClose asChild>
          <Button variant="outline">Close</Button>
        </SheetClose>
      </SheetFooter>
    </>
  );


  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-8">
      <header className="text-center space-y-3 py-6 bg-card/80 backdrop-blur-sm rounded-xl shadow-xl border border-border/70 sticky top-4 z-40">
        <div className="flex items-center justify-center space-x-3">
          <Zap className="h-12 w-12 text-accent drop-shadow-lg" />
          <h1 className="text-5xl font-extrabold text-primary tracking-tight drop-shadow-md">LocalPulse</h1>
        </div>
        <p className="text-xl text-muted-foreground">See what's buzzing around you</p>
      </header>

      {loadingLocation && (
        <Card className="flex flex-col items-center justify-center space-y-3 p-6 rounded-lg shadow-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Fetching your location...</p>
          <Skeleton className="h-4 w-3/4 bg-muted-foreground/20" />
          <Skeleton className="h-4 w-1/2 bg-muted-foreground/20" />
        </Card>
      )}

      {locationError && !loadingLocation && (
        <Alert variant="destructive" className="shadow-lg">
          <Terminal className="h-5 w-5" />
          <AlertTitle className="font-semibold">Location Error</AlertTitle>
          <AlertDescription>{locationError}</AlertDescription>
        </Alert>
      )}

      {!loadingLocation && (
        <div className="space-y-8">
          {location && (
            <Card className="overflow-hidden shadow-2xl border border-border/50 rounded-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-primary flex items-center">
                  <MapPin className="w-6 h-6 mr-2 text-accent" />
                  Share Your Pulse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PostForm onSubmit={handleAddPost} submitting={formSubmitting} />
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Posting from: {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <FilterSheetContent />
              </SheetContent>
            </Sheet>
          </div>


          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-primary pl-1 flex items-center">
              <Zap className="w-7 h-7 mr-2 text-accent opacity-80" />
              Nearby Pulses
            </h2>
            {loadingPosts && !allPosts.length ? ( 
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-4 p-5 bg-card rounded-xl shadow-xl animate-pulse border border-border/30">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full bg-muted" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/3 bg-muted" />
                      <Skeleton className="h-3 w-1/4 bg-muted" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-full bg-muted" />
                  <Skeleton className="h-5 w-5/6 bg-muted" />
                  <Skeleton className="h-40 w-full bg-muted rounded-md" />
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
              <Card className="text-center py-12 rounded-xl shadow-lg border border-border/40">
                <CardContent className="flex flex-col items-center">
                  <Zap className="mx-auto h-16 w-16 text-muted-foreground/40 mb-4" />
                  <p className="text-xl text-muted-foreground">
                    {allPosts.length > 0 && !showAnyDistance ? "No pulses found within this range." : "No pulses found nearby yet."}
                  </p>
                  <p className="text-sm text-muted-foreground/80 mt-1">
                    {allPosts.length > 0 && !showAnyDistance ? "Try expanding the distance or " : ""}
                    Be the first to share what's happening!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

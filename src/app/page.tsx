
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Post, NewPost } from '@/lib/db';
import { getPosts, addPost } from './actions';
import { PostCard } from '@/components/post-card';
import { PostForm } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal, Zap, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const Home: FC = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);


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


  const sortPosts = useCallback((postsToSort: Post[], currentLocation: { latitude: number; longitude: number } | null): Post[] => {
    const sorted = [...postsToSort];
    if (currentLocation) {
      sorted.sort((a, b) => {
        const distA = calculateDistance(currentLocation.latitude, currentLocation.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(currentLocation.latitude, currentLocation.longitude, b.latitude, b.longitude);
        if (Math.abs(distA - distB) < 1) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return distA - distB;
      });
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
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
            description: `Could not get location: ${error.message}. Using default sorting.`,
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
        description: "Geolocation is not supported by this browser. Using default sorting.",
      });
    }
  }, [toast]);


  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        const fetchedPosts = await getPosts();
        setPosts(sortPosts(fetchedPosts, location));
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
      fetchPosts();
    }
  }, [location, loadingLocation, sortPosts, toast]);


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
      setPosts(prevPosts => sortPosts([newPost, ...prevPosts], location));
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


  return (
    <div className="container mx-auto max-w-2xl space-y-10 py-8">
      <header className="text-center space-y-3 py-6 bg-card/50 rounded-xl shadow-sm border border-border">
        <div className="flex items-center justify-center space-x-3">
          <Zap className="h-12 w-12 text-accent" />
          <h1 className="text-5xl font-extrabold text-primary tracking-tight">LocalPulse</h1>
        </div>
        <p className="text-xl text-muted-foreground">See what's buzzing around you</p>
      </header>

      {loadingLocation && (
        <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-card rounded-lg shadow-md">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Fetching your location...</p>
          <Skeleton className="h-4 w-3/4 bg-muted-foreground/30" />
          <Skeleton className="h-4 w-1/2 bg-muted-foreground/30" />
        </div>
      )}

      {locationError && !loadingLocation && (
        <Alert variant="destructive" className="shadow-md">
          <Terminal className="h-5 w-5" />
          <AlertTitle className="font-semibold">Location Error</AlertTitle>
          <AlertDescription>{locationError}</AlertDescription>
        </Alert>
      )}

      {!loadingLocation && (
        <div className="space-y-8">
          {location && (
            <div className="p-6 bg-card rounded-xl shadow-xl border border-border/50">
              <h2 className="text-2xl font-semibold mb-5 text-primary flex items-center">
                <MapPin className="w-6 h-6 mr-2 text-accent" />
                Share Your Pulse
              </h2>
              <PostForm onSubmit={handleAddPost} submitting={formSubmitting} />
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Posting from: {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
              </p>
            </div>
          )}

          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-primary pl-1">Nearby Pulses</h2>
            {loadingPosts ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-4 p-5 bg-card rounded-lg shadow-lg animate-pulse border border-border/30">
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
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  userLocation={location}
                  calculateDistance={calculateDistance}
                />
              ))
            ) : (
              <div className="text-center py-12 bg-card rounded-lg shadow-md border border-border/30">
                 <Zap className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-xl text-muted-foreground">No pulses found nearby yet.</p>
                <p className="text-sm text-muted-foreground">Be the first to share what's happening!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

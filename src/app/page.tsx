'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { Post } from '@/lib/db';
import { getPosts, addPost } from './actions';
import { PostCard } from '@/components/post-card';
import { PostForm } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal } from 'lucide-react';

const Home: FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError(null);
          setLoading(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationError(`Error getting location: ${error.message}. Please ensure location services are enabled.`);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        const fetchedPosts = await getPosts();
        // Sort posts: prioritize those closer to the user if location is available
        if (location) {
          fetchedPosts.sort((a, b) => {
            const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
            const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
            // Combine proximity and recency (newer posts first within similar distances)
            if (Math.abs(distA - distB) < 1) { // If distances are very close (e.g., within 1km)
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return distA - distB;
          });
        } else {
           // If location is not available, sort by recency only
          fetchedPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Error fetching posts:", error);
        // Handle fetch error (e.g., show a toast notification)
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchPosts();
  }, [location]); // Re-fetch and sort when location changes

  const handleAddPost = async (content: string) => {
    if (!location) {
      setLocationError("Cannot post without location. Please enable location services.");
      return;
    }
    setFormSubmitting(true);
    try {
      const newPost = await addPost({
        content,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      // Add the new post optimistically and re-sort
      setPosts(prevPosts => {
         const updatedPosts = [newPost, ...prevPosts];
          if (location) {
            updatedPosts.sort((a, b) => {
              const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
              const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
              if (Math.abs(distA - distB) < 1) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
              return distA - distB;
            });
          } else {
             updatedPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
         return updatedPosts;
       });
    } catch (error) {
      console.error("Error adding post:", error);
      // Handle add post error (e.g., show a toast notification)
    } finally {
      setFormSubmitting(false);
    }
  };

  // Helper function to calculate distance (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-8">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-primary">LocalPulse</h1>
        <p className="text-lg text-muted-foreground">See what's buzzing around you</p>
      </header>

      {loading && (
        <div className="flex items-center justify-center space-x-2 p-4 bg-secondary rounded-lg shadow">
           <Skeleton className="h-5 w-5 rounded-full bg-muted-foreground/50" />
           <Skeleton className="h-4 w-48 bg-muted-foreground/50" />
        </div>
      )}

      {locationError && !loading && (
         <Alert variant="destructive">
           <Terminal className="h-4 w-4" />
           <AlertTitle>Location Error</AlertTitle>
           <AlertDescription>{locationError}</AlertDescription>
         </Alert>
      )}

      {location && !loading && (
        <div className="space-y-6">
           <div className="p-4 bg-card rounded-lg shadow">
             <h2 className="text-xl font-semibold mb-4 text-primary">Post Something Nearby</h2>
             <PostForm onSubmit={handleAddPost} submitting={formSubmitting} />
             <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
               <MapPin className="w-3 h-3" />
               Posting from: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
             </p>
           </div>

           <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">Nearby Posts</h2>
             {loadingPosts ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2 p-4 bg-card rounded-lg shadow animate-pulse">
                    <Skeleton className="h-4 w-3/4 bg-muted" />
                    <Skeleton className="h-4 w-1/2 bg-muted" />
                    <Skeleton className="h-3 w-1/4 bg-muted" />
                  </div>
                ))
             ) : posts.length > 0 ? (
               posts.map((post) => (
                 <PostCard key={post.id} post={post} userLocation={location} calculateDistance={calculateDistance} />
               ))
             ) : (
               <p className="text-center text-muted-foreground py-8">No posts found nearby. Be the first!</p>
             )}
           </div>
        </div>
      )}
    </div>
  );
};

export default Home;

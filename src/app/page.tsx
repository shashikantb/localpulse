
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import type { Post, NewPost } from '@/lib/db'; // Import NewPost
import { getPosts, addPost } from './actions';
import { PostCard } from '@/components/post-card';
import { PostForm } from '@/components/post-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Terminal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"; // Import useToast

const Home: FC = () => {
  const { toast } = useToast(); // Initialize toast
  const [posts, setPosts] = useState<Post[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);


  // Helper function to calculate distance (Haversine formula) - Memoized
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
   }, []); // Empty dependency array as the formula itself doesn't change


   // Function to sort posts - Memoized
   const sortPosts = useCallback((postsToSort: Post[], currentLocation: { latitude: number; longitude: number } | null): Post[] => {
     const sorted = [...postsToSort]; // Create a copy to avoid mutating state directly
     if (currentLocation) {
       sorted.sort((a, b) => {
         const distA = calculateDistance(currentLocation.latitude, currentLocation.longitude, a.latitude, a.longitude);
         const distB = calculateDistance(currentLocation.latitude, currentLocation.longitude, b.latitude, b.longitude);
         // Combine proximity and recency (newer posts first within similar distances)
         if (Math.abs(distA - distB) < 1) { // If distances are very close (e.g., within 1km)
           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
         }
         return distA - distB;
       });
     } else {
       // If location is not available, sort by recency only
       sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
     }
     return sorted;
   }, [calculateDistance]); // Depends on calculateDistance


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
           toast({ // Toast for location error
            variant: "destructive",
            title: "Location Error",
            description: `Could not get location: ${error.message}. Using default sorting.`,
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
      setLoading(false);
      toast({ // Toast for geolocation not supported
         variant: "destructive",
         title: "Location Error",
         description: "Geolocation is not supported by this browser. Using default sorting.",
       });
    }
  }, [toast]); // Add toast to dependency array


  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        const fetchedPosts = await getPosts();
        setPosts(sortPosts(fetchedPosts, location)); // Use the memoized sort function
      } catch (error) {
        console.error("Error fetching posts:", error);
        toast({ // Toast for fetch error
           variant: "destructive",
           title: "Fetch Error",
           description: "Could not load posts. Please try again later.",
         });
      } finally {
        setLoadingPosts(false);
      }
    };

    // Fetch posts immediately and whenever location becomes available or changes
     if (!loading) { // Only fetch if location loading is done (or errored)
        fetchPosts();
     }
  }, [location, loading, sortPosts, toast]); // Add loading, sortPosts, toast to dependency array


  const handleAddPost = async (content: string, mediaUrl?: string, mediaType?: 'image' | 'video') => {
    if (!location) {
        const errMessage = "Cannot post without location. Please enable location services.";
        setLocationError(errMessage);
        toast({ // Toast for missing location on post attempt
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

      // Add the new post optimistically and re-sort
      setPosts(prevPosts => sortPosts([newPost, ...prevPosts], location)); // Use memoized sort

       toast({ // Success toast
         title: "Post Added",
         description: "Your post is now live!",
       });

    } catch (error) {
      console.error("Error adding post:", error);
       toast({ // Toast for add post error
         variant: "destructive",
         title: "Post Error",
         description: "Failed to add your post. Please try again.",
       });
    } finally {
      setFormSubmitting(false);
    }
  };


  return (
    <div className="container mx-auto max-w-3xl space-y-8">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-primary">LocalPulse</h1>
        <p className="text-lg text-muted-foreground">See what's buzzing around you</p>
      </header>

      {/* Location Loading Skeleton */}
      {loading && (
        <div className="flex items-center justify-center space-x-2 p-4 bg-secondary rounded-lg shadow">
           <Skeleton className="h-5 w-5 rounded-full bg-muted-foreground/50" />
           <Skeleton className="h-4 w-48 bg-muted-foreground/50" />
        </div>
      )}

      {/* Location Error Alert */}
      {locationError && !loading && (
         <Alert variant="destructive">
           <Terminal className="h-4 w-4" />
           <AlertTitle>Location Error</AlertTitle>
           <AlertDescription>{locationError}</AlertDescription>
         </Alert>
      )}

      {/* Main Content: Post Form and Feed */}
      { !loading && ( // Render form and feed section once location loading is complete (success or error)
        <div className="space-y-6">
           {/* Render PostForm only if location is available */}
           {location && (
               <div className="p-4 bg-card rounded-lg shadow">
                 <h2 className="text-xl font-semibold mb-4 text-primary">Post Something Nearby</h2>
                 <PostForm onSubmit={handleAddPost} submitting={formSubmitting} />
                 <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                   <MapPin className="w-3 h-3" />
                   Posting from: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                 </p>
               </div>
           )}

           {/* Post Feed Section */}
           <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">Nearby Posts</h2>
             {loadingPosts ? (
                // Post Loading Skeletons
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-3 p-4 bg-card rounded-lg shadow animate-pulse">
                    <div className="flex items-center space-x-2">
                         <Skeleton className="h-3 w-1/4 bg-muted" /> {/* Timestamp */}
                         <Skeleton className="h-3 w-1/4 bg-muted" /> {/* Distance */}
                    </div>
                    <Skeleton className="h-4 w-full bg-muted" /> {/* Content line 1 */}
                    <Skeleton className="h-4 w-5/6 bg-muted" /> {/* Content line 2 */}
                     <Skeleton className="h-32 w-full bg-muted" /> {/* Media Placeholder */}
                  </div>
                ))
             ) : posts.length > 0 ? (
                 // Actual Posts
                 posts.map((post) => (
                 <PostCard
                    key={post.id}
                    post={post}
                    userLocation={location}
                    calculateDistance={calculateDistance}
                 />
                 ))
             ) : (
               // No Posts Message
               <p className="text-center text-muted-foreground py-8">No posts found nearby. Be the first!</p>
             )}
           </div>
        </div>
      )}
    </div>
  );
};

export default Home;

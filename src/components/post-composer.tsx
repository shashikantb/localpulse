'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { NewPost, User } from '@/lib/db-types';
import { addPost } from '@/app/actions';
import { PostForm } from '@/components/post-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Zap } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface PostComposerProps {
  sessionUser: User | null;
}

const PostComposer: FC<PostComposerProps> = ({ sessionUser }) => {
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  const getGeoLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          let errorMessage = `Error getting location: ${error.message}. Please ensure location services are enabled.`;
          if (error.code === error.PERMISSION_DENIED && error.message.includes('Only secure origins are allowed')) {
            errorMessage = `Error getting location: Location access is only available on secure (HTTPS) connections. Functionality might be limited. Enable HTTPS for your site.`;
          }
          reject(new Error(errorMessage));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  useEffect(() => {
    setIsLoadingLocation(true);
    setLocationError(null);
    getGeoLocation()
      .then(loc => {
        setLocation(loc);
        setIsLoadingLocation(false);
      })
      .catch((error: Error) => {
        setLocationError(error.message);
        setIsLoadingLocation(false);
      });
  }, []);

  const handleAddPost = async (content: string, hashtags: string[], mediaUrl?: string, mediaType?: 'image' | 'video', mentionedUserIds?: number[]) => {
    if (!content.trim()) {
      toast({ variant: "destructive", title: "Post Error", description: "Post content cannot be empty." });
      return;
    }

    setFormSubmitting(true);
    
    if (!location) {
        setLocationError("Location has not been determined. Please enable location services and reload the page.");
        toast({ variant: "destructive", title: "Location Required", description: "Could not determine your location." });
        setFormSubmitting(false);
        return;
    }
    setLocationError(null);
    
    try {
      const postData: NewPost = {
        content,
        latitude: location.latitude,
        longitude: location.longitude,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        hashtags: hashtags || [],
        authorId: sessionUser ? sessionUser.id : undefined,
        mentionedUserIds: mentionedUserIds || [],
      };
      const result = await addPost(postData);

      if (result.error) {
        toast({ variant: "destructive", title: "Post Error", description: result.error || "Failed to add post." });
      } else if (result.post) {
        toast({ title: "Post Added!", description: "Your pulse is now live! It will appear in the feed shortly.", variant: "default", className: "bg-primary text-primary-foreground" });
      } else {
        toast({ variant: "destructive", title: "Post Error", description: "An unexpected issue occurred." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Post Error", description: error.message || "An unexpected error." });
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <>
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
        </CardHeader>
        <CardContent className="p-5">
          <PostForm onSubmit={handleAddPost} submitting={formSubmitting || isLoadingLocation} />
        </CardContent>
      </Card>
    </>
  );
};

export default PostComposer;

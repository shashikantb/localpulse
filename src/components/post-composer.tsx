
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { NewPost, User } from '@/lib/db-types';
import { addPost } from '@/app/actions';
import { PostForm } from '@/components/post-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface PostComposerProps {
  sessionUser: User | null;
  onPostSuccess: () => void;
}

const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  // This regex handles youtu.be, /embed/, /v/, /watch?v=, and &v= formats
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[2].length === 11) {
    return match[2];
  }
  return null;
};


const PostComposer: FC<PostComposerProps> = ({ sessionUser, onPostSuccess }) => {
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);

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

  const handleAddPost = async (content: string, hashtags: string[], mediaUrl?: string, mediaType?: 'image' | 'video', mentionedUserIds?: number[]) => {
    if (!location) {
      const errMessage = locationError || "Cannot determine location. Please enable location services and refresh.";
      toast({ variant: "destructive", title: "Location Error", description: errMessage });
      return;
    }
    // Content can be empty if there's a video link
    if (!content.trim() && !getYouTubeVideoId(content)) {
      toast({ variant: "destructive", title: "Post Error", description: "Post content cannot be empty." });
      return;
    }

    setFormSubmitting(true);

    let finalContent = content;
    let finalMediaUrl = mediaUrl;
    let finalMediaType = mediaType;
    
    // Check for YouTube link in the original content
    const youtubeId = getYouTubeVideoId(content);
        
    if (youtubeId) {
      finalMediaUrl = `https://www.youtube.com/embed/${youtubeId}`;
      finalMediaType = 'video';
      
      // Remove the original YouTube link from the content to avoid redundancy
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:u\/\w\/)?([^#&?\s]+)/g;
      finalContent = content.replace(urlRegex, '').trim();

      if (mediaUrl) { // If a file was uploaded AND a youtube link was found
          toast({
              title: "Media Priority",
              description: "A YouTube link was found, so it will be used as the media for this post instead of the uploaded file.",
              variant: "default",
          });
      }
    }


    try {
      const postData: NewPost = {
        content: finalContent,
        latitude: location.latitude,
        longitude: location.longitude,
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        hashtags: hashtags || [],
        authorId: sessionUser ? sessionUser.id : undefined,
        mentionedUserIds: mentionedUserIds || [],
      };
      const result = await addPost(postData);

      if (result.error) {
        toast({ variant: "destructive", title: "Post Error", description: result.error || "Failed to add post." });
      } else if (result.post) {
        toast({ title: "Post Added!", description: "Your pulse is now live! It will appear in the feed shortly.", variant: "default", className: "bg-primary text-primary-foreground" });
        onPostSuccess();
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
    <div className="pt-4">
      {locationError && (
        <Alert variant="destructive" className="mb-4">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Location Error</AlertTitle>
          <AlertDescription>
            {locationError}
          </AlertDescription>
        </Alert>
      )}

      {loadingLocation && (
        <div className="flex items-center justify-center text-sm text-muted-foreground p-4">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Determining your location...
        </div>
      )}
      
      <PostForm onSubmit={handleAddPost} submitting={formSubmitting || loadingLocation} />
    </div>
  );
};

export default PostComposer;

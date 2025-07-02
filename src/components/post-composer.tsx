
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
    if (!location && !locationError) {
      console.warn("Location not yet available. Please wait.");
      return;
    }
    
    if(locationError) {
        console.error("Cannot post due to location error:", locationError);
        return;
    }

    if (!content.trim() && !mediaUrl) {
      console.error("Post content cannot be empty without media.");
      return;
    }

    setFormSubmitting(true);

    let finalContent = content;
    let finalMediaUrl = mediaUrl;
    let finalMediaType = mediaType;
    
    // Check for YouTube link in the original content
    const youtubeId = getYouTubeVideoId(content);
        
    if (youtubeId && !mediaUrl) { // Only convert to YouTube embed if no other file is uploaded
      finalMediaUrl = `https://www.youtube.com/embed/${youtubeId}`;
      finalMediaType = 'video';
      
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:u\/\w\/)?([^#&?\s]+)/g;
      finalContent = content.replace(urlRegex, '').trim();
    }


    try {
      const postData: NewPost = {
        content: finalContent,
        latitude: location!.latitude,
        longitude: location!.longitude,
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        hashtags: hashtags || [],
        authorId: sessionUser ? sessionUser.id : undefined,
        mentionedUserIds: mentionedUserIds || [],
      };
      const result = await addPost(postData);

      if (result.error) {
        console.error("Failed to add post:", result.error);
      } else if (result.post) {
        toast({ title: "Post Added!", description: "Your pulse is now live! It will appear in the feed shortly.", variant: "default", className: "bg-primary text-primary-foreground" });
        onPostSuccess();
      }
    } catch (error: any) {
      console.error("An unexpected error occurred while adding post:", error.message);
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

import type { FC } from 'react';
import Image from 'next/image'; // Import next/image
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Post } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Image as ImageIcon, Video } from 'lucide-react'; // Import icons

interface PostCardProps {
  post: Post;
  userLocation: { latitude: number; longitude: number } | null;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export const PostCard: FC<PostCardProps> = ({ post, userLocation, calculateDistance }) => {
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const distance = userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude) : null;

  return (
    <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2">
        {/* Optionally add a title or user info here later */}
        {/* <CardTitle>User Name</CardTitle> */}
        <CardDescription className="text-xs text-muted-foreground flex items-center justify-between">
           <span>{timeAgo}</span>
           {post.mediaType && (
              <span className="flex items-center gap-1">
                {post.mediaType === 'image' && <ImageIcon className="w-3 h-3" />}
                {post.mediaType === 'video' && <Video className="w-3 h-3" />}
                {post.mediaType.charAt(0).toUpperCase() + post.mediaType.slice(1)} Attached
              </span>
            )}
        </CardDescription>
      </CardHeader>
       {/* Media Display Area */}
      {post.mediaUrl && post.mediaType && (
        <div className="px-6 pb-4 pt-0"> {/* Use CardContent padding */}
          {post.mediaType === 'image' && post.mediaUrl.startsWith('data:image') && (
            <div className="relative w-full h-64 overflow-hidden rounded-md border">
               {/* Ensure mediaUrl is treated as a string for src */}
              <Image
                  src={post.mediaUrl as string}
                  alt="Post image"
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="user generated content"
              />
            </div>
          )}
          {post.mediaType === 'video' && post.mediaUrl.startsWith('data:video') && (
            <div className="mt-2">
              {/* Ensure mediaUrl is treated as a string for src */}
              <video controls src={post.mediaUrl as string} className="w-full max-h-64 rounded-md border" />
            </div>
          )}
        </div>
      )}
      <CardContent className={post.mediaUrl ? 'pt-0' : ''}> {/* Remove top padding if media is shown */}
        <p className="text-foreground">{post.content}</p>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground flex items-center justify-between pt-2">
         <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-primary" />
            <span>{post.latitude.toFixed(4)}, {post.longitude.toFixed(4)}</span>
         </div>
        {distance !== null && (
          <span>{distance < 0.1 ? '< 100m away' : `${distance.toFixed(1)} km away`}</span>
        )}
      </CardFooter>
    </Card>
  );
};

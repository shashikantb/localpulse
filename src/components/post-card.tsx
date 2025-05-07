
import type { FC } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Added Avatar
import type { Post } from '@/lib/db';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, Image as ImageIcon, Video, UserCircle } from 'lucide-react'; // Added UserCircle

interface PostCardProps {
  post: Post;
  userLocation: { latitude: number; longitude: number } | null;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export const PostCard: FC<PostCardProps> = ({ post, userLocation, calculateDistance }) => {
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true });
  const distance = userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude) : null;

  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border/50 rounded-xl">
      <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center space-x-3">
        <Avatar className="h-10 w-10 border-2 border-primary/50">
          {/* <AvatarImage src="https://picsum.photos/40/40" alt="User avatar" data-ai-hint="person" /> */}
          <AvatarFallback className="bg-muted">
            <UserCircle className="h-6 w-6 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div>
          {/* <CardTitle className="text-base font-semibold">Anonymous User</CardTitle> */}
          <CardDescription className="text-xs text-muted-foreground">
            {timeAgo}
          </CardDescription>
        </div>
      </CardHeader>

      {post.mediaUrl && post.mediaType && (
        <div className="px-5 pb-0 pt-0">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border shadow-inner bg-muted/50">
            {post.mediaType === 'image' && post.mediaUrl.startsWith('data:image') && (
              <Image
                src={post.mediaUrl as string}
                alt="Post image"
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="user generated content"
              />
            )}
            {post.mediaType === 'video' && post.mediaUrl.startsWith('data:video') && (
              <video controls src={post.mediaUrl as string} className="w-full h-full object-cover" />
            )}
          </div>
        </div>
      )}

      <CardContent className={`px-5 ${post.mediaUrl ? 'pt-4' : 'pt-0'} pb-3`}>
        <p className="text-foreground leading-relaxed text-base whitespace-pre-wrap break-words">{post.content}</p>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground flex items-center justify-between pt-2 pb-4 px-5 border-t border-border/50 mt-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span>{post.latitude.toFixed(3)}, {post.longitude.toFixed(3)}</span>
          {distance !== null && (
            <span className="ml-2 text-primary/80 font-medium">
              ({distance < 0.1 ? '< 100m' : `${distance.toFixed(1)} km`})
            </span>
          )}
        </div>
        {post.mediaType && (
          <span className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-[10px] font-medium">
            {post.mediaType === 'image' && <ImageIcon className="w-3 h-3" />}
            {post.mediaType === 'video' && <Video className="w-3 h-3" />}
            {post.mediaType.charAt(0).toUpperCase() + post.mediaType.slice(1)}
          </span>
        )}
      </CardFooter>
    </Card>
  );
};

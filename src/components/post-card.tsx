import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Post } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';
import { MapPin } from 'lucide-react';

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
        <CardDescription className="text-xs text-muted-foreground">{timeAgo}</CardDescription>
      </CardHeader>
      <CardContent>
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

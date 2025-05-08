
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Post, Comment as CommentType } from '@/lib/db'; // Renamed to avoid conflict
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, Image as ImageIcon, Video, UserCircle, Heart, MessageCircle, Send, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toggleLikePost, addComment, getComments } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface PostCardProps {
  post: Post;
  userLocation: { latitude: number; longitude: number } | null;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

const CommentCard: FC<{ comment: CommentType }> = ({ comment }) => {
  return (
    <div className="flex space-x-3 py-3">
      <Avatar className="h-8 w-8 border-2 border-primary/30">
        <AvatarFallback className="bg-muted text-xs">
          {comment.author.substring(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{comment.author}</h4>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNowStrict(new Date(comment.createdAt), { addSuffix: true })}
          </p>
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{comment.content}</p>
      </div>
    </div>
  );
};

export const PostCard: FC<PostCardProps> = ({ post, userLocation, calculateDistance }) => {
  const { toast } = useToast();
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true });
  const distance = userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude) : null;

  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likeCount);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);


  useEffect(() => {
    const likedStatus = localStorage.getItem(`post-liked-${post.id}`);
    if (likedStatus) {
      setIsLiked(JSON.parse(likedStatus));
    }
  }, [post.id]);

  const fetchPostComments = useCallback(async () => {
    if (!showComments) return; // Only fetch if section is open
    setIsLoadingComments(true);
    try {
      const fetchedComments = await getComments(post.id);
      setComments(fetchedComments);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch comments.' });
    } finally {
      setIsLoadingComments(false);
    }
  }, [post.id, showComments, toast]);
  
  useEffect(() => {
    fetchPostComments();
  }, [fetchPostComments]);


  const handleLikeClick = async () => {
    const newLikedState = !isLiked;
    const newLikeCount = displayLikeCount + (newLikedState ? 1 : -1);

    setIsLiked(newLikedState);
    setDisplayLikeCount(newLikeCount);
    localStorage.setItem(`post-liked-${post.id}`, JSON.stringify(newLikedState));

    try {
      const updatedPost = await toggleLikePost(post.id, newLikedState); 
      if (updatedPost) {
        setDisplayLikeCount(updatedPost.likeCount); 
      } else {
        setIsLiked(!newLikedState);
        setDisplayLikeCount(displayLikeCount);
        localStorage.setItem(`post-liked-${post.id}`, JSON.stringify(!newLikedState));
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update like.' });
      }
    } catch (error) {
      setIsLiked(!newLikedState);
      setDisplayLikeCount(displayLikeCount);
      localStorage.setItem(`post-liked-${post.id}`, JSON.stringify(!newLikedState));
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update like.' });
    }
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Comment cannot be empty.' });
      return;
    }
    setIsSubmittingComment(true);
    try {
      // Using "Anonymous" as author for now, can be extended later
      const added = await addComment({ postId: post.id, content: newComment.trim(), author: 'Anonymous' });
      setComments(prev => [added, ...prev]); 
      setNewComment('');
      toast({ title: 'Success', description: 'Comment posted!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not post comment.' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 ease-out border border-border/60 rounded-xl bg-card hover:border-primary/50">
      <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-start space-x-3">
        <Avatar className="h-10 w-10 border-2 border-primary/50 shadow-sm">
          {/* Placeholder for user avatar if available, otherwise fallback */}
          {/* <AvatarImage src={post.authorAvatarUrl} alt={post.authorName} /> */}
          <AvatarFallback className="bg-muted">
            <UserCircle className="h-6 w-6 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          {/* <CardTitle className="text-base font-semibold">{post.authorName || 'Anonymous User'}</CardTitle> */}
          <CardDescription className="text-xs text-muted-foreground">
            {timeAgo}
          </CardDescription>
        </div>
      </CardHeader>

      {post.mediaUrl && post.mediaType && (
        <div className="px-5 pb-0 pt-0">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border shadow-inner bg-muted/50 group">
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

      <CardContent className={`px-5 ${post.mediaUrl ? 'pt-4' : 'pt-2'} pb-3`}>
        <p className="text-foreground leading-relaxed text-base whitespace-pre-wrap break-words">{post.content}</p>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground flex flex-wrap items-center justify-between pt-2 pb-3 px-5 border-t border-border/40 mt-1 gap-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          {post.city && post.city !== "Unknown City" && <span className="font-medium text-primary/90">{post.city}</span>}
          <span className={post.city && post.city !== "Unknown City" ? "text-muted-foreground/80" : ""}>
            ({post.latitude.toFixed(3)}, {post.longitude.toFixed(3)})
          </span>
          {distance !== null && (
            <span className="ml-1 text-primary/80 font-medium">
              ({distance < 0.1 ? '< 100m' : `${distance.toFixed(1)} km`})
            </span>
          )}
        </div>
        {post.mediaType && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-[10px] font-medium shadow-sm">
            {post.mediaType === 'image' && <ImageIcon className="w-3 h-3" />}
            {post.mediaType === 'video' && <Video className="w-3 h-3" />}
            {post.mediaType.charAt(0).toUpperCase() + post.mediaType.slice(1)}
          </span>
        )}
      </CardFooter>
      
      <div className="px-5 pb-4 pt-2 flex items-center space-x-4 border-t border-border/30 bg-card/20">
        <Button variant="ghost" size="sm" onClick={handleLikeClick} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150">
          <Heart className={`w-4 h-4 transition-all duration-200 ${isLiked ? 'fill-red-500 text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
          <span className="font-medium">{displayLikeCount} {displayLikeCount === 1 ? 'Like' : 'Likes'}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150">
          <MessageCircle className="w-4 h-4" />
          <span className="font-medium">{comments.length > 0 ? `${comments.length} ` : ''}{showComments ? 'Hide' : 'Comments'}</span>
        </Button>
      </div>

      {showComments && (
        <div className="px-5 pb-4 border-t border-border/30 pt-3 bg-muted/30">
          <h4 className="text-sm font-semibold mb-3 text-primary">Comments</h4>
          <form onSubmit={handleCommentSubmit} className="space-y-2 mb-4">
            <div className="flex items-start space-x-2">
              <Textarea
                placeholder="Add your thoughts..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                className="text-sm flex-grow min-h-[40px] shadow-sm focus:ring-primary/60"
                disabled={isSubmittingComment}
              />
              <Button type="submit" size="icon" variant="outline" disabled={isSubmittingComment || !newComment.trim()} className="h-auto p-2.5 self-end shadow-sm hover:bg-primary/10">
                <Send className="w-4 h-4 text-primary" />
              </Button>
            </div>
          </form>

          {isLoadingComments && <p className="text-xs text-muted-foreground py-2">Loading comments...</p>}
          {!isLoadingComments && comments.length === 0 && <p className="text-xs text-muted-foreground py-2">No comments yet. Be the first to share your thoughts!</p>}
          {!isLoadingComments && comments.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto pr-2 rounded-md border-t border-border/20 pt-2 mt-2">
              {comments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

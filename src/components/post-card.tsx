
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Post, Comment as CommentType } from '@/lib/db-types';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, Image as ImageIcon, Video, UserCircle, Heart, MessageCircle, Send, Map, CornerDownRight } from 'lucide-react';
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
    <div className="flex space-x-3 py-3 pl-2 border-l-2 border-primary/20 ml-1 hover:border-primary/50 transition-colors duration-200 bg-transparent hover:bg-primary/5 rounded-r-md">
      <Avatar className="h-9 w-9 border-2 border-primary/40 flex-shrink-0 mt-1 shadow-sm">
        <AvatarFallback className="bg-muted text-sm font-semibold text-primary/80">
          {comment.author.substring(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground/90">{comment.author}</h4>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNowStrict(new Date(comment.createdat), { addSuffix: true })}
          </p>
        </div>
        <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{comment.content}</p>
      </div>
    </div>
  );
};

export const PostCard: FC<PostCardProps> = ({ post, userLocation, calculateDistance }) => {
  const { toast } = useToast();
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdat), { addSuffix: true });
  const distance = userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude) : null;

  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likecount);
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
    if (!showComments) return; 
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
      const updatedPostData = await toggleLikePost(post.id, newLikedState); 
      if (updatedPostData) {
        // Use likecount from the response as it's the source of truth
        setDisplayLikeCount(updatedPostData.likecount); 
      } else {
        // Revert optimistic update on failure
        setIsLiked(!newLikedState);
        setDisplayLikeCount(displayLikeCount); // Revert to original count
        localStorage.setItem(`post-liked-${post.id}`, JSON.stringify(!newLikedState));
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update like.' });
      }
    } catch (error) {
      // Revert optimistic update on error
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
      const added = await addComment({ postId: post.id, content: newComment.trim(), author: 'PulseFan' }); // Changed author
      setComments(prev => [added, ...prev]); 
      setNewComment('');
      toast({ title: 'Comment Pulsed!', description: 'Your thoughts are now part of the vibe.', className:"bg-accent text-accent-foreground" });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not post comment.' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 ease-out border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm hover:border-primary/50 transform hover:scale-[1.005]">
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-start space-x-4">
        <Avatar className="h-12 w-12 border-2 border-primary/60 shadow-md">
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
            <UserCircle className="h-7 w-7 text-primary/80" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardDescription className="text-xs text-muted-foreground font-medium">
            Pulsed {timeAgo}
          </CardDescription>
            {post.city && post.city !== "Unknown City" && (
                 <p className="text-sm text-primary font-semibold flex items-center mt-0.5">
                    <MapPin className="w-4 h-4 mr-1.5 text-accent flex-shrink-0" /> {post.city}
                </p>
            )}
        </div>
      </CardHeader>

      {post.mediaurl && post.mediatype && (
        <div className="px-5 pb-0 pt-2">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border-2 border-border/50 shadow-inner bg-muted/50 group">
            {post.mediatype === 'image' && post.mediaurl.startsWith('data:image') && (
              <Image
                src={post.mediaurl as string}
                alt="Post image"
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="user generated content"
              />
            )}
            {post.mediatype === 'video' && post.mediaurl.startsWith('data:video') && (
              <video controls src={post.mediaurl as string} className="w-full h-full object-cover" />
            )}
             <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-md backdrop-blur-sm">
                {post.mediatype.charAt(0).toUpperCase() + post.mediatype.slice(1)}
            </div>
          </div>
        </div>
      )}

      <CardContent className={`px-5 ${post.mediaurl ? 'pt-4' : 'pt-2'} pb-3`}>
        <p className="text-foreground/90 leading-relaxed text-base whitespace-pre-wrap break-words">{post.content}</p>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground flex flex-wrap items-center justify-between pt-2 pb-3 px-5 border-t border-border/40 mt-1 gap-y-2 bg-card/50">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Map className="w-4 h-4 text-primary/70 flex-shrink-0" />
           <span className="font-medium text-muted-foreground">
            Location: {post.latitude.toFixed(3)}, {post.longitude.toFixed(3)}
          </span>
          {distance !== null && (
            <span className="ml-1 text-accent font-semibold">
              (approx. {distance < 0.1 ? '<100m' : `${distance.toFixed(1)} km`} away)
            </span>
          )}
        </div>
      </CardFooter>
      
      <div className="px-5 pb-4 pt-2 flex items-center space-x-4 border-t border-border/30 bg-card/20">
        <Button variant="ghost" size="sm" onClick={handleLikeClick} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group">
          <Heart className={`w-5 h-5 transition-all duration-200 group-hover:scale-110 ${isLiked ? 'fill-red-500 text-red-500 animate-pulse' : 'text-muted-foreground group-hover:text-red-400'}`} />
          <span className="font-medium text-sm">{displayLikeCount} {displayLikeCount === 1 ? 'Like' : 'Likes'}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setShowComments(!showComments); if(!showComments) fetchPostComments(); }} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group">
          <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">{comments.length > 0 ? `${comments.length} ` : ''}{showComments ? 'Hide' : (comments.length > 0 ? 'Comments' : 'Comment')}</span>
        </Button>
      </div>

      {showComments && (
        <div className="px-5 pb-4 border-t border-border/30 pt-4 bg-muted/20">
          <h4 className="text-base font-semibold mb-3 text-primary flex items-center">
            <CornerDownRight className="w-4 h-4 mr-2 text-accent"/>
            Vibes & Thoughts
          </h4>
          <form onSubmit={handleCommentSubmit} className="space-y-3 mb-4">
            <div className="flex items-start space-x-3">
              <Avatar className="h-10 w-10 border-2 border-accent/50 flex-shrink-0 shadow-sm">
                <AvatarFallback className="bg-muted text-accent font-semibold">
                  P
                </AvatarFallback>
              </Avatar>
              <Textarea
                placeholder="Share your vibe on this pulse..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                className="text-sm flex-grow min-h-[40px] shadow-inner focus:ring-2 focus:ring-primary/60 bg-background/70 rounded-lg"
                disabled={isSubmittingComment}
              />
              <Button type="submit" size="icon" variant="ghost" disabled={isSubmittingComment || !newComment.trim()} className="h-10 w-10 self-end shadow-sm hover:bg-primary/10 border border-transparent hover:border-primary/30 group">
                <Send className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </Button>
            </div>
          </form>

          {isLoadingComments && <p className="text-xs text-center text-muted-foreground py-3">Loading comments...</p>}
          {!isLoadingComments && comments.length === 0 && <p className="text-sm text-center text-muted-foreground py-4 italic">No thoughts shared yet. Be the first to vibe!</p>}
          
          {!isLoadingComments && comments.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2 rounded-md border-t border-border/20 pt-3 mt-3 custom-scrollbar">
              {comments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

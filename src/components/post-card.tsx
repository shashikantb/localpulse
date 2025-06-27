
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Post, Comment as CommentType, User } from '@/lib/db-types';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, UserCircle, MessageCircle, Send, Map, CornerDownRight, Share2, Rss, ThumbsUp, Tag, ShieldCheck, Building, Eye, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toggleLikePost, addComment, getComments, recordPostView } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

interface PostCardProps {
  post: Post;
  userLocation: { latitude: number; longitude: number } | null;
  sessionUser: User | null;
}

export const PostCard: FC<PostCardProps> = ({ post, userLocation, sessionUser }) => {
  const { toast } = useToast();
  
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number | null => {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
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
  
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdat), { addSuffix: true });
  const distance = userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude) : null;
  
  const authorName = post.authorname || 'Anonymous Pulsar';
  const authorRole = post.authorrole;

  const [isLiked, setIsLiked] = useState(post.isLikedByCurrentUser || false);
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likecount);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);
  const [wasViewed, setWasViewed] = useState(false);

  useEffect(() => {
    // Only run view tracking if it's not the author's own post.
    if (sessionUser && sessionUser.id === post.authorid) {
        return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !wasViewed) {
          recordPostView(post.id);
          setWasViewed(true); // Ensure it's only called once per page load
          observer.disconnect(); // We're done with this observer for this card
        }
      },
      { threshold: 0.6 } // Trigger when 60% of the card is visible
    );

    const currentCardRef = cardRef.current;
    if (currentCardRef) {
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef) {
        observer.unobserve(currentCardRef);
      }
      observer.disconnect();
    };
  }, [post.id, wasViewed, sessionUser, post.authorid]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);
  
  // Sync state if post prop changes (e.g., from feed refresh)
  useEffect(() => {
    setIsLiked(post.isLikedByCurrentUser || false);
    setDisplayLikeCount(post.likecount);
  }, [post.isLikedByCurrentUser, post.likecount]);


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
    if (!sessionUser) {
        toast({
            variant: "destructive",
            title: "Authentication Required",
            description: "You must be logged in to like a pulse.",
        });
        return;
    }
    if (isLiking) return;
    setIsLiking(true);

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setDisplayLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
        const result = await toggleLikePost(post.id);
        if (result.error || !result.post) {
            // Revert on failure
            setIsLiked(wasLiked);
            setDisplayLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
            toast({ variant: 'destructive', title: 'Like Error', description: result.error || 'Could not update like status.' });
        } else {
            // Sync with server state
            setDisplayLikeCount(result.post.likecount);
            setIsLiked(result.post.isLikedByCurrentUser || false);
        }
    } catch (error: any) {
        // Revert on exception
        setIsLiked(wasLiked);
        setDisplayLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        toast({ variant: 'destructive', title: 'Like Error', description: error.message || 'An unexpected error occurred.' });
    } finally {
        setIsLiking(false);
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
      // Use session user's name if available, otherwise a default
      const author = sessionUser?.name || 'PulseFan';
      const added = await addComment({ postId: post.id, content: newComment.trim(), author });
      setComments(prev => [added, ...prev]);
      setNewComment('');
      toast({ title: 'Comment Pulsed!', description: 'Your thoughts are now part of the vibe.', className:"bg-accent text-accent-foreground" });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not post comment.' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    const postUrl = `${currentOrigin}/posts/${post.id}`;
    const shareData = {
      title: 'Check out this pulse!',
      text: post.content,
      url: postUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // This error is often triggered by the user canceling the share dialog, so it's best to ignore it.
        console.log('Share canceled or failed:', error);
      }
    } else {
      // Fallback for desktop or browsers that don't support the Web Share API
      try {
        await navigator.clipboard.writeText(postUrl);
        toast({ title: 'Link Copied!', description: 'The link to this pulse has been copied to your clipboard.' });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Copy Failed',
          description: 'Could not copy the link to your clipboard.',
        });
      }
    }
  };


  return (
    <Card ref={cardRef} className="overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 ease-out border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm hover:border-primary/50 transform hover:scale-[1.005]">
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-start space-x-4 bg-gradient-to-br from-card to-muted/10">
        <Avatar className="h-12 w-12 border-2 border-primary/60 shadow-md">
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
            {authorRole === 'Business' && <Building className="h-6 w-6 text-primary/80" />}
            {authorRole === 'Gorakshak' && <ShieldCheck className="h-6 w-6 text-primary/80" />}
            {!authorRole && <UserCircle className="h-7 w-7 text-primary/80" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            {post.authorid ? (
              <Link href={`/users/${post.authorid}`} className="text-sm text-primary font-semibold flex items-center hover:underline">
                {authorName}
              </Link>
            ) : (
              <p className="text-sm text-primary font-semibold flex items-center">
                {authorName}
              </p>
            )}
            <CardDescription className="text-xs text-muted-foreground font-medium">
              {timeAgo}
            </CardDescription>
          </div>

            {post.city && post.city !== "Unknown City" && (
                 <p className="text-sm text-muted-foreground flex items-center mt-0.5">
                    <MapPin className="w-4 h-4 mr-1.5 text-primary/70 flex-shrink-0" /> {post.city}
                </p>
            )}
        </div>
      </CardHeader>

      {/* Media content remains the same */}
      {post.mediaurl && post.mediatype && (
        <div className="px-5 pb-0 pt-2">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border-2 border-border/50 shadow-inner bg-muted/50 group">
            {post.mediatype === 'image' && (
              <Image src={post.mediaurl} alt="Post image" fill style={{ objectFit: "contain" }} sizes="(max-width: 768px) 100vw, 50vw" className="transition-transform duration-300 group-hover:scale-105" data-ai-hint="user generated content" />
            )}
            {post.mediatype === 'video' && (
              <video controls src={post.mediaurl} className="w-full h-full object-contain" />
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

      {post.hashtags && post.hashtags.length > 0 && ( /* Hashtags display remains the same */
        <div className="px-5 pt-1 pb-2 flex flex-wrap gap-2 items-center">
          {post.hashtags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs bg-primary/10 text-primary hover:bg-primary/20 cursor-default">
              <Tag className="w-3 h-3 mr-1 opacity-70" />
              {tag.replace('#','')}
            </Badge>
          ))}
        </div>
      )}

      <CardFooter className="text-xs text-muted-foreground flex flex-wrap items-center justify-between pt-2 pb-3 px-5 border-t border-border/40 mt-1 gap-y-2 bg-card/50">
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${post.latitude},${post.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 flex-wrap cursor-pointer hover:text-primary transition-colors group" title="Click to get directions">
          <Map className="w-4 h-4 text-primary/70 flex-shrink-0 transition-colors group-hover:text-primary" />
           <span className="font-medium text-muted-foreground transition-colors group-hover:text-primary group-hover:underline">
            Location: {post.latitude.toFixed(3)}, {post.longitude.toFixed(3)}
          </span>
          {distance !== null && (
            <span className="ml-1 text-accent font-semibold transition-colors group-hover:underline">
              (approx. {distance < 0.1 ? '<100m' : `${distance.toFixed(1)} km`} away)
            </span>
          )}
        </a>
      </CardFooter>

      {sessionUser && sessionUser.id === post.authorid && (
        <div className="px-5 py-3 border-t border-border/30 bg-primary/5">
          <p className="text-xs font-semibold text-primary/90 mb-2 uppercase tracking-wider">Your Post Stats</p>
          <div className="flex items-center justify-around text-sm text-primary/80">
            <div className="flex items-center gap-2" title={`${post.viewcount.toLocaleString()} views`}>
              <Eye className="w-4 h-4 text-accent" />
              <span>{post.viewcount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2" title={`${post.notifiedcount.toLocaleString()} users notified`}>
              <BellRing className="w-4 h-4 text-accent" />
              <span>{post.notifiedcount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-4 pt-2 flex items-center space-x-2 border-t border-border/30 bg-card/20 flex-wrap gap-y-2">
        <Button variant="ghost" size="sm" onClick={handleLikeClick} disabled={isLiking || !sessionUser} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group disabled:opacity-50 disabled:cursor-not-allowed">
          <ThumbsUp className={cn('w-5 h-5 transition-all duration-200 group-hover:scale-110 group-hover:text-blue-500', isLiked ? 'text-blue-500 fill-blue-500' : 'text-muted-foreground')} />
          <span className="font-medium text-sm">{displayLikeCount} {displayLikeCount === 1 ? 'Like' : 'Likes'}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setShowComments(!showComments); if(!showComments) fetchPostComments(); }} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group">
          <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">{comments.length > 0 ? `${comments.length} ` : ''}{showComments ? 'Hide' : (comments.length > 0 ? 'Comments' : 'Comment')}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShare} className="flex items-center space-x-1.5 text-muted-foreground hover:text-blue-500 transition-colors duration-150 group">
          <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">Share</span>
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
                  {sessionUser?.name.charAt(0).toUpperCase() || 'P'}
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

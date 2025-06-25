'use client';
import type { FC, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Post, Comment as CommentType } from '@/lib/db-types';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, UserCircle, Heart, MessageCircle, Send, Map, CornerDownRight, Instagram, Share2, Rss, ThumbsUp, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { likePost, addComment, getComments } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';


// Inline SVG for WhatsApp icon
const WhatsAppIcon: FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    <path d="m10.4 8.3-2.2 4.7a.8.8 0 0 0 .2 1l2.4 1.5a.8.8 0 0 0 1-.2l1-1.7a.8.8 0 0 0-.3-1l-2.3-2.1a.8.8 0 0 0-1 .2Z"></path>
  </svg>
);


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
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export const PostCard: FC<PostCardProps> = ({ post, userLocation, calculateDistance }) => {
  const { toast } = useToast();
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdat), { addSuffix: true });
  const distance = userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude) : null;

  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likecount);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

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
    if (isLiking) return; 

    setIsLiking(true);
    const previousLikeCount = displayLikeCount;
    setDisplayLikeCount(prevCount => prevCount + 1);

    try {
      const result = await likePost(post.id);
      if (result.error || !result.post) {
        setDisplayLikeCount(previousLikeCount);
        toast({ variant: 'destructive', title: 'Like Error', description: result.error || 'Could not like the post.' });
      } else {
        setDisplayLikeCount(result.post.likecount);
         toast({
          title: 'Liked!',
          description: 'Pulse liked successfully.',
          variant: 'default',
          duration: 2000,
        });
      }
    } catch (error: any) {
      setDisplayLikeCount(previousLikeCount);
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
      const added = await addComment({ postId: post.id, content: newComment.trim(), author: 'PulseFan' });
      setComments(prev => [added, ...prev]);
      setNewComment('');
      toast({ title: 'Comment Pulsed!', description: 'Your thoughts are now part of the vibe.', className:"bg-accent text-accent-foreground" });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not post comment.' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShareWhatsApp = () => {
    const shareText = `Check out this pulse: ${post.content}\n\nSee more at ${currentOrigin}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareInstagram = async () => {
    try {
      await navigator.clipboard.writeText(post.content);
      let toastMessage = "Post content copied to clipboard! Open Instagram and paste it in your story or post.";
      if (post.mediaurl) {
        toastMessage = "Post content copied! Remember to save the image/video first, then paste the content on Instagram.";
      }
      toast({
        title: 'Ready for Instagram!',
        description: toastMessage,
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not copy content. Please try again.',
      });
    }
  };


  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 ease-out border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm hover:border-primary/50 transform hover:scale-[1.005]">
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-start space-x-4 bg-gradient-to-br from-card to-muted/10">
        <Avatar className="h-12 w-12 border-2 border-primary/60 shadow-md">
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
            <UserCircle className="h-7 w-7 text-primary/80" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-primary font-semibold flex items-center">
              <Rss className="w-4 h-4 mr-1.5 text-accent flex-shrink-0 opacity-80" />
              Anonymous Pulsar
            </p>
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

      {post.mediaurl && post.mediatype && (
        <div className="px-5 pb-0 pt-2">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border-2 border-border/50 shadow-inner bg-muted/50 group">
            {post.mediatype === 'image' && post.mediaurl.startsWith('data:image') && (
              <Image
                src={post.mediaurl as string}
                alt="Post image"
                fill
                style={{ objectFit: "contain" }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="transition-transform duration-300 group-hover:scale-105"
                data-ai-hint="user generated content"
              />
            )}
            {post.mediatype === 'video' && post.mediaurl.startsWith('data:video') && (
              <video controls src={post.mediaurl as string} className="w-full h-full object-contain" />
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

      {post.hashtags && post.hashtags.length > 0 && (
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
        <a
  href={`https://www.google.com/maps/dir/?api=1&destination=${post.latitude},${post.longitude}`}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-1.5 flex-wrap cursor-pointer hover:text-primary transition-colors group"
  title="Click to get directions"
>
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

      <div className="px-5 pb-4 pt-2 flex items-center space-x-2 border-t border-border/30 bg-card/20 flex-wrap gap-y-2">
        <Button variant="ghost" size="sm" onClick={handleLikeClick} disabled={isLiking} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group disabled:opacity-50 disabled:cursor-not-allowed">
          <ThumbsUp className={`w-5 h-5 transition-all duration-200 group-hover:scale-110 group-hover:text-blue-500 ${isLiking ? 'text-blue-500 animate-pulse' : 'text-muted-foreground'}`} />
          <span className="font-medium text-sm">{displayLikeCount} {displayLikeCount === 1 ? 'Like' : 'Likes'}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setShowComments(!showComments); if(!showComments) fetchPostComments(); }} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group">
          <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">{comments.length > 0 ? `${comments.length} ` : ''}{showComments ? 'Hide' : (comments.length > 0 ? 'Comments' : 'Comment')}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShareWhatsApp} className="flex items-center space-x-1.5 text-muted-foreground hover:text-green-500 transition-colors duration-150 group">
          <WhatsAppIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">WhatsApp</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShareInstagram} className="flex items-center space-x-1.5 text-muted-foreground hover:text-pink-500 transition-colors duration-150 group">
          <Instagram className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">Instagram</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={async () => {
             if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Check out this LocalPulse!',
                        text: post.content,
                        url: currentOrigin,
                    });
                    toast({ title: 'Shared!', description: 'Pulse shared successfully.' });
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Share Error', description: 'Could not share this pulse.' });
                    console.error('Error sharing:', error);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(`${post.content}\n\nSee more at ${currentOrigin}`);
                    toast({ title: 'Link Copied!', description: 'Pulse content and link copied to clipboard.' });
                } catch (err) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not copy content.' });
                }
            }
        }} className="flex items-center space-x-1.5 text-muted-foreground hover:text-blue-500 transition-colors duration-150 group">
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

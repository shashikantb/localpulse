
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Post, Comment as CommentType } from '@/lib/db-types';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, UserCircle, Heart, MessageCircle, Send, Share2, Rss, ThumbsUp, Tag, CornerDownRight, PlayCircle, Image as ImageIcon Lucide, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { likePost, addComment, getComments } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Inline SVG for WhatsApp icon (reused from PostCard)
const WhatsAppIcon: FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
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


interface ReelItemProps {
  post: Post;
  isActive: boolean; // To control video play/pause based on visibility
}

export const ReelItem: FC<ReelItemProps> = ({ post, isActive }) => {
  const { toast } = useToast();
  const timeAgo = formatDistanceToNowStrict(new Date(post.createdat), { addSuffix: true });
  
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likecount);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive && post.mediatype === 'video') {
        videoRef.current.play().catch(error => console.warn("Video autoplay prevented:", error));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive, post.mediatype]);


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
        toast({ title: 'Liked!', description: 'Pulse liked successfully.', variant: 'default', duration: 2000 });
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
      const added = await addComment({ postId: post.id, content: newComment.trim(), author: 'ReelViewer' });
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
    const shareText = `Check out this pulse: ${post.content}\n\nSee more at ${currentOrigin}/reels (Post ID: ${post.id})`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareInstagram = async () => {
    // Similar to PostCard, adapted for reels
    try {
      await navigator.clipboard.writeText(post.content);
      let toastMessage = "Post content copied! Open Instagram and paste it.";
      if (post.mediaurl) {
        toastMessage = "Post content copied! Remember to save the media first, then paste the content on Instagram.";
      }
      toast({ title: 'Ready for Instagram!', description: toastMessage });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not copy content.' });
    }
  };


  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black relative text-white">
      {/* Media Display Area */}
      <div className="w-full flex-grow flex items-center justify-center overflow-hidden relative">
        {post.mediatype === 'image' && post.mediaurl && (
          <Image
            src={post.mediaurl}
            alt="Reel image"
            fill
            style={{ objectFit: "contain" }}
            sizes="100vw"
            priority
            data-ai-hint="user generated content"
          />
        )}
        {post.mediatype === 'video' && post.mediaurl && (
          <video
            ref={videoRef}
            src={post.mediaurl}
            loop
            muted // Autoplay best practice
            playsInline // Important for mobile
            className="w-full h-full object-contain"
            onClick={() => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()}
          />
        )}
      </div>

      {/* Overlay for Info and Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
        {/* User Info & Caption */}
        <div className="mb-3">
          <div className="flex items-center space-x-2 mb-1">
            <Avatar className="h-8 w-8 border-2 border-white/50">
              <AvatarFallback className="bg-gray-700 text-xs">
                <UserCircle className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">Anonymous Pulsar</p>
              <p className="text-xs text-gray-300">{timeAgo} {post.city && post.city !== "Unknown City" ? `· ${post.city}`: ''}</p>
            </div>
          </div>
          <p className="text-sm leading-tight line-clamp-3 whitespace-pre-wrap break-words">{post.content}</p>
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {post.hashtags.slice(0,3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-sm">
                   {tag.replace('#','')}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons & Comment Toggle */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={handleLikeClick} disabled={isLiking} className="flex items-center space-x-1.5 text-white hover:text-pink-400 p-1">
              <ThumbsUp className={cn("w-5 h-5", isLiking ? "text-pink-500 animate-pulse" : "")} />
              <span className="font-medium text-xs">{displayLikeCount}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowComments(!showComments); if(!showComments) fetchPostComments(); }} className="flex items-center space-x-1.5 text-white hover:text-cyan-400 p-1">
              <MessageCircle className="w-5 h-5" />
              <span className="font-medium text-xs">{comments.length > 0 ? `${comments.length}` : ''}</span>
            </Button>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" onClick={handleShareWhatsApp} className="text-white hover:text-green-400 p-1 h-7 w-7">
              <WhatsAppIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShareInstagram} className="text-white hover:text-purple-400 p-1 h-7 w-7">
              <Instagram className="w-4 h-4" />
            </Button>
             <Button variant="ghost" size="icon" onClick={async () => {
                 if (navigator.share) {
                    try {
                        await navigator.share({ title: 'Check out this LocalPulse Reel!', text: post.content, url: currentOrigin });
                    } catch (error) { console.error('Error sharing:', error); }
                } else {
                    try { await navigator.clipboard.writeText(`${post.content}\n\nSee more at ${currentOrigin}`); toast({title: "Copied!"}); } catch (err) { toast({variant: "destructive", title: "Copy failed"}); }
                }
            }} className="text-white hover:text-blue-400 p-1 h-7 w-7">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Comments Section (Collapsible) */}
        {showComments && (
          <div className="mt-2 p-3 bg-black/50 rounded-lg max-h-48 overflow-y-auto backdrop-blur-sm">
            <h4 className="text-sm font-semibold mb-2 text-gray-200 flex items-center">
              <CornerDownRight className="w-3 h-3 mr-1.5 text-gray-400"/>
              Thoughts
            </h4>
            <form onSubmit={handleCommentSubmit} className="space-y-2 mb-3">
              <div className="flex items-start space-x-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={1}
                  className="text-xs flex-grow min-h-[30px] bg-gray-800/70 border-gray-700 text-white placeholder-gray-400 rounded-md focus:ring-1 focus:ring-primary"
                  disabled={isSubmittingComment}
                />
                <Button type="submit" size="icon" variant="ghost" disabled={isSubmittingComment || !newComment.trim()} className="h-8 w-8 self-end text-primary hover:bg-primary/20">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
            {isLoadingComments && <p className="text-xs text-center text-gray-400 py-2">Loading comments...</p>}
            {!isLoadingComments && comments.length === 0 && <p className="text-xs text-center text-gray-400 py-2 italic">No comments yet.</p>}
            {!isLoadingComments && comments.length > 0 && (
              <div className="space-y-1.5">
                {comments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

    
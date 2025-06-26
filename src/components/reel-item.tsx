
'use client';
import React, { type FC, FormEvent } from 'react'; // Import React
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Post, Comment as CommentType } from '@/lib/db-types';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, UserCircle, MessageCircle, Send, Share2, Rss, ThumbsUp, Tag, CornerDownRight, PlayCircle, Instagram, Image as ImageIconLucide, VolumeX, Volume2 } from 'lucide-react';
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
    <div className="flex space-x-2 py-2 pl-1 border-l-2 border-primary/20 hover:border-primary/50 transition-colors duration-200 bg-transparent hover:bg-white/5 rounded-r-md">
      <Avatar className="h-7 w-7 border border-white/30 flex-shrink-0 mt-0.5 shadow-sm">
        <AvatarFallback className="bg-gray-700 text-xs font-semibold text-white/80">
          {comment.author.substring(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-xs font-semibold text-white/90">{comment.author}</h4>
          <p className="text-[10px] text-gray-400">
            {formatDistanceToNowStrict(new Date(comment.createdat), { addSuffix: true })}
          </p>
        </div>
        <p className="text-xs text-white/80 whitespace-pre-wrap break-words">{comment.content}</p>
      </div>
    </div>
  );
};


interface ReelItemProps {
  post: Post;
  isActive: boolean;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInternallyMuted, setIsInternallyMuted] = useState(true); // Default to muted for better autoplay


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setDisplayLikeCount(post.likecount);
    setComments([]);
    setShowComments(false);
    setIsInternallyMuted(true);
  }, [post.id, post.likecount]);


  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || post.mediatype !== 'video') {
      return; // Not a video, do nothing.
    }

    if (isActive) {
      // This reel is active, so we try to play it.
      videoElement.muted = isInternallyMuted;
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Autoplay was likely prevented by the browser.
          // This is a common policy, especially for unmuted videos.
          // We'll ensure it's muted and try playing again.
          console.warn("Unmuted autoplay failed. Muting and retrying.", error);
          if (videoElement) { // Check if element still exists
            setIsInternallyMuted(true);
            videoElement.muted = true;
            videoElement.play().catch(finalError => {
               console.error("Muted autoplay also failed.", finalError);
            })
          }
        });
      }
    } else {
      // This reel is not active, so we pause it and reset to the beginning.
      // This is important for when the user swipes away.
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }, [isActive, post.id, post.mediatype, isInternallyMuted]);


  const fetchPostComments = useCallback(async () => {
    if (!showComments || comments.length > 0) return; // Don't refetch if already fetched
    setIsLoadingComments(true);
    try {
      const fetchedComments = await getComments(post.id);
      setComments(fetchedComments);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch comments.' });
    } finally {
      setIsLoadingComments(false);
    }
  }, [post.id, showComments, toast, comments.length]);

  useEffect(() => {
    if(showComments && comments.length === 0 && !isLoadingComments) { // Only fetch if not already loading and no comments
        fetchPostComments();
    }
  }, [fetchPostComments, showComments, comments.length, isLoadingComments]);

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

  const handleVideoTap = () => {
    if (videoRef.current) {
      const currentVideo = videoRef.current;
      if (currentVideo.paused) {
        currentVideo.play().catch(error => {
          console.warn("Play on tap failed. Autoplay might be strictly blocked.", error);
        });
      } else {
        const newMutedState = !currentVideo.muted;
        currentVideo.muted = newMutedState;
        setIsInternallyMuted(newMutedState);
      }
    }
  };


  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-black relative text-white">
      <div className="w-full flex-grow flex items-center justify-center overflow-hidden relative" onClick={handleVideoTap}>
        {post.mediatype === 'image' && post.mediaurl && (
          <Image
            src={post.mediaurl}
            alt="Reel image"
            fill
            style={{ objectFit: "contain" }}
            sizes="100vw"
            priority={isActive}
            data-ai-hint="user generated content"
          />
        )}
        {post.mediatype === 'video' && post.mediaurl && (
          <>
            <video
              ref={videoRef}
              src={post.mediaurl}
              loop
              playsInline // Important for iOS
              preload="auto"
              className="w-full h-full object-contain"
            />
            <div 
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full cursor-pointer z-10"
              onClick={(e) => { e.stopPropagation(); handleVideoTap(); }}
            >
              {isInternallyMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </div>
             {post.mediatype === 'video' && videoRef.current?.paused && isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <PlayCircle className="w-16 h-16 text-white/50 backdrop-blur-sm rounded-full" />
                </div>
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-16 left-0 right-0 p-4 pb-2 bg-gradient-to-t from-black/60 via-black/30 to-transparent flex justify-between items-end">
        <div className="flex-1 space-y-1.5 max-w-[calc(100%-5rem)]">
          <div className="flex items-center space-x-2">
            <Avatar className="h-9 w-9 border-2 border-white/60">
              <AvatarFallback className="bg-gray-700 text-sm">
                <UserCircle className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{post.authorname || 'Anonymous Pulsar'}</p>
              <p className="text-xs text-gray-300">{timeAgo} {post.city && post.city !== "Unknown City" ? `· ${post.city}`: ''}</p>
            </div>
          </div>
          <p className="text-sm leading-tight line-clamp-2 whitespace-pre-wrap break-words">{post.content}</p>
          {post.hashtags && post.hashtags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 max-h-10 overflow-y-hidden">
              {post.hashtags.slice(0,3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/80 hover:bg-white/20 border-none backdrop-blur-sm">
                   {tag.replace('#','')}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-3 items-center z-10">
            <Button variant="ghost" size="sm" onClick={handleLikeClick} disabled={isLiking} className="flex flex-col items-center text-white hover:text-pink-400 p-1 h-auto">
              <ThumbsUp className={cn("w-6 h-6", isLiking ? "text-pink-500 fill-pink-500" : "")} />
              <span className="font-medium text-xs mt-0.5">{displayLikeCount}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowComments(prev => !prev); }} className="flex flex-col items-center text-white hover:text-cyan-400 p-1 h-auto">
              <MessageCircle className="w-6 h-6" />
              <span className="font-medium text-xs mt-0.5">{comments.length > 0 ? `${comments.length}` : '0'}</span>
            </Button>
             <Button variant="ghost" size="sm" onClick={async () => {
                 if (navigator.share) {
                    try {
                        await navigator.share({ title: 'Check out this LocalPulse Reel!', text: post.content, url: currentOrigin });
                    } catch (error) { console.error('Error sharing:', error); }
                } else {
                    try { await navigator.clipboard.writeText(`${post.content}\n\nSee more at ${currentOrigin}`); toast({title: "Copied to clipboard!"}); } catch (err) { toast({variant: "destructive", title: "Copy failed"}); }
                }
            }} className="flex flex-col items-center text-white hover:text-blue-400 p-1 h-auto">
              <Share2 className="w-6 h-6" />
               <span className="font-medium text-xs mt-0.5">Share</span>
            </Button>
        </div>
      </div>

      {showComments && (
        <div className="absolute bottom-16 left-0 right-0 p-3 bg-black/80 backdrop-blur-md rounded-t-lg max-h-[40%] overflow-y-auto z-20">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-gray-200">Comments ({comments.length})</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowComments(false)} className="text-gray-400 hover:text-white p-1">&times;</Button>
          </div>
          <form onSubmit={handleCommentSubmit} className="space-y-2 mb-3">
            <div className="flex items-center space-x-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={1}
                className="text-xs flex-grow min-h-[30px] bg-gray-800/70 border-gray-700 text-white placeholder-gray-400 rounded-md focus:ring-1 focus:ring-primary"
                disabled={isSubmittingComment}
              />
              <Button type="submit" size="icon" variant="ghost" disabled={isSubmittingComment || !newComment.trim()} className="h-8 w-8 self-center text-primary hover:bg-primary/20">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
          {isLoadingComments && <p className="text-xs text-center text-gray-400 py-2">Loading comments...</p>}
          {!isLoadingComments && comments.length === 0 && <p className="text-xs text-center text-gray-400 py-2 italic">No comments yet. Be the first!</p>}
          {!isLoadingComments && comments.length > 0 && (
            <div className="space-y-1.5">
              {comments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

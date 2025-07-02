
'use client';
import type { FC } from 'react';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Post, User } from '@/lib/db-types';
import { formatDistanceToNowStrict } from 'date-fns';
import { MapPin, UserCircle, MessageCircle, Map, Share2, ThumbsUp, Tag, Eye, BellRing, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleLikePost, recordPostView, likePostAnonymously } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const CommentSectionSkeleton = () => (
  <div className="px-5 pb-4 border-t border-border/30 pt-4 bg-muted/20 space-y-4">
    <Skeleton className="h-6 w-1/3" />
    <div className="flex items-start space-x-3">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <Skeleton className="h-20 w-full" />
    </div>
    <div className="space-y-3 pt-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  </div>
);

const CommentSection = dynamic(() => import('./comment-section'), {
  loading: () => <CommentSectionSkeleton />,
  ssr: false,
});


const getAnonymousLikedPosts = (): number[] => {
    if (typeof window === "undefined") return [];
    try {
        const item = window.localStorage.getItem('localpulse-anonymous-likes');
        return item ? JSON.parse(item) : [];
    } catch (error) {
        console.warn("Error reading anonymous likes from localStorage", error);
        return [];
    }
};

interface PostCardProps {
  post: Post;
  userLocation: { latitude: number; longitude: number } | null;
  sessionUser: User | null;
  isFirst?: boolean;
}

export const PostCard: FC<PostCardProps> = ({ post, userLocation, sessionUser, isFirst = false }) => {
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

  const [isLikedByClient, setIsLikedByClient] = useState(false);
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(post.likecount);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [displayCommentCount, setDisplayCommentCount] = useState<number>(post.commentcount);
  const [showComments, setShowComments] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState<'loading' | 'valid' | 'error'>('loading');

  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [wasViewed, setWasViewed] = useState(false);

  useEffect(() => {
    // Check YouTube video validity
    if (post.mediatype === 'video' && post.mediaurl?.includes('youtube.com/embed')) {
      setYoutubeStatus('loading');
      const videoId = post.mediaurl.split('/').pop()?.split('?')[0];
      if (!videoId) {
        setYoutubeStatus('error');
        return;
      }
      // Use oEmbed endpoint to check for validity without an API key
      fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}&format=json`)
        .then(response => {
          if (response.ok) {
            setYoutubeStatus('valid');
          } else {
            setYoutubeStatus('error');
          }
        })
        .catch(() => {
          setYoutubeStatus('error');
        });
    }
    // Reset native media error on post change
    setMediaError(false);
  }, [post.mediaurl, post.mediatype]);
  
  const handleRetryVideo = () => {
    if (videoRef.current) {
        setMediaError(false);
        videoRef.current.load();
        videoRef.current.play().catch(e => console.error("Video retry failed:", e));
    }
  };

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
    setDisplayLikeCount(post.likecount);
    setDisplayCommentCount(post.commentcount);
    if (sessionUser) {
        setIsLikedByClient(post.isLikedByCurrentUser || false);
    } else {
        setIsLikedByClient(getAnonymousLikedPosts().includes(post.id));
    }
  }, [post.isLikedByCurrentUser, post.likecount, post.commentcount, post.id, sessionUser]);


  const handleLikeClick = async () => {
    if (isLiking) return;
    setIsLiking(true);

    try {
        if (sessionUser) {
            // --- LOGGED-IN USER ---
            const result = await toggleLikePost(post.id);
            if (result.error || !result.post) {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'Could not update like.' });
            } else {
                // Update UI from server's response
                setDisplayLikeCount(result.post.likecount);
                setIsLikedByClient(result.post.isLikedByCurrentUser || false);
            }
        } else {
            // --- ANONYMOUS USER ---
            if (getAnonymousLikedPosts().includes(post.id)) {
                toast({ title: "You've already liked this post." });
                return;
            }
            const result = await likePostAnonymously(post.id);
            if (result.error || !result.post) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not like post.' });
            } else {
                // Success, save to localStorage and update UI from server's response
                const currentLikes = getAnonymousLikedPosts();
                window.localStorage.setItem('localpulse-anonymous-likes', JSON.stringify([...currentLikes, post.id]));
                setDisplayLikeCount(result.post.likecount);
                setIsLikedByClient(true);
            }
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected server error occurred.' });
    } finally {
        setIsLiking(false);
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

  const renderContentWithMentions = () => {
    if (!post.content) return null;

    if (!post.mentions || post.mentions.length === 0) {
      return <p className="text-foreground/90 leading-relaxed text-base whitespace-pre-wrap break-words">{post.content}</p>;
    }

    // Escape mentions for regex and create a pattern that includes the '@'
    const escapedMentionNames = post.mentions.map(m =>
      m.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    );
    const regex = new RegExp(`(@(?:${escapedMentionNames.join('|')}))\\b`, 'g');
    const parts = post.content.split(regex);

    return (
      <p className="text-foreground/90 leading-relaxed text-base whitespace-pre-wrap break-words">
        {parts.map((part, index) => {
          // Find the mention by checking if the part matches "@username"
          const mention = post.mentions?.find(m => `@${m.name}` === part);
          if (mention) {
            return (
              <Link
                key={`${mention.id}-${index}`}
                href={`/users/${mention.id}`}
                className="text-accent font-semibold hover:underline"
                onClick={(e) => e.stopPropagation()} // Prevent card click-through
              >
                {part} 
              </Link>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </p>
    );
  };


  return (
    <Card ref={cardRef} className="overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 ease-out border border-border/60 rounded-xl bg-card/80 backdrop-blur-sm hover:border-primary/50 transform hover:scale-[1.005]">
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-start space-x-4 bg-gradient-to-br from-card to-muted/10">
        <Avatar className="h-12 w-12 border-2 border-primary/60 shadow-md">
          <AvatarImage src={post.authorprofilepictureurl ?? undefined} alt={authorName} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-bold text-xl">
            {authorName ? authorName.charAt(0).toUpperCase() : <UserCircle className="h-7 w-7 text-primary/80" />}
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

      {post.mediaurl && post.mediatype && (
        <div className="px-5 pb-0 pt-2">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg border-2 border-border/50 shadow-inner bg-muted/50 group">
            {post.mediatype === 'image' && (
              <Image src={post.mediaurl} alt="Post image" fill style={{ objectFit: "contain" }} sizes="(max-width: 768px) 100vw, 50vw" className="transition-transform duration-300 group-hover:scale-105" data-ai-hint="user generated content" priority={isFirst} />
            )}
            {post.mediatype === 'video' && post.mediaurl.includes('youtube.com/embed') && (
              <>
                {youtubeStatus === 'loading' && <Skeleton className="h-full w-full" />}
                {youtubeStatus === 'error' && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
                    <AlertTriangle className="w-8 h-8 mb-2 text-yellow-400" />
                    <p className="text-sm text-center font-semibold">This YouTube video is unavailable.</p>
                  </div>
                )}
                {youtubeStatus === 'valid' && (
                   <iframe
                    src={post.mediaurl}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  />
                )}
              </>
            )}
            {post.mediatype === 'video' && !post.mediaurl.includes('youtube.com/embed') && (
              <>
                 <video ref={videoRef} controls src={post.mediaurl} className={cn("w-full h-full object-contain", mediaError && "hidden")} onError={() => setMediaError(true)} />
                 {mediaError && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white p-4">
                        <AlertTriangle className="w-8 h-8 mb-2 text-yellow-400" />
                        <p className="text-sm text-center font-semibold mb-3">This video could not be loaded.</p>
                        <Button onClick={handleRetryVideo} variant="secondary" size="sm">
                            <RefreshCw className="w-4 h-4 mr-2"/>
                            Retry
                        </Button>
                    </div>
                )}
              </>
            )}
            
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-md backdrop-blur-sm">
                {post.mediatype.charAt(0).toUpperCase() + post.mediatype.slice(1)}
            </div>
          </div>
        </div>
      )}

      <CardContent className={`px-5 ${post.mediaurl ? 'pt-4' : 'pt-2'} pb-3`}>
        {renderContentWithMentions()}
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
        <Button variant="ghost" size="sm" onClick={handleLikeClick} disabled={isLiking || (!sessionUser && isLikedByClient)} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group disabled:opacity-50 disabled:cursor-not-allowed">
          <ThumbsUp className={cn('w-5 h-5 transition-all duration-200 group-hover:scale-110 group-hover:text-blue-500', isLikedByClient ? 'text-blue-500 fill-blue-500' : 'text-muted-foreground')} />
          <span className="font-medium text-sm">{displayLikeCount} {displayLikeCount === 1 ? 'Like' : 'Likes'}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="flex items-center space-x-1.5 text-muted-foreground hover:text-primary transition-colors duration-150 group">
          <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">{displayCommentCount} {showComments ? 'Hide' : (displayCommentCount === 1 ? 'Comment' : 'Comments')}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShare} className="flex items-center space-x-1.5 text-muted-foreground hover:text-blue-500 transition-colors duration-150 group">
          <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium text-sm">Share</span>
        </Button>
      </div>

      {showComments && (
        <CommentSection
          postId={post.id}
          sessionUser={sessionUser}
          onCommentPosted={() => setDisplayCommentCount(prev => prev + 1)}
        />
      )}
    </Card>
  );
};

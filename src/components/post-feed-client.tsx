
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post, User } from '@/lib/db-types';
import { getPosts, getFamilyPosts, registerDeviceToken, updateUserLocation } from '@/app/actions';
import { PostCard } from '@/components/post-card';
import { PostFeedSkeleton } from '@/components/post-feed-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Loader2, Bell, BellOff, BellRing, AlertTriangle, Users, Rss } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSwipeable } from 'react-swipeable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface AndroidInterface {
  getFCMToken?: () => string | null;
}

declare global {
  interface Window {
    Android?: AndroidInterface;
  }
}

const POSTS_PER_PAGE = 5;

type FeedType = 'nearby' | 'family';

type FeedState = {
    posts: Post[];
    page: number;
    hasMore: boolean;
    isLoading: boolean;
};

const initialFeedState: FeedState = {
    posts: [],
    page: 1,
    hasMore: true,
    isLoading: true,
};

function NotificationButtonContent({
  notificationPermissionStatus,
}: {
  notificationPermissionStatus: 'default' | 'loading' | 'granted' | 'denied';
}) {
  switch (notificationPermissionStatus) {
    case 'loading':
      return <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> <span className="hidden sm:inline">Checking...</span></>;
    case 'granted':
      return <><BellRing className="w-5 h-5 mr-2 text-green-500" /> <span className="hidden sm:inline">Subscribed</span></>;
    case 'denied':
      return <><BellOff className="w-5 h-5 mr-2 text-destructive" /> <span className="hidden sm:inline">Setup Failed</span></>;
    case 'default':
    default:
      return <><Bell className="w-5 h-5 mr-2" /> <span className="hidden sm:inline">Notifications</span></>;
  }
}

function NoPostsContent({ feedType }: { feedType: FeedType }) {
  const messages = {
    nearby: {
      title: 'The air is quiet here...',
      description: 'No pulses found nearby. Be the first to post!'
    },
    family: {
      title: 'No Family Pulses Yet',
      description: 'Your family members have not posted anything yet. Share a family post to get started!'
    }
  }
  const currentMessage = messages[feedType];

  return (
    <Card className="text-center py-16 rounded-xl shadow-xl border border-border/40 bg-card/80 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center">
        <Zap className="mx-auto h-20 w-20 text-muted-foreground/30 mb-6" />
        <p className="text-2xl text-muted-foreground font-semibold">{currentMessage.title}</p>
        <p className="text-md text-muted-foreground/80 mt-2">{currentMessage.description}</p>
      </CardContent>
    </Card>
  );
}


// --- Main Component ---

interface PostFeedClientProps {
  sessionUser: User | null;
}

const PostFeedClient: FC<PostFeedClientProps> = ({ sessionUser }) => {
  const { toast } = useToast();
  
  const [feeds, setFeeds] = useState<{ [key in FeedType]: FeedState }>({
    nearby: { ...initialFeedState },
    family: { ...initialFeedState, isLoading: false }, // Family feed doesn't load initially
  });
  const [activeTab, setActiveTab] = useState<FeedType>('nearby');
  
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<'default' | 'loading' | 'granted' | 'denied'>('default');
  const [showTroubleshootingDialog, setShowTroubleshootingDialog] = useState(false);
  
  const fetchPosts = useCallback(async (feed: FeedType, page: number) => {
    setFeeds(prev => ({ ...prev, [feed]: { ...prev[feed], isLoading: true } }));

    try {
        const fetcher = feed === 'nearby'
            ? getPosts({ page, limit: POSTS_PER_PAGE, latitude: location?.latitude, longitude: location?.longitude })
            : getFamilyPosts({ page, limit: POSTS_PER_PAGE });

        const newPosts = await fetcher;
      
        setFeeds(prev => {
            const currentFeed = prev[feed];
            const allPosts = page === 1 ? newPosts : [...currentFeed.posts, ...newPosts.filter(p => !currentFeed.posts.some(ep => ep.id === p.id))];
            
            return {
                ...prev,
                [feed]: {
                    ...currentFeed,
                    posts: allPosts,
                    page: page,
                    hasMore: newPosts.length === POSTS_PER_PAGE,
                    isLoading: false,
                }
            };
        });
    } catch (error) {
        console.error(`Error fetching ${feed} posts:`, error);
        setFeeds(prev => ({ ...prev, [feed]: { ...prev[feed], isLoading: false } }));
    }
  }, [location?.latitude, location?.longitude]);

  // Initial location fetch
  useEffect(() => {
    const locationPromise = new Promise<{ latitude: number; longitude: number } | null>(resolve => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          resolve(null);
        }
    });

    locationPromise.then(loc => {
        setLocation(loc);
        if (sessionUser && loc) {
            updateUserLocation(loc.latitude, loc.longitude).catch(err => console.warn("Silent location update failed:", err));
        }
    });
  }, [sessionUser]);
  
  // Fetch data for the initial tab once location is known
  useEffect(() => {
    if (location !== null || !navigator.geolocation) {
        fetchPosts('nearby', 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const handleTabChange = (value: string) => {
    const newTab = value as FeedType;
    setActiveTab(newTab);
    // Fetch data for the new tab only if it hasn't been loaded before
    if (feeds[newTab].posts.length === 0 && !feeds[newTab].isLoading) {
        fetchPosts(newTab, 1);
    }
  };

  const handleNotificationRegistration = async () => {
    if (notificationPermissionStatus === 'granted') {
      toast({ title: "Notifications Enabled", description: "You are already set up to receive notifications." });
      return;
    }
    if (notificationPermissionStatus === 'denied') {
       setShowTroubleshootingDialog(true);
      return;
    }

    setNotificationPermissionStatus('loading');
    
    const getTokenWithRetries = (retries = 3, delay = 500): Promise<string | null> => {
        return new Promise((resolve) => {
            let attempts = 0;
            const tryGetToken = () => {
                if (window.Android && typeof window.Android.getFCMToken === 'function') {
                    const token = window.Android.getFCMToken();
                    if (token) {
                        resolve(token);
                        return;
                    }
                }
                
                attempts++;
                if (attempts < retries) {
                    setTimeout(tryGetToken, delay);
                } else {
                    resolve(null);
                }
            };
            tryGetToken();
        });
    };

    try {
      if (window.Android && typeof window.Android.getFCMToken === 'function') {
        const token = await getTokenWithRetries();
        if (token) {
          const result = await registerDeviceToken(token, location?.latitude, location?.longitude);
          if (result.success) {
            setNotificationPermissionStatus('granted');
            toast({ title: "Success!", description: "You are now set up for notifications."});
          } else {
             console.error("Could not register for notifications:", result.error);
             setNotificationPermissionStatus('denied');
          }
        } else {
          setShowTroubleshootingDialog(true);
          setNotificationPermissionStatus('denied');
        }
      } else {
        toast({ title: "Web Notifications", description: "Web push notifications are not yet available. Please use our Android app for real-time updates." });
        setNotificationPermissionStatus('denied');
      }
    } catch (error) {
        console.error("Error during notification registration:", error);
        setShowTroubleshootingDialog(true);
        setNotificationPermissionStatus('denied');
    }
  };

  const refreshPosts = useCallback(async () => {
    setIsRefreshing(true);
    await fetchPosts(activeTab, 1);
    setIsRefreshing(false);
    if (window) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, fetchPosts]);
  
  const handleLoadMore = useCallback(async () => {
    const currentFeed = feeds[activeTab];
    if (currentFeed.isLoading || !currentFeed.hasMore) return;
    fetchPosts(activeTab, currentFeed.page + 1);
  }, [feeds, activeTab, fetchPosts]);

  const observer = useRef<IntersectionObserver>();
  const loaderRef = useCallback((node: HTMLDivElement | null) => {
    if (feeds[activeTab].isLoading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && feeds[activeTab].hasMore) {
        handleLoadMore();
      }
    });

    if (node) observer.current.observe(node);
  }, [feeds, activeTab, handleLoadMore]);

  const swipeHandlers = useSwipeable({
    onSwipedDown: () => {
      if (window.scrollY === 0) refreshPosts();
    },
    trackMouse: true,
  });

  const renderFeedContent = (feed: FeedState, type: FeedType) => {
    if ((feed.isLoading && feed.posts.length === 0) || isRefreshing) {
      return <PostFeedSkeleton />;
    }
    
    return (
      <div className="space-y-6">
        {feed.posts.length > 0 ? (
          feed.posts.map((post, index) => (
            <PostCard key={post.id} post={post} userLocation={location} sessionUser={sessionUser} isFirst={index === 0} />
          ))
        ) : (
          <NoPostsContent feedType={type} />
        )}
        <div ref={loaderRef} className="h-1 w-full" />
        {feed.isLoading && feed.posts.length > 0 && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    );
  };


  return (
    <div {...swipeHandlers}>
       <AlertDialog open={showTroubleshootingDialog} onOpenChange={setShowTroubleshootingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
              Enable Background Notifications
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 text-left pt-2 text-foreground/80">
                <p>To receive notifications reliably on your device, please enable these two settings for the LocalPulse app:</p>
                <ol className="list-decimal list-inside space-y-2 font-medium bg-muted p-3 rounded-md border">
                    <li><span className="font-semibold">Enable "Autostart"</span> (or "Auto-launch").</li>
                    <li><span className="font-semibold">Set Battery Saver to "No restrictions"</span>.</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-1">
                    These options are usually found in your phone's Settings app under "Apps" or "Security". Unfortunately, we cannot open this page for you automatically.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>I'll check later</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowTroubleshootingDialog(false); handleNotificationRegistration(); }}>I've checked, Try Again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex justify-between items-center mb-4">
            <TabsList>
                <TabsTrigger value="nearby" className="flex items-center gap-2"><Rss className="w-4 h-4"/> Nearby</TabsTrigger>
                {sessionUser && <TabsTrigger value="family" className="flex items-center gap-2"><Users className="w-4 h-4"/> Family</TabsTrigger>}
            </TabsList>
            <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shadow-md hover:shadow-lg transition-all duration-300 bg-card/80 backdrop-blur-sm border-border hover:border-primary/70 hover:text-primary"
                onClick={handleNotificationRegistration}
                disabled={notificationPermissionStatus === 'loading'}
                aria-label="Toggle Notifications"
            >
                <NotificationButtonContent notificationPermissionStatus={notificationPermissionStatus} />
            </Button>
        </div>

        <TabsContent value="nearby">
           {renderFeedContent(feeds.nearby, 'nearby')}
        </TabsContent>
        {sessionUser && 
            <TabsContent value="family">
            {renderFeedContent(feeds.family, 'family')}
            </TabsContent>
        }
      </Tabs>
    </div>
  );
};

export default PostFeedClient;

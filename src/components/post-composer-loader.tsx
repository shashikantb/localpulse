
'use client';

import type { FC } from 'react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Zap } from 'lucide-react';
import type { User } from '@/lib/db-types';

// The skeleton now represents the trigger button, not the full composer.
export const PostComposerSkeleton = () => (
  <div className="flex items-center space-x-4 p-4 rounded-xl border bg-card shadow-sm h-[80px]">
    <Skeleton className="h-12 w-12 rounded-full" />
    <Skeleton className="h-8 flex-1" />
  </div>
);

const PostComposer = dynamic(() => import('@/components/post-composer'), {
  // Skeleton for the content inside the dialog when it's opening
  loading: () => (
    <div className="p-5 space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  ),
});

interface PostComposerLoaderProps {
    sessionUser: User | null;
}

const PostComposerLoader: FC<PostComposerLoaderProps> = ({ sessionUser }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handlePostSuccess = () => {
        setIsDialogOpen(false);
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-auto justify-start p-4 rounded-xl shadow-lg hover:shadow-primary/20 bg-card/80 backdrop-blur-sm border-border/60 hover:border-primary/50 transition-all duration-300">
                    <div className="flex items-center space-x-4 w-full">
                        <Avatar className="h-12 w-12 border-2 border-primary/40">
                            {sessionUser?.profilepictureurl && (
                                <AvatarImage src={sessionUser.profilepictureurl} alt={sessionUser.name} />
                            )}
                            <AvatarFallback className="text-xl bg-primary/10 text-primary">
                                {sessionUser ? sessionUser.name.charAt(0).toUpperCase() : <Zap className="h-6 w-6" />}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-muted-foreground text-lg">Share your pulse (Post)</span>
                    </div>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-semibold text-primary flex items-center">
                        <Zap className="w-7 h-7 mr-2 text-accent drop-shadow-sm" />
                        Share Your Pulse
                    </DialogTitle>
                </DialogHeader>
                <PostComposer sessionUser={sessionUser} onPostSuccess={handlePostSuccess} />
            </DialogContent>
        </Dialog>
    );
};

export default PostComposerLoader;

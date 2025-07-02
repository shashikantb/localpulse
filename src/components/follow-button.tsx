
'use client';

import type { FC } from 'react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toggleFollow } from '@/app/actions';
import { Loader2, UserPlus, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  targetUserId: number;
  initialIsFollowing: boolean;
}

const FollowButton: FC<FollowButtonProps> = ({ targetUserId, initialIsFollowing }) => {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();

  const handleFollowClick = () => {
    startTransition(async () => {
      const newFollowState = !isFollowing;
      setIsFollowing(newFollowState); // Optimistic update

      const result = await toggleFollow(targetUserId);
      if (!result.success) {
        setIsFollowing(!newFollowState); // Revert on error
        console.error("Failed to update follow status:", result.error);
      }
    });
  };

  return (
    <Button
      onClick={handleFollowClick}
      disabled={isPending}
      size="sm"
      variant={isFollowing ? 'outline' : 'default'}
      className={cn(
        "transition-all duration-200",
        isFollowing ? "text-primary border-primary hover:bg-primary/10" : ""
      )}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="mr-2 h-4 w-4" />
      ) : (
        <UserPlus className="mr-2 h-4 w-4" />
      )}
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
};

export default FollowButton;

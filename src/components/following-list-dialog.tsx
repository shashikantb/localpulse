
'use client';

import type { FC, PropsWithChildren } from 'react';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getFollowingList } from '@/app/actions';
import type { FollowUser } from '@/lib/db-types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';

interface FollowingListDialogProps extends PropsWithChildren {
  userId: number;
}

const FollowingListDialog: FC<FollowingListDialogProps> = ({ children, userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && followingList.length === 0) {
      setIsLoading(true);
      const list = await getFollowingList(userId);
      setFollowingList(list);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Following</DialogTitle>
          <DialogDescription>
            Users this person is following.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72">
          <div className="space-y-4 pr-4">
            {isLoading && (
              <>
                <div className="flex items-center space-x-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-[200px]" /></div>
                <div className="flex items-center space-x-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-[200px]" /></div>
                <div className="flex items-center space-x-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-[200px]" /></div>
              </>
            )}
            {!isLoading && followingList.length > 0 && followingList.map((user) => (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="flex items-center space-x-4 p-2 rounded-lg hover:bg-muted"
                onClick={() => setIsOpen(false)}
              >
                <Avatar>
                  <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{user.name}</span>
              </Link>
            ))}
            {!isLoading && followingList.length === 0 && (
              <p className="text-muted-foreground text-center py-8">Not following anyone yet.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default FollowingListDialog;


'use client';

import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { User, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusUploader from './status-uploader';
import StatusViewer from './status-viewer';
import type { UserWithStatuses, User as SessionUserType } from '@/lib/db-types';
import { getStatusesForFeed } from '@/app/actions';

interface StatusFeedProps {
  sessionUser: SessionUserType | null;
}

const StatusFeed: FC<StatusFeedProps> = ({ sessionUser }) => {
  const [statuses, setStatuses] = useState<UserWithStatuses[]>([]);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  useEffect(() => {
    if (sessionUser) {
      getStatusesForFeed().then(setStatuses);
    }
  }, [sessionUser]);

  const handleOpenViewer = (index: number) => {
    setViewerInitialIndex(index);
    setIsViewerOpen(true);
  };
  
  if (!sessionUser) {
    return null; // Don't show status feed for logged-out users
  }

  const currentUserData = statuses.find(s => s.userId === sessionUser.id);
  const otherUsersStatuses = statuses.filter(s => s.userId !== sessionUser.id);

  return (
    <div className="py-2 border-b">
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex space-x-4 p-2">
                <Dialog open={isUploaderOpen} onOpenChange={setIsUploaderOpen}>
                    <DialogTrigger asChild>
                        <div className="flex flex-col items-center space-y-2 flex-shrink-0 w-20 text-center cursor-pointer">
                            <div className="relative">
                                {currentUserData ? (
                                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-gray-400 via-gray-500 to-gray-600" onClick={(e) => { e.stopPropagation(); handleOpenViewer(statuses.findIndex(s => s.userId === sessionUser.id));}}>
                                        <Avatar className="h-16 w-16 border-2 border-background">
                                            <AvatarImage src={currentUserData.userProfilePictureUrl ?? undefined} />
                                            <AvatarFallback>{currentUserData.userName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                ) : (
                                     <Avatar className="h-16 w-16 border-2 border-dashed border-primary/50">
                                        <AvatarImage src={sessionUser.profilepictureurl ?? undefined} alt="Your Status" />
                                        <AvatarFallback><User className="h-7 w-7" /></AvatarFallback>
                                    </Avatar>
                                )}
                                <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background">
                                    <Plus className="h-4 w-4" />
                                </div>
                            </div>
                            <p className="text-xs font-medium truncate">Your Story</p>
                        </div>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add to your story</DialogTitle>
                        </DialogHeader>
                        <StatusUploader onUploadComplete={() => setIsUploaderOpen(false)} />
                    </DialogContent>
                </Dialog>

                {otherUsersStatuses.map((userWithStatus) => (
                <div key={userWithStatus.userId} onClick={() => handleOpenViewer(statuses.findIndex(s => s.userId === userWithStatus.userId))} className="flex flex-col items-center space-y-2 flex-shrink-0 w-20 text-center cursor-pointer">
                      <div className="p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                          <Avatar className="h-16 w-16 border-2 border-background">
                            <AvatarImage src={userWithStatus.userProfilePictureUrl ?? undefined} />
                            <AvatarFallback>{userWithStatus.userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </div>
                    <p className="text-xs font-medium truncate">{userWithStatus.userName}</p>
                </div>
            ))}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {isViewerOpen && (
              <StatusViewer
                users={statuses}
                initialUserIndex={viewerInitialIndex}
                onClose={() => setIsViewerOpen(false)}
            />
        )}
    </div>
  );
};
export default StatusFeed;

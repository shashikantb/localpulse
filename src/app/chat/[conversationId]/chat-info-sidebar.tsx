
'use client';

import { useState, useEffect, useRef } from 'react';
import type { ConversationDetails, FollowUser } from '@/lib/db-types';
import {
  getConversationDetails,
  getPotentialGroupMembers,
  removeMemberFromGroup,
  addMembersToGroup,
  leaveGroup,
  updateGroupAvatar,
  getSignedUploadUrl,
  makeUserGroupAdmin
} from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  LogOut,
  UserPlus,
  UserX,
  Shield,
  Loader2,
  Camera,
  ShieldPlus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

export const ChatInfoSidebarSkeleton = () => (
  <div className="p-4 space-y-4 h-full flex flex-col">
    <Skeleton className="h-24 w-24 rounded-full mx-auto" />
    <Skeleton className="h-6 w-3/4 mx-auto" />
    <Skeleton className="h-4 w-1/2 mx-auto" />
    <div className="flex-grow space-y-3 pt-4 border-t">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
    <Skeleton className="h-10 w-full" />
  </div>
);

const AddMembersDialog = ({ conversationId, existingMembers, onMembersAdded }: { conversationId: number, existingMembers: number[], onMembersAdded: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [potentialMembers, setPotentialMembers] = useState<FollowUser[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            getPotentialGroupMembers().then((users) => {
                const existingMemberIds = new Set(existingMembers);
                setPotentialMembers(users.filter(u => !existingMemberIds.has(u.id)));
                setIsLoading(false);
            });
        }
    }, [isOpen, existingMembers]);

    const handleSelectMember = (userId: number) => {
        setSelectedMembers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) newSet.delete(userId);
            else newSet.add(userId);
            return newSet;
        });
    };

    const handleAddMembers = async () => {
        if (selectedMembers.size === 0) {
            toast({ variant: 'destructive', title: 'Please select at least one member to add.' });
            return;
        }
        setIsSubmitting(true);
        const result = await addMembersToGroup(conversationId, Array.from(selectedMembers));
        if (result.success) {
            toast({ title: 'Members Added', description: 'The group has been updated.' });
            setIsOpen(false);
            onMembersAdded();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" /> Add Members
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Members</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-60 border rounded-md">
                    {isLoading ? <p>Loading...</p> : potentialMembers.map(user => (
                        <Label key={user.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted">
                            <Checkbox checked={selectedMembers.has(user.id)} onCheckedChange={() => handleSelectMember(user.id)} />
                            <Avatar className="h-8 w-8"><AvatarImage src={user.profilepictureurl || undefined} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                            <span>{user.name}</span>
                        </Label>
                    ))}
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddMembers} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add to Group
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function ChatInfoSidebar({ conversationId }: { conversationId: number }) {
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [sessionUserId, setSessionUserId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDetails = async () => {
    const [session, convDetails] = await Promise.all([
      getSession(),
      getConversationDetails(conversationId)
    ]);
    setSessionUserId(session.user?.id || null);
    setDetails(convDetails);
  };

  useEffect(() => {
    fetchDetails();
  }, [conversationId]);
  
  const handleRemoveMember = async (userId: number) => {
    const result = await removeMemberFromGroup(conversationId, userId);
    if(result.success) {
        toast({ title: "Member Removed" });
        fetchDetails();
    } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  const handleMakeAdmin = async (userId: number) => {
    const result = await makeUserGroupAdmin(conversationId, userId);
    if(result.success) {
        toast({ title: "Admin Added" });
        fetchDetails();
    } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      
      try {
          const signedUrlResult = await getSignedUploadUrl(file.name, file.type);
          if (!signedUrlResult.success || !signedUrlResult.uploadUrl || !signedUrlResult.publicUrl) {
              throw new Error(signedUrlResult.error);
          }
          await fetch(signedUrlResult.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type }});
          const result = await updateGroupAvatar(conversationId, signedUrlResult.publicUrl);
          if (result.success) {
              toast({ title: "Avatar Updated!" });
              fetchDetails();
          } else {
              throw new Error(result.error);
          }
      } catch (error: any) {
          toast({ variant: "destructive", title: "Upload Failed", description: error.message });
      } finally {
          setIsUploading(false);
      }
  };


  if (!details) return <ChatInfoSidebarSkeleton />;

  const isSessionUserAdmin = !!details.participants.find(p => p.id === sessionUserId && p.is_admin);

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="relative mx-auto group">
        <Avatar className="h-24 w-24 border-4 border-primary">
          <AvatarImage src={details.display_avatar_url || undefined} alt={details.display_name} />
          <AvatarFallback className="text-3xl"><Users /></AvatarFallback>
        </Avatar>
        {isSessionUserAdmin && (
          <>
            <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
            <Button
              size="icon"
              variant="outline"
              className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-background/80 group-hover:opacity-100 opacity-0 transition-opacity"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Camera className="h-4 w-4" />}
            </Button>
          </>
        )}
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold">{details.display_name}</h2>
        <p className="text-sm text-muted-foreground">{details.participants.length} members</p>
      </div>

      <div className="flex-grow pt-4 border-t">
        <h3 className="text-sm font-semibold mb-2">Members</h3>
        <ScrollArea className="h-60">
          <div className="space-y-2 pr-2">
            {details.participants.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted group">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8"><AvatarImage src={p.profilepictureurl || undefined} /><AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.is_admin && <p className="text-xs text-primary flex items-center gap-1"><Shield className="h-3 w-3"/> Admin</p>}
                  </div>
                </div>
                {isSessionUserAdmin && p.id !== sessionUserId && (
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!p.is_admin && (
                           <DropdownMenuItem onSelect={() => handleMakeAdmin(p.id)}>
                            <ShieldPlus className="mr-2 h-4 w-4" /> Make Admin
                          </DropdownMenuItem>
                        )}
                         <DropdownMenuItem onSelect={() => handleRemoveMember(p.id)} className="text-destructive">
                           <UserX className="mr-2 h-4 w-4" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      
      {isSessionUserAdmin && (
        <AddMembersDialog 
            conversationId={conversationId} 
            existingMembers={details.participants.map(p => p.id)} 
            onMembersAdded={fetchDetails} 
        />
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
                <LogOut className="mr-2 h-4 w-4" /> Leave Group
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to leave this group?</AlertDialogTitle>
                <AlertDialogDescription>
                    You will be removed from the conversation and will no longer receive messages.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => leaveGroup(conversationId)}>Yes, Leave</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import { getPotentialGroupMembers, createGroup } from '@/app/actions';
import type { FollowUser } from '@/lib/db-types';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateGroupDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [potentialMembers, setPotentialMembers] = useState<FollowUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getPotentialGroupMembers().then((users) => {
        setPotentialMembers(users);
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  const handleSelectMember = (userId: number) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };
  
  const handleCreateGroup = async () => {
      if (!groupName.trim()) {
        toast({ variant: 'destructive', title: 'Group name is required.' });
        return;
      }
      if (selectedMembers.size === 0) {
        toast({ variant: 'destructive', title: 'Please select at least one member.' });
        return;
      }
      
      setIsSubmitting(true);
      const result = await createGroup(groupName, Array.from(selectedMembers));

      if(result.success && result.conversationId) {
          toast({ title: 'Group Created!', description: `The group "${groupName}" has been created.` });
          setIsOpen(false);
          setGroupName('');
          setSelectedMembers(new Set());
          router.push(`/chat/${result.conversationId}`);
      } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to create group.' });
      }
      setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>Name your group and add members from your followers and family.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Add Members</h4>
            <p className="text-xs text-muted-foreground -mt-2">Only your followers and family members will appear in this list.</p>
          </div>
          <ScrollArea className="h-48 border rounded-md">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading potential members...</div>
            ) : potentialMembers.length > 0 ? (
              potentialMembers.map(user => (
                <Label key={user.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted">
                   <Checkbox
                        checked={selectedMembers.has(user.id)}
                        onCheckedChange={() => handleSelectMember(user.id)}
                        disabled={isSubmitting}
                    />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profilepictureurl || undefined} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.name}</span>
                </Label>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">You don't have any followers or family members to add yet.</div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleCreateGroup} disabled={isSubmitting || isLoading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

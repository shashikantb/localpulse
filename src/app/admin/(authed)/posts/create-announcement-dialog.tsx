
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createAnnouncementPost } from './actions';
import { Loader2, Megaphone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CreateAnnouncementDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!content.trim()) {
        toast({
            variant: 'destructive',
            title: 'Content is empty',
            description: 'Please write a message for the announcement.',
        });
        return;
    }
    setIsSubmitting(true);
    const result = await createAnnouncementPost(content);
    if (result.success) {
      toast({
        title: 'Announcement Published!',
        description: 'The announcement will now appear at the top of the feed.',
      });
      setIsOpen(false);
      setContent('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Megaphone className="mr-2 h-6 w-6 text-primary" />
            Create Official Announcement
          </DialogTitle>
          <DialogDescription>
            This post will appear at the top of every user's feed. It will be posted by "LocalPulse Official".
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Textarea
                placeholder="Write your announcement here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                disabled={isSubmitting}
            />
            <Alert>
                <AlertDescription>
                    The hashtags #announcement and #localpulse will be added automatically.
                </AlertDescription>
            </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

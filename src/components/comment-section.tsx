
'use client';

import type { FC, FormEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { CornerDownRight, Send } from 'lucide-react';

import type { Comment as CommentType, User } from '@/lib/db-types';
import { addComment, getComments } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNowStrict } from 'date-fns';
import { Skeleton } from './ui/skeleton';

const CommentCard: FC<{ comment: CommentType }> = ({ comment }) => {
  return (
    <div className="flex space-x-3 py-3 pl-2 border-l-2 border-primary/20 ml-1 hover:border-primary/50 transition-colors duration-200 bg-transparent hover:bg-primary/5 rounded-r-md">
      <Avatar className="h-9 w-9 border-2 border-primary/40 flex-shrink-0 mt-1 shadow-sm">
        <AvatarFallback className="bg-muted text-sm font-semibold text-primary/80">
          {comment.author.substring(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground/90">{comment.author}</h4>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNowStrict(new Date(comment.createdat), { addSuffix: true })}
          </p>
        </div>
        <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{comment.content}</p>
      </div>
    </div>
  );
};


interface CommentSectionProps {
  postId: number;
  sessionUser: User | null;
  onCommentPosted: () => void;
}

const CommentSection: FC<CommentSectionProps> = ({ postId, sessionUser, onCommentPosted }) => {
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchPostComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const fetchedComments = await getComments(postId);
      setComments(fetchedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPostComments();
  }, [fetchPostComments]);

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      return;
    }
    setIsSubmittingComment(true);
    try {
      const author = sessionUser?.name || 'PulseFan';
      const added = await addComment({ postId, content: newComment.trim(), author });
      setComments(prev => [added, ...prev]);
      setNewComment('');
      onCommentPosted(); // Notify parent to update count
      toast({ title: 'Comment Pulsed!', description: 'Your thoughts are now part of the vibe.', className:"bg-accent text-accent-foreground" });
    } catch (error) {
      console.error("Could not post comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="px-5 pb-4 border-t border-border/30 pt-4 bg-muted/20">
      <h4 className="text-base font-semibold mb-3 text-primary flex items-center">
        <CornerDownRight className="w-4 h-4 mr-2 text-accent"/>
        Vibes & Thoughts
      </h4>
      <form onSubmit={handleCommentSubmit} className="space-y-3 mb-4">
        <div className="flex items-start space-x-3">
          <Avatar className="h-10 w-10 border-2 border-accent/50 flex-shrink-0 shadow-sm">
            <AvatarFallback className="bg-muted text-accent font-semibold">
              {sessionUser?.name.charAt(0).toUpperCase() || 'P'}
            </AvatarFallback>
          </Avatar>
          <Textarea
            placeholder="Share your vibe on this pulse..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className="text-sm flex-grow min-h-[40px] shadow-inner focus:ring-2 focus:ring-primary/60 bg-background/70 rounded-lg"
            disabled={isSubmittingComment}
          />
          <Button type="submit" size="icon" variant="ghost" disabled={isSubmittingComment || !newComment.trim()} className="h-10 w-10 self-end shadow-sm hover:bg-primary/10 border border-transparent hover:border-primary/30 group">
            <Send className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
          </Button>
        </div>
      </form>

      {isLoadingComments && (
        <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
      )}
      {!isLoadingComments && comments.length === 0 && <p className="text-sm text-center text-muted-foreground py-4 italic">No thoughts shared yet. Be the first to vibe!</p>}

      {!isLoadingComments && comments.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-2 rounded-md border-t border-border/20 pt-3 mt-3 custom-scrollbar">
          {comments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
        </div>
      )}
    </div>
  );
}

export default CommentSection;

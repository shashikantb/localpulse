
'use client';

import type { FC, FormEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';

import type { Comment as CommentType, User } from '@/lib/db-types';
import { addComment, getComments } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNowStrict } from 'date-fns';
import { Send, X } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

const CommentCard: FC<{ comment: CommentType }> = ({ comment }) => (
    <div className="flex space-x-2 py-2 pl-1">
      <Avatar className="h-7 w-7 border border-white/30 flex-shrink-0 mt-0.5 shadow-sm">
        <AvatarFallback className="bg-gray-700 text-xs font-semibold text-white/80">
          {comment.author.substring(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-xs font-semibold text-white/90">{comment.author}</h4>
          <p className="text-[10px] text-gray-400">
            {formatDistanceToNowStrict(new Date(comment.createdat), { addSuffix: true })}
          </p>
        </div>
        <p className="text-xs text-white/80 whitespace-pre-wrap break-words">{comment.content}</p>
      </div>
    </div>
);

interface ReelCommentsProps {
  postId: number;
  sessionUser: User | null;
  onClose: () => void;
  onCommentPosted: (newComment: CommentType) => void;
  initialCommentCount: number;
}

const ReelComments: FC<ReelCommentsProps> = ({ postId, sessionUser, onClose, onCommentPosted, initialCommentCount }) => {
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
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch comments.' });
        } finally {
          setIsLoadingComments(false);
        }
    }, [postId, toast]);

    useEffect(() => {
        fetchPostComments();
    }, [fetchPostComments]);

    const handleCommentSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setIsSubmittingComment(true);
        try {
          const author = sessionUser?.name || 'ReelViewer';
          const added = await addComment({ postId, content: newComment.trim(), author });
          setComments(prev => [added, ...prev]);
          setNewComment('');
          onCommentPosted(added);
        } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not post comment.' });
        } finally {
          setIsSubmittingComment(false);
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/80 backdrop-blur-md rounded-t-lg max-h-[40%] overflow-y-auto z-20 flex flex-col">
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h4 className="text-sm font-semibold text-gray-200">Comments ({comments.length || initialCommentCount})</h4>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 rounded-full">
                    <X className="w-4 h-4" />
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                {isLoadingComments ? (
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-full bg-gray-700/50" />
                        <Skeleton className="h-10 w-full bg-gray-700/50" />
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-xs text-center text-gray-400 py-4 italic">No comments yet. Be the first!</p>
                ) : (
                    <div className="space-y-1.5">
                    {comments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
                    </div>
                )}
            </div>
            <form onSubmit={handleCommentSubmit} className="space-y-2 mt-3 pt-3 border-t border-white/20 flex-shrink-0">
                <div className="flex items-center space-x-2">
                <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={1}
                    className="text-xs flex-grow min-h-[30px] bg-gray-800/70 border-gray-700 text-white placeholder-gray-400 rounded-md focus:ring-1 focus:ring-primary"
                    disabled={isSubmittingComment}
                />
                <Button type="submit" size="icon" variant="ghost" disabled={isSubmittingComment || !newComment.trim()} className="h-8 w-8 self-center text-primary hover:bg-primary/20">
                    <Send className="w-4 h-4" />
                </Button>
                </div>
            </form>
        </div>
    );
};

export default ReelComments;

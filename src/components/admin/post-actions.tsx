
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { deletePost } from '@/app/admin/(authed)/posts/actions';
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
import { useToast } from '@/hooks/use-toast';
import type { Post } from '@/lib/db-types';
import { useRouter } from 'next/navigation';

interface PostActionsProps {
  post: Post;
}

const PostActions: FC<PostActionsProps> = ({ post }) => {
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deletePost(post.id);
    if (result.success) {
      toast({
        title: 'Post Deleted',
        description: `Post #${post.id} has been successfully deleted.`,
      });
      router.refresh(); // Re-fetches the data on the page
    } else {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Post',
        description: result.error,
      });
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/posts/${post.id}`} target="_blank">View</Link>
      </Button>
      <Button variant="outline" size="sm" className="text-yellow-600 hover:text-yellow-700 border-yellow-500 hover:border-yellow-600" disabled>
        Edit
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete post #{post.id} and all associated data (comments, likes) from the servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Yes, delete post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PostActions;

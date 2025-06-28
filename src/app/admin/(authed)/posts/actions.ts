
'use server';

import { deletePostDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function deletePost(postId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await deletePostDb(postId);
    revalidatePath('/admin/posts');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting post:', error);
    // Provide more specific error details if available from the database driver
    const errorMessage = error.detail || error.message || 'Failed to delete post.';
    return { success: false, error: errorMessage };
  }
}

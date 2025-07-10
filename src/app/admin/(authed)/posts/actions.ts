
'use server';

import { deletePostDb, addPostDb } from '@/lib/db';
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

export async function createAnnouncementPost(content: string): Promise<{ success: boolean; error?: string }> {
    try {
        // ID 1 is reserved for the "LocalPulse Official" user.
        await addPostDb({
            content,
            authorid: 1, // Official User ID
            latitude: 0, // Not relevant for announcements
            longitude: 0, // Not relevant for announcements
            is_family_post: false,
            hide_location: true, // Always hide location for announcements
            hashtags: ['#announcement', '#localpulse'],
        });
        revalidatePath('/admin/posts');
        revalidatePath('/');
        return { success: true };

    } catch(error: any) {
        return { success: false, error: 'Failed to create announcement.' };
    }
}

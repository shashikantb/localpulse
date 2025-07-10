
'use server';

import { deletePostDb, addPostDb, getUserByEmailDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const OFFICIAL_USER_EMAIL = 'official@localpulse.in';

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
        const officialUser = await getUserByEmailDb(OFFICIAL_USER_EMAIL);
        if (!officialUser) {
            // This should ideally never happen if the DB initialization works correctly.
            throw new Error('Official user account not found. Cannot create announcement.');
        }

        await addPostDb({
            content,
            authorid: officialUser.id,
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
        console.error("Error creating announcement:", error);
        return { success: false, error: error.message || 'Failed to create announcement.' };
    }
}

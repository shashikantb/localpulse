
'use server';

import { deleteUserDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function deleteUser(userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteUserDb(userId);
    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting user ${userId}:`, error);
    return { success: false, error: error.message || 'Failed to delete user.' };
  }
}

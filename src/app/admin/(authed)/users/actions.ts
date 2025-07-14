
'use server';

import { deleteUserDb, getPaginatedUsersDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getPaginatedUsers(page: number, limit: number, query?: string) {
    try {
        return await getPaginatedUsersDb({ page, limit, query });
    } catch (error) {
        console.error('Failed to get paginated users:', error);
        return { users: [], totalCount: 0 };
    }
}

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


'use server';

import { getPendingUsersDb, updateUserStatusDb } from '@/lib/db';
import type { User } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';

export async function getPendingUsers(): Promise<User[]> {
  try {
    return await getPendingUsersDb();
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return [];
  }
}

export async function approveUser(userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const updatedUser = await updateUserStatusDb(userId, 'approved');
    if (updatedUser) {
      revalidatePath('/admin/users');
      return { success: true };
    }
    return { success: false, error: 'User not found.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectUser(userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const updatedUser = await updateUserStatusDb(userId, 'rejected');
    if (updatedUser) {
      revalidatePath('/admin/users');
      return { success: true };
    }
    return { success: false, error: 'User not found.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

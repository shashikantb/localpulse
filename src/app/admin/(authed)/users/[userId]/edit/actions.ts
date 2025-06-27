
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateUserDb } from '@/lib/db';
import type { UpdatableUserFields } from '@/lib/db-types';

export async function updateUser(userId: number, userData: UpdatableUserFields): Promise<{ success: boolean; error?: string } | void> {
  try {
    const updatedUser = await updateUserDb(userId, userData);
    if (!updatedUser) {
      return { success: false, error: 'User not found or failed to update.' };
    }
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}/edit`);
    revalidatePath('/admin/approvals');
  } catch (error: any) {
    return { success: false, error: error.message };
  }
  
  // On success, redirect back to the users list
  redirect('/admin/users');
}

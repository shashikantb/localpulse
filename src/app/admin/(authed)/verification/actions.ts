
'use server';

import { getPendingVerificationDb, updateUserStatusDb } from '@/lib/db';
import type { User } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';

export async function getVerificationRequests(): Promise<User[]> {
  try {
    return await getPendingVerificationDb();
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    return [];
  }
}

export async function approveVerification(userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const updatedUser = await updateUserStatusDb(userId, 'verified');
    if (updatedUser) {
      revalidatePath('/admin/verification');
      revalidatePath('/admin/users');
      return { success: true };
    }
    return { success: false, error: 'User not found.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectVerification(userId: number): Promise<{ success: boolean; error?: string }> {
  // If verification is rejected, we revert them to 'approved' status,
  // so they can continue to use the app as a normal business.
  try {
    const updatedUser = await updateUserStatusDb(userId, 'approved');
    if (updatedUser) {
      revalidatePath('/admin/verification');
      revalidatePath('/admin/users');
      return { success: true };
    }
    return { success: false, error: 'User not found.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

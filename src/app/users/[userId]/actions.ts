
'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/auth/actions';
import { updateUserMobileDb } from '@/lib/db';
import { z } from 'zod';

const mobileSchema = z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit mobile number.');

export async function updateUserMobile(formData: FormData) {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'Authentication required.' };
  }

  const mobileNumber = formData.get('mobilenumber') as string;
  const validation = mobileSchema.safeParse(mobileNumber);

  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }
  
  try {
    await updateUserMobileDb(user.id, validation.data);
    revalidatePath(`/users/${user.id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Failed to update mobile number.' };
  }
}


'use server';

import { revalidatePath } from 'next/cache';
import { seedCityContent } from '@/ai/flows/seed-content-flow';

export async function seedContentForCity(city: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const result = await seedCityContent(city);
    if (result.success) {
      // Revalidate the home page to show the new posts
      revalidatePath('/');
      return { success: true, message: result.message };
    } else {
      return { success: false, error: result.message };
    }
  } catch (error: any) {
    console.error(`Error seeding content for ${city}:`, error);
    return { success: false, error: error.message || 'An unexpected server error occurred.' };
  }
}


'use server';

import { getAppSettingDb, setAppSettingDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getAppSetting(key: string): Promise<string | null> {
    try {
        return await getAppSettingDb(key);
    } catch (error) {
        console.error(`Failed to get app setting for key "${key}":`, error);
        return null;
    }
}

export async function setAppSetting(key: string, value: string): Promise<{ success: boolean; error?: string }> {
    try {
        await setAppSettingDb(key, value);
        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error: any) {
        console.error(`Failed to set app setting for key "${key}":`, error);
        return { success: false, error: error.message };
    }
}

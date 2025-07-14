'use server';

import { redirect } from 'next/navigation';
import * as db from '@/lib/db';
import { getSession } from '@/app/auth/actions';
import { revalidatePath } from 'next/cache';

// This file is obsolete. All chat actions have been consolidated into /src/app/actions.ts to resolve build errors.

export async function createGroup(groupName: string, memberIds: number[]): Promise<{ success: boolean; error?: string; conversationId?: number }> {
    const { user } = await getSession();
    if (!user) {
        return { success: false, error: 'You must be logged in to create a group.' };
    }
    if (!groupName.trim()) {
        return { success: false, error: 'Group name cannot be empty.' };
    }
    if (memberIds.length === 0) {
        return { success: false, error: 'A group must have at least one other member.' };
    }

    try {
        const allMemberIds = Array.from(new Set([user.id, ...memberIds]));
        const newConversation = await db.createGroupConversationDb(user.id, groupName.trim(), allMemberIds);
        
        revalidatePath('/chat');
        return { success: true, conversationId: newConversation.id };

    } catch (error: any) {
        console.error('Error creating group:', error);
        return { success: false, error: 'Failed to create group due to a server error.' };
    }
}

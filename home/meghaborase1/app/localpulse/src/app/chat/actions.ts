
'use server';

import * as db from '@/lib/db';
import type { Conversation, Message, User, ConversationParticipant } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { admin as firebaseAdmin } from '@/lib/firebase-admin';
import { getSession } from '@/app/auth/actions';
import { redirect } from 'next/navigation';

export async function startChatAndRedirect(formData: FormData): Promise<void> {
  const { user } = await getSession();
  if (!user) {
    redirect('/login');
  }

  const otherUserIdRaw = formData.get('otherUserId');
  if (!otherUserIdRaw) {
    console.error("startChatAndRedirect: otherUserId is missing from form data.");
    return;
  }
  
  const otherUserId = parseInt(otherUserIdRaw as string, 10);
  if (isNaN(otherUserId) || otherUserId === user.id) {
    return;
  }
  
  const conversationId = await db.findOrCreateConversationDb(user.id, otherUserId);
  
  revalidatePath('/chat');
  redirect(`/chat/${conversationId}`);
}

export async function getConversations(): Promise<Conversation[]> {
  const { user } = await getSession();
  if (!user) return [];
  try {
    return await db.getConversationsForUserDb(user.id);
  } catch (error) {
    console.error("Server action error fetching conversations:", error);
    return [];
  }
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  const { user } = await getSession();
  if (!user) return [];
  try {
    // This check is now performed inside the DB function
    return await db.getMessagesForConversationDb(conversationId, user.id);
  } catch (error) {
    console.error(`Server action error fetching messages for conversation ${conversationId}:`, error);
    return [];
  }
}

async function sendChatNotification(conversationId: number, sender: User, content: string, title?: string) {
  try {
    const partner = await db.getConversationPartnerDb(conversationId, sender.id);
    if (!partner) return;

    const deviceTokens = await db.getDeviceTokensForUsersDb([partner.id]);
    if (deviceTokens.length === 0) return;

    const notificationPayload = {
      notification: {
        title: title || `New message from ${sender.name}`,
        body: content.length > 100 ? `${content.substring(0, 97)}...` : content,
      },
      data: {
        conversationId: String(conversationId),
        type: 'chat_message',
      },
      tokens: deviceTokens,
      android: {
        priority: 'high' as const,
      },
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(notificationPayload);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(deviceTokens[idx]);
        }
      });
      console.error('List of tokens that failed for chat notification:', failedTokens);
      for (const token of failedTokens) {
        await db.deleteDeviceTokenDb(token);
      }
    }
  } catch (error) {
    console.error('Error sending chat notification:', error);
  }
}

export async function sendMessage(conversationId: number, content: string): Promise<{ message?: Message; error?: string }> {
  const { user } = await getSession();
  if (!user) return { error: 'You must be logged in to send messages.' };

  try {
    const message = await db.addMessageDb({
      conversationId,
      senderId: user.id,
      content,
    });
    
    // Send notification in the background with the default title
    sendChatNotification(conversationId, user, content).catch(err => {
        console.error("Background task to send chat notification failed:", err);
    });

    revalidatePath(`/chat/${conversationId}`);
    revalidatePath('/chat'); // To update the sidebar
    return { message };
  } catch (error: any) {
    return { error: 'Failed to send message due to a server error.' };
  }
}

export async function getConversationPartner(conversationId: number, currentUserId: number): Promise<ConversationParticipant | null> {
    try {
        return await db.getConversationPartnerDb(conversationId, currentUserId);
    } catch (error) {
        console.error(`Server action error fetching partner for conversation ${conversationId}:`, error);
        return null;
    }
}

export async function markConversationAsRead(conversationId: number): Promise<void> {
    const { user } = await getSession();
    if (!user) return;
    try {
        await db.markConversationAsReadDb(conversationId, user.id);
        revalidatePath('/chat'); // Revalidate sidebar and nav badge
    } catch (error) {
        console.error(`Server action error marking conversation ${conversationId} as read:`, error);
    }
}


'use server';

import { getAllUsersWithDeviceTokensDb } from '@/lib/db';
import { admin as firebaseAdmin } from '@/lib/firebase-admin';
import type { MulticastMessage } from 'firebase-admin/messaging';

export async function sendLpPointsNotification(): Promise<{ success: boolean; error?: string; successCount?: number; failureCount?: number }> {
  if (!firebaseAdmin) {
    return { success: false, error: 'Firebase Admin not configured. Cannot send notifications.' };
  }
  
  try {
    const usersWithTokens = await getAllUsersWithDeviceTokensDb();
    if (usersWithTokens.length === 0) {
      return { success: false, error: 'No users with registered devices found.' };
    }

    const messages: MulticastMessage[] = usersWithTokens.map(user => ({
      token: user.token,
      notification: {
        title: 'Check your LP Points! ✨',
        body: `You have ${user.lp_points} LP points! Keep pulsing to earn more.`,
      },
      data: {
          user_auth_token: user.user_auth_token || ''
      },
      android: { priority: 'high' as const },
      apns: { payload: { aps: { 'content-available': 1 } } }
    }));

    // Firebase allows sending up to 500 messages at a time.
    // For larger scale, we would need to batch this. For now, this is sufficient.
    const batchResponse = await firebaseAdmin.messaging().sendEach(messages as any[]);
    
    console.log(`Notifications sent: ${batchResponse.successCount} success, ${batchResponse.failureCount} failures.`);

    if (batchResponse.failureCount > 0) {
      batchResponse.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${usersWithTokens[idx].token}:`, resp.error);
        }
      });
    }

    return { success: true, successCount: batchResponse.successCount, failureCount: batchResponse.failureCount };

  } catch (error: any) {
    console.error('Error sending LP points notification:', error);
    return { success: false, error: 'An unexpected server error occurred.' };
  }
}

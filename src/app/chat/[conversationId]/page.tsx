
import { getMessages, getConversationPartner, markConversationAsRead } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { notFound, redirect } from 'next/navigation';
import ChatClient from './chat-client';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: { conversationId: string } }) {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    redirect('/login');
  }

  const conversationId = parseInt(params.conversationId, 10);
  if (isNaN(conversationId)) {
    notFound();
  }
  
  // These will run in parallel
  const [initialMessages, partner] = await Promise.all([
    getMessages(conversationId),
    getConversationPartner(conversationId, sessionUser.id),
    markConversationAsRead(conversationId) // Mark as read on load
  ]);

  if (!partner) {
    // This means the user is not part of this conversation
    notFound();
  }

  return (
    <ChatClient
      initialMessages={initialMessages}
      partner={partner}
      sessionUser={sessionUser}
      conversationId={conversationId}
    />
  );
}

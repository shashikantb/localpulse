
import { getMessages, getConversationDetails, markConversationAsRead } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { notFound, redirect } from 'next/navigation';
import ChatClient from './chat-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

const ChatClientSkeleton = () => (
    <div className="flex flex-col h-full">
        <div className="p-3 border-b"><Skeleton className="h-12 w-3/4"/></div>
        <div className="p-4 border-b"><Skeleton className="h-10 w-full"/></div>
        <div className="flex-grow p-4 space-y-4">
            <div className="flex justify-start"><Skeleton className="h-16 w-1/2 rounded-lg"/></div>
            <div className="flex justify-end"><Skeleton className="h-20 w-3/5 rounded-lg"/></div>
            <div className="flex justify-start"><Skeleton className="h-12 w-2/5 rounded-lg"/></div>
        </div>
    </div>
)


export default async function ConversationPage({ params }: { params: { conversationId: string } }) {
  const { user: sessionUser } = await getSession();
  if (!sessionUser) {
    redirect('/login');
  }

  const conversationId = parseInt(params.conversationId, 10);
  if (isNaN(conversationId)) {
    notFound();
  }
  
  // Mark as read first
  await markConversationAsRead(conversationId);

  // Then fetch details
  const [initialMessages, conversationDetails] = await Promise.all([
    getMessages(conversationId),
    getConversationDetails(conversationId),
  ]);

  if (!conversationDetails) {
    notFound();
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Suspense fallback={<ChatClientSkeleton/>}>
            <ChatClient
            initialMessages={initialMessages}
            conversationDetails={conversationDetails}
            sessionUser={sessionUser}
            conversationId={conversationId}
            />
        </Suspense>
      </div>
    </div>
  );
}

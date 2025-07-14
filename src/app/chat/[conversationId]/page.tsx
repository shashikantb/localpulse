

import { getMessages, getConversationDetails, markConversationAsRead } from '@/app/actions';
import { getSession } from '@/app/auth/actions';
import { notFound, redirect } from 'next/navigation';
import ChatClient from './chat-client';
import { Suspense } from 'react';
import ChatInfoSidebar, { ChatInfoSidebarSkeleton } from './chat-info-sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Users, PanelLeftOpen } from 'lucide-react';

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
  
  const [initialMessages, conversationDetails] = await Promise.all([
    getMessages(conversationId),
    getConversationDetails(conversationId),
    markConversationAsRead(conversationId) // Mark as read on load
  ]);

  if (!conversationDetails) {
    notFound();
  }

  const chatInfoContent = (
    <Suspense fallback={<ChatInfoSidebarSkeleton />}>
      <ChatInfoSidebar conversationId={conversationId} />
    </Suspense>
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatClient
          initialMessages={initialMessages}
          conversationDetails={conversationDetails}
          sessionUser={sessionUser}
          conversationId={conversationId}
        />
      </div>

      {conversationDetails.is_group && (
        <>
          {/* Desktop Sidebar */}
          <aside className="w-80 border-l flex-col hidden lg:flex h-full">
            {chatInfoContent}
          </aside>
          {/* Mobile Sheet */}
          <div className="absolute top-[10px] right-[10px] lg:hidden">
              <Sheet>
                  <SheetTrigger asChild>
                      <Button variant="ghost" size="icon">
                          <Users className="h-5 w-5" />
                          <span className="sr-only">Group Info</span>
                      </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[300px] sm:w-[400px] p-0">
                      {chatInfoContent}
                  </SheetContent>
              </Sheet>
          </div>
        </>
      )}
    </div>
  );
}

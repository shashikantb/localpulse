

import React, { type FC, type PropsWithChildren, Suspense } from 'react';
import ChatSidebar from '@/components/chat-sidebar';
import { Skeleton } from '@/components/ui/skeleton';

const ChatSidebarSkeleton = () => (
    <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
        ))}
    </div>
);

const ChatLayout: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="flex flex-1 border-t h-[calc(100vh_-_var(--header-height,8.5rem))] md:h-[calc(100svh_-_var(--header-height,8.5rem))]">
      <aside className="w-full md:w-80 lg:w-96 border-r flex-col hidden md:flex overflow-y-auto">
        <Suspense fallback={<ChatSidebarSkeleton />}>
           <ChatSidebar />
        </Suspense>
      </aside>
      <main className="flex-1 flex flex-col h-full">
        {children}
      </main>
    </div>
  );
};

export default ChatLayout;

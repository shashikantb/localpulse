import ChatSidebar from '@/components/chat-sidebar';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  return (
    <>
      {/* View for mobile: Show the full sidebar to enable searching and starting chats */}
      <div className="h-full md:hidden">
        <ChatSidebar />
      </div>

      {/* View for desktop: Show the placeholder message in the main content area */}
      <div className="h-full flex-col items-center justify-center bg-muted/30 hidden md:flex">
        <MessageSquare className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-2xl font-semibold text-muted-foreground">Select a conversation</h2>
        <p className="text-muted-foreground">Choose a chat from the sidebar to start messaging.</p>
      </div>
    </>
  );
}

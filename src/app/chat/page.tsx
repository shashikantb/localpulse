
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="h-full flex-col items-center justify-center bg-muted/30 hidden md:flex">
      <MessageSquare className="w-16 h-16 text-muted-foreground/50 mb-4" />
      <h2 className="text-2xl font-semibold text-muted-foreground">Select a conversation</h2>
      <p className="text-muted-foreground">Choose a chat from the sidebar to start messaging.</p>
    </div>
  );
}

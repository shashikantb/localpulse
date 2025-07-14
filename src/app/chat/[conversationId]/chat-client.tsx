
'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Message, User, ConversationDetails } from '@/lib/db-types';
import { getMessages, sendMessage } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import ChatInfoSidebar from './chat-info-sidebar';

interface ChatClientProps {
  initialMessages: Message[];
  conversationDetails: ConversationDetails;
  sessionUser: User;
  conversationId: number;
}

const POLLING_INTERVAL = 3000; // 3 seconds

// Helper function to render message content with clickable links
const renderChatMessageContent = (content: string) => {
  if (!content) return content;

  // Regex to find URLs
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = content.split(urlRegex);

  return parts.map((part, index) => {
    if (part && part.match(urlRegex)) {
      const href = part.startsWith('www.') ? `https://www.${part}` : part;
      return (
        <a
          key={`link-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};


export default function ChatClient({ initialMessages, conversationDetails, sessionUser, conversationId }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;
  
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const partner = !conversationDetails.is_group ? conversationDetails.participants?.[0] : null;

  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async () => {
        if (isSendingRef.current) {
            return;
        }
        try {
            const newMessages = await getMessages(conversationId);
            if (isMounted && JSON.stringify(messagesRef.current) !== JSON.stringify(newMessages)) {
                setMessages(newMessages);
            }
        } catch (error) {
            console.error("Failed to fetch new messages:", error);
        }
    };
    
    const intervalId = setInterval(fetchMessages, POLLING_INTERVAL);

    return () => {
        isMounted = false;
        clearInterval(intervalId);
    };
  }, [conversationId]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);

    const result = await sendMessage(conversationId, newMessage.trim());
    
    if (result.error || !result.message) {
      console.error('Failed to send message:', result.error);
      toast({
        variant: 'destructive',
        title: 'Message Not Sent',
        description: result.error || 'Could not send the message. Please try again.',
      });
    } else {
      // Optimistically add the new message to the top of the list
      setMessages(prev => [result.message!, ...prev]);
      setNewMessage('');
    }
    
    setIsSending(false);
  };

  const headerContent = (
      <div className="flex items-center gap-3 hover:bg-muted p-2 rounded-md">
        <Avatar>
            <AvatarImage src={conversationDetails.display_avatar_url || undefined} alt={conversationDetails.display_name} />
            <AvatarFallback>{conversationDetails.is_group ? <Users /> : conversationDetails.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold">{conversationDetails.display_name}</h2>
          {conversationDetails.is_group && (
              <p className="text-xs text-muted-foreground">{conversationDetails.participants.length} members</p>
          )}
        </div>
      </div>
  );

  return (
    <div className="flex flex-col bg-background h-full overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center p-3 border-b bg-card">
            {conversationDetails.is_group ? (
                <Sheet>
                    <SheetTrigger asChild>
                        <button className="w-full">{headerContent}</button>
                    </SheetTrigger>
                    <SheetContent className="w-[300px] sm:w-[400px] p-0" side="left">
                        <ChatInfoSidebar conversationId={conversationId} />
                    </SheetContent>
                </Sheet>
            ) : (
                <Link href={partner ? `/users/${partner.id}` : '#'}>
                    {headerContent}
                </Link>
            )}
        </header>

        {/* Message Input Form (Now at the top) */}
        <div className="flex-shrink-0 p-4 border-b bg-card">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 resize-none"
                rows={1}
                disabled={isSending}
                onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                }
                }}
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending}>
                {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                <span className="sr-only">Send</span>
            </Button>
            </form>
        </div>

        {/* Message List (Fills remaining space) */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
                const isSender = message.sender_id === sessionUser.id;
                const senderDetails = conversationDetails.participants.find(p => p.id === message.sender_id);

                return (
                <div
                    key={message.id}
                    className={cn('flex items-end gap-2 my-2', isSender ? 'justify-end' : 'justify-start')}
                >
                    {!isSender && (
                    <Avatar className="h-8 w-8 self-start">
                        <AvatarImage src={senderDetails?.profilepictureurl || undefined} />
                        <AvatarFallback>{senderDetails?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    )}
                    <div
                    className={cn(
                        'max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl flex flex-col',
                        isSender
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    )}
                    >
                    {!isSender && conversationDetails.is_group && (
                      <p className="text-xs font-semibold text-accent mb-1">{senderDetails?.name}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{renderChatMessageContent(message.content)}</p>
                    <span className={cn('text-xs mt-1.5 opacity-70', isSender ? 'self-end' : 'self-start')}>
                        {format(new Date(message.created_at), 'p')}
                    </span>
                    </div>
                </div>
                );
            })}
        </div>
    </div>
  );
}

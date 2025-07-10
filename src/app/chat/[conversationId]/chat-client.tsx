
'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Message, User, ConversationParticipant } from '@/lib/db-types';
import { getMessages, sendMessage } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, User as UserIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface ChatClientProps {
  initialMessages: Message[];
  partner: ConversationParticipant;
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
      const href = part.startsWith('www.') ? `https://${part}` : part;
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


export default function ChatClient({ initialMessages, partner, sessionUser, conversationId }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // Use a ref to track the sending state inside the polling interval
  // to avoid re-creating the interval on every state change.
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;
  
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async () => {
        // If a message is currently being sent, skip this poll cycle.
        // This prevents a race condition where the poll fetches data
        // before our optimistic update's corresponding message has been
        // saved to the database.
        if (isSendingRef.current) {
            return;
        }
        try {
            const newMessages = await getMessages(conversationId);
            // Only update state if the component is still mounted and data has changed.
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
  
  // This effect handles the keyboard visibility for WebViews
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handler = () => {
      if (containerRef.current) {
        const keyboardHeight = visualViewport.height < window.innerHeight
          ? window.innerHeight - visualViewport.height
          : 0;
        containerRef.current.style.setProperty('--keyboard-inset', `${keyboardHeight}px`);
      }
    };

    visualViewport.addEventListener('resize', handler);
    handler(); // Run once on mount

    return () => visualViewport.removeEventListener('resize', handler);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    const tempId = Date.now(); // For optimistic update
    const optimisticMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: sessionUser.id,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');

    const result = await sendMessage(conversationId, optimisticMessage.content);
    
    if (result.error || !result.message) {
      console.error('Failed to send message:', result.error);
      // Revert optimistic update on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({
        variant: 'destructive',
        title: 'Message Not Sent',
        description: result.error || 'Could not send the message. Please try again.',
      });
    } else {
      // Replace optimistic message with the real one from the server
      setMessages(prev => prev.map(m => m.id === tempId ? result.message! : m));
    }
    
    setIsSending(false);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-background"
      style={{ height: 'calc(100svh - var(--keyboard-inset, 0px))' }}
    >
      <header className="flex-shrink-0 flex items-center p-3 border-b bg-card">
        <Link href={`/users/${partner.id}`} className="flex items-center gap-3 hover:bg-muted p-2 rounded-md">
            <Avatar>
                <AvatarImage src={partner.profilepictureurl || undefined} alt={partner.name} />
                <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold">{partner.name}</h2>
        </Link>
      </header>

      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isSender = message.sender_id === sessionUser.id;
          return (
            <div
              key={message.id}
              className={cn('flex items-end gap-2', isSender ? 'justify-end' : 'justify-start')}
            >
              {!isSender && (
                <Avatar className="h-8 w-8 self-start">
                  <AvatarImage src={partner.profilepictureurl || undefined} />
                  <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
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
                <p className="text-sm whitespace-pre-wrap break-words">{renderChatMessageContent(message.content)}</p>
                <span className={cn('text-xs mt-1.5 opacity-70', isSender ? 'self-end' : 'self-start')}>
                  {format(new Date(message.created_at), 'p')}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-4 border-t bg-card">
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
    </div>
  );
}

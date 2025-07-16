

'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Message, User, ConversationDetails, MessageReaction } from '@/lib/db-types';
import { getMessages, sendMessage, deleteMessage, toggleMessageReaction } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Users, MoreHorizontal, Trash2, Smile } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ChatInfoSidebar from './chat-info-sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { useTheme } from 'next-themes';

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

const ReactionsDisplay = ({ reactions, onReactionClick }: { reactions: MessageReaction[]; onReactionClick: (reaction: string) => void }) => {
    if (!reactions || reactions.length === 0) return null;

    const groupedReactions = reactions.reduce((acc, reaction) => {
        acc[reaction.reaction] = (acc[reaction.reaction] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {Object.entries(groupedReactions).map(([emoji, count]) => (
                <button
                    key={emoji}
                    onClick={() => onReactionClick(emoji)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-foreground text-xs border border-transparent hover:border-primary transition-colors"
                >
                    <span>{emoji}</span>
                    <span className="font-medium">{count}</span>
                </button>
            ))}
        </div>
    );
};


export default function ChatClient({ initialMessages, conversationDetails, sessionUser, conversationId }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();
  
  const isSendingRef = useRef(isSending);
  isSendingRef.current = isSending;
  
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const partner = !conversationDetails.is_group ? conversationDetails.participants?.find(p => p.id !== sessionUser.id) : null;

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
  
  const handleDeleteMessage = async (messageId: number) => {
    // Optimistically remove the message from the UI
    setMessages(prev => prev.filter(m => m.id !== messageId));

    const result = await deleteMessage(messageId);
    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: result.error || 'Message could not be deleted. It may have already been removed.',
      });
      // Re-fetch messages to get the correct state
      getMessages(conversationId).then(setMessages);
    }
  };

  const handleReaction = async (messageId: number, emoji: string) => {
    // Optimistic update
    setMessages(prevMessages => prevMessages.map(msg => {
        if (msg.id !== messageId) return msg;

        const existingReactionIndex = msg.reactions?.findIndex(r => r.user_id === sessionUser.id);
        
        let newReactions = [...(msg.reactions || [])];

        if (existingReactionIndex !== -1) {
            // User already reacted
            if (newReactions[existingReactionIndex].reaction === emoji) {
                // Same reaction, remove it
                newReactions.splice(existingReactionIndex, 1);
            } else {
                // Different reaction, update it
                newReactions[existingReactionIndex] = { ...newReactions[existingReactionIndex], reaction: emoji };
            }
        } else {
            // New reaction
            newReactions.push({ id: -1, message_id: messageId, user_id: sessionUser.id, reaction: emoji, user_name: sessionUser.name });
        }
        
        return { ...msg, reactions: newReactions };
    }));
    
    const { success, error } = await toggleMessageReaction(messageId, emoji);
    if (!success) {
        toast({ variant: 'destructive', title: 'Reaction failed', description: error });
        // On failure, refetch to revert optimistic update
        getMessages(conversationId).then(setMessages);
    }
  }


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
        <div className="flex-grow overflow-y-auto p-4">
            {messages.map((message) => {
                const isSender = message.sender_id === sessionUser.id;
                const senderDetails = conversationDetails.participants.find(p => p.id === message.sender_id);

                return (
                <div
                    key={message.id}
                    className={cn(
                        'flex items-end gap-2 my-2 group',
                        isSender ? 'justify-end' : 'justify-start'
                    )}
                >
                    {!isSender && (
                    <Avatar className="h-8 w-8 self-start">
                        <AvatarImage src={senderDetails?.profilepictureurl || undefined} />
                        <AvatarFallback>{senderDetails?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    )}
                    <div className="flex flex-col" style={{ alignItems: isSender ? 'flex-end' : 'flex-start' }}>
                        <div className={cn('relative', isSender ? 'order-2' : 'order-1')}>
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
                            <div className={cn("absolute bottom-[-8px] z-10 opacity-0 group-hover:opacity-100 transition-opacity", isSender ? 'left-[-12px]' : 'right-[-12px]')}>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background border shadow-sm">
                                            <Smile className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 border-0">
                                        <EmojiPicker
                                            onEmojiClick={(emojiData) => handleReaction(message.id, emojiData.emoji)}
                                            theme={theme === 'dark' ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <ReactionsDisplay reactions={message.reactions || []} onReactionClick={(emoji) => handleReaction(message.id, emoji)} />
                    </div>

                    {isSender && (
                        <DropdownMenu>
                            <AlertDialog>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete your message.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteMessage(message.id)}>
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenu>
                    )}
                </div>
                );
            })}
        </div>
    </div>
  );
}

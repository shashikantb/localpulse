
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getConversations } from '@/app/actions';
import type { Conversation } from '@/lib/db-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Skeleton } from './ui/skeleton';

const ConversationItem = ({ conv }: { conv: Conversation }) => {
    const pathname = usePathname();
    const isActive = pathname === `/chat/${conv.id}`;

    return (
        <Link
            href={`/chat/${conv.id}`}
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted",
                isActive ? "bg-primary/10" : ""
            )}
        >
            <Avatar className="h-12 w-12 border-2"
             style={{ borderColor: isActive ? 'hsl(var(--primary))' : 'transparent' }}
            >
                <AvatarImage src={conv.participant_profile_picture_url || undefined} alt={conv.participant_name} />
                <AvatarFallback>{conv.participant_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline">
                    <p className="font-semibold truncate">{conv.participant_name}</p>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                        {conv.last_message_at ? formatDistanceToNowStrict(new Date(conv.last_message_at), { addSuffix: true }) : ''}
                    </p>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                    {conv.last_message_content || 'No messages yet.'}
                </p>
            </div>
        </Link>
    )
};


const ChatSidebar = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        setIsLoading(true);
        getConversations()
            .then(setConversations)
            .finally(() => setIsLoading(false));
    }, [pathname]); // Refetch when navigating between chats

    return (
        <div className="flex flex-col h-full bg-card">
            <div className="p-4 border-b">
                <h1 className="text-2xl font-bold text-primary">Chats</h1>
            </div>
            <ScrollArea className="flex-1">
                {isLoading && (
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
                )}
                {!isLoading && conversations.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        <p>No conversations yet.</p>
                        <p className="text-sm">Start a chat from a user's profile.</p>
                    </div>
                )}
                <div className="p-2 space-y-1">
                    {conversations.map(conv => (
                        <ConversationItem key={conv.id} conv={conv} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};

export default ChatSidebar;

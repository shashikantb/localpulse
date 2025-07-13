
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { getPointHistory } from '@/app/actions';
import type { PointTransaction, PointTransactionReason } from '@/lib/db-types';
import { Award, Calendar, Gift, Megaphone, ThumbsUp, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface LpPointsHistoryDialogProps {
  children: React.ReactNode;
  userId: number;
  isOwnProfile: boolean;
}

const reasonConfig: Record<PointTransactionReason, { icon: React.ElementType, text: string }> = {
    initial_signup_bonus: { icon: Gift, text: 'Welcome Bonus' },
    referral_bonus: { icon: UserPlus, text: 'Referral Bonus' },
    new_post: { icon: Megaphone, text: 'New Pulse' },
    post_like_milestone: { icon: ThumbsUp, text: 'Popular Pulse' },
};

const TransactionRow: React.FC<{ transaction: PointTransaction }> = ({ transaction }) => {
    const config = reasonConfig[transaction.reason] || { icon: Award, text: 'Misc Points' };
    const Icon = config.icon;

    return (
        <div className="flex items-center p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="mr-4 p-2 bg-primary/10 text-primary rounded-full">
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
                <p className="font-semibold text-foreground">{config.text}</p>
                <p className="text-sm text-muted-foreground">{transaction.description}</p>
            </div>
            <div className="text-right">
                <p className="font-bold text-green-600">+{transaction.points}</p>
                <p className="text-xs text-muted-foreground">
                    {format(new Date(transaction.created_at), 'MMM d, yyyy')}
                </p>
            </div>
        </div>
    );
};

const earningRules = [
    { icon: Gift, text: 'Sign up with a referral', points: '20' },
    { icon: UserPlus, text: 'Refer a new user', points: '50' },
    { icon: Megaphone, text: 'Create a new Pulse', points: '10' },
    { icon: ThumbsUp, text: 'Pulse gets 10+ likes', points: '20' },
];

export default function LpPointsHistoryDialog({ children, userId, isOwnProfile }: LpPointsHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && isOwnProfile && history.length === 0) {
      setIsLoading(true);
      const fetchedHistory = await getPointHistory(userId);
      setHistory(fetchedHistory);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
          <div className="cursor-pointer">{children}</div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Award className="mr-2 h-6 w-6 text-accent" />
            LP Points History
          </DialogTitle>
          <DialogDescription>
            A record of all the points you've earned. Keep pulsing!
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-60 pr-4 -mr-4">
            {isLoading ? (
                <div className="space-y-3 py-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : history.length > 0 ? (
                <div className="space-y-2">
                    {history.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)}
                </div>
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <p>No transaction history yet.</p>
                </div>
            )}
        </ScrollArea>
        <Alert>
            <Award className="h-4 w-4" />
            <AlertTitle>How to Earn LP Points</AlertTitle>
            <AlertDescription>
                <ul className="mt-2 space-y-2 text-foreground/90">
                    {earningRules.map((rule, index) => {
                        const Icon = rule.icon;
                        return (
                            <li key={index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                    <Icon className="w-4 h-4 mr-2 text-primary" />
                                    <span>{rule.text}</span>
                                </div>
                                <span className="font-bold text-green-600">+{rule.points}</span>
                            </li>
                        );
                    })}
                </ul>
            </AlertDescription>
        </Alert>
        <Alert>
            <Calendar className="h-4 w-4" />
            <AlertTitle>Coming Soon!</AlertTitle>
            <AlertDescription>
                An exciting redemption system is on its way. Stay tuned!
            </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

interface CopyReferralButtonProps {
    code: string;
}

export default function CopyReferralButton({ code }: CopyReferralButtonProps) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        toast({
            title: 'Code Copied!',
            description: 'Your referral code has been copied to the clipboard.',
        });
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleCopy}
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Copy Code</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

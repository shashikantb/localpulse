
'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/auth/actions';
import { Loader2, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Add type definition for the Android interface
declare global {
  interface Window {
    Android?: {
      setLoginStatus?: (isLoggedIn: boolean) => void;
      logout?: () => void;
      clearCookies?: () => void;
    };
  }
}

export default function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleLogout = () => {
    startTransition(async () => {
      // --- Communicate with Android App ---
      if (window.Android) {
        if (window.Android.logout) {
          window.Android.logout();
        }
        if (window.Android.clearCookies) {
          // Explicitly clear cookies to handle JWS errors
          window.Android.clearCookies();
        }
      }
      // --- END ---
      
      await logout();
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      router.push('/'); // Redirect to home page after logout
      router.refresh();
    });
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isPending}
      variant="outline"
      size="sm"
    >
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
      Logout
    </Button>
  );
}

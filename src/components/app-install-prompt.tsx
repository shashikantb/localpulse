
'use client';

import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Smartphone } from 'lucide-react';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.borgavakar.localpulse';

// A simple user agent check for Android.
const isAndroid = () => {
  return typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
};

// Check if we are inside our custom WebView by looking for a JS interface.
// Your Android app must inject an object named 'Android' for this to work.
const isInAppWebView = () => {
    return typeof window !== 'undefined' && (window as any).Android;
};

export const AppInstallPrompt = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only run this logic on the client
    const promptDismissed = sessionStorage.getItem('appInstallPromptDismissed');
    
    // Conditions to show the prompt:
    // 1. It hasn't been dismissed before in this session.
    // 2. The user is on an Android device.
    // 3. The user is NOT in our app's WebView.
    if (!promptDismissed && isAndroid() && !isInAppWebView()) {
      // Add a small delay to not be too intrusive on page load
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 3500); // 3.5-second delay

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    // Using sessionStorage means it will prompt again in a new tab/session, which is less annoying.
    sessionStorage.setItem('appInstallPromptDismissed', 'true');
    setIsOpen(false);
  };
  
  const handleInstall = () => {
    sessionStorage.setItem('appInstallPromptDismissed', 'true');
    setIsOpen(false);
    window.open(PLAY_STORE_URL, '_blank');
  };

  // Do not render anything if the dialog is not open
  if (!isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-xs rounded-xl">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
             <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20">
                <Smartphone className="w-10 h-10 text-primary" />
             </div>
          </div>
          <AlertDialogTitle className="text-center text-2xl font-bold">Get the Full Experience</AlertDialogTitle>
          <AlertDialogDescription className="text-center px-4">
            Install our native app for faster performance and real-time push notifications.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col space-y-2 sm:flex-col sm:space-x-0 pt-4">
          <Button onClick={handleInstall} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg">
            Install from Google Play
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full">
            Continue in Browser
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

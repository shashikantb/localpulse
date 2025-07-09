
'use client';

import { useEffect } from 'react';
import { registerDeviceToken } from '@/app/actions';

// This component handles the client-side logic for Firebase Cloud Messaging.
// It's responsible for requesting notification permission and registering the device token.
const FirebaseMessagingClient = () => {
  useEffect(() => {
    // This effect runs once on the client when the app loads.
    const setupFirebaseMessaging = async () => {
      // The service worker must be successfully registered before we can get a token.
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered with scope:', registration.scope);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        return; // Exit if service worker fails
      }
      
      // Check for a custom interface provided by the native Android app's WebView.
      // If this exists, we assume we are inside the app and can get the token directly.
      if (window.Android && typeof window.Android.getFCMToken === 'function') {
        let attempts = 0;
        const maxAttempts = 5;
        const interval = setInterval(async () => {
          const token = window.Android.getFCMToken();
          if (token) {
            clearInterval(interval);
            console.log('FCM Token from Android WebView:', token);
            // Register the token with the server
            await registerDeviceToken(token);
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              console.warn('Could not retrieve FCM token from Android WebView after multiple attempts.');
            }
          }
        }, 1000);
      } else {
        // This is a standard web browser, so do nothing.
        // The notification permission request is handled by the user clicking the "Notifications" button.
        console.log("Not inside Android WebView. Notification setup will be user-initiated.");
      }
    };
    
    // Ensure this runs only on the client side
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', setupFirebaseMessaging);
    }
    
    return () => {
        window.removeEventListener('load', setupFirebaseMessaging);
    };

  }, []);

  return null; // This component does not render anything.
};

export default FirebaseMessagingClient;

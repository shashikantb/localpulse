
// This file must be in the public directory.

// Import the Firebase scripts that are needed
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
// These values are pulled from your .env.local file. They must be public.
const firebaseConfig = {
    apiKey: "%NEXT_PUBLIC_FIREBASE_API_KEY%",
    authDomain: "%NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN%",
    projectId: "%NEXT_PUBLIC_FIREBASE_PROJECT_ID%",
    storageBucket: "%NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET%",
    messagingSenderId: "%NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID%",
    appId: "%NEXT_PUBLIC_FIREBASE_APP_ID%"
};

// Initialize Firebase
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

// Get an instance of Firebase Messaging
const messaging = firebase.messaging();

// This handler will be called when a push notification is received
// while the app is in the background.
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize the notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png' // Default icon for notifications
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

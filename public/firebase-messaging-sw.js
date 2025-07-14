// This file MUST be in the public folder

// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase services
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// --- START: CONFIGURATION ---
// Initialize the Firebase app in the service worker by passing in
// your app's Firebase project configuration.
// This configuration is PUBLIC and does not contain any secrets.
// It's the same config you use to initialize Firebase on the client-side.
const firebaseConfig = {
    apiKey: "__REPLACE_WITH_YOUR_FIREBASE_API_KEY__",
    authDomain: "__REPLACE_WITH_YOUR_FIREBASE_AUTH_DOMAIN__",
    projectId: "__REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID__",
    storageBucket: "__REPLACE_WITH_YOUR_FIREBASE_STORAGE_BUCKET__",
    messagingSenderId: "__REPLACE_WITH_YOUR_FIREBASE_MESSAGING_SENDER_ID__",
    appId: "__REPLACE_WITH_YOUR_FIREBASE_APP_ID__"
};
// --- END: CONFIGURATION ---


// Initialize Firebase
try {
  if (!firebase.apps.length) {
    const app = firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging(app);

    // --- Background Message Handler ---
    // This function is triggered when the app is in the background or closed,
    // and a push notification with a `notification` payload is received.
    messaging.onBackgroundMessage((payload) => {
      console.log(
        '[firebase-messaging-sw.js] Received background message ',
        payload
      );

      // --- Handle Location Update Request ---
      if (payload.data && payload.data.type === 'REQUEST_LOCATION_UPDATE') {
        console.log('Location update requested by', payload.data.requesterName);

        // This is a special return to keep the service worker alive
        // while we perform the async geolocation task.
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              console.log('Got background location:', { latitude, longitude });

              try {
                const token = await messaging.getToken();
                if (token) {
                  // Use the existing registerDeviceToken server action to update the location
                  // We're essentially "re-registering" with fresh coordinates.
                  await fetch('/api/actions/register-token-from-sw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, latitude, longitude }),
                  });
                  console.log('Successfully sent updated location to server.');
                  resolve();
                } else {
                    console.error('Could not get FCM token in service worker to update location.');
                    reject('No FCM token available');
                }
              } catch (error) {
                console.error('Error sending location to server:', error);
                reject(error);
              }
            },
            (error) => {
              console.error('Error getting geolocation in background:', error);
              reject(error);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        });
      }

      // --- Handle Standard Visible Notifications ---
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: '/icons/icon-192x192.png', // Default icon for notifications
        data: {
          user_auth_token: payload.data ? payload.data.user_auth_token : undefined,
        },
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (e) {
  console.error('Error initializing Firebase in Service Worker', e);
}


// --- Notification Click Handler ---
// This function is triggered when a user clicks on a notification.
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event);
  event.notification.close();

  const authToken = event.notification.data.user_auth_token;

  // This will open the app and focus it if it's already open.
  // We append the auth token so the app can auto-login the user.
  const promiseChain = clients.openWindow(
    `/?auth_token=${authToken || ''}`
  );
  event.waitUntil(promiseChain);
});

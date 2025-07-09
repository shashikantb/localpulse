
// This service worker script must be located at the top-level directory of your site.
// It will be served from `/firebase-messaging-sw.js`
// See https://firebase.google.com/docs/cloud-messaging/js/client#retrieve-the-current-registration-token

// Scripts for Firebase products are imported using the window.importScripts method.
// These scripts are available at the following URLs:
// https://firebase.google.com/docs/web/setup#available-libraries

importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// Note: This configuration will be dynamically replaced by your actual Firebase config
// when the client-side code loads. This is just a placeholder.
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// This handler will be called when a notification is clicked and the app is in the background or closed.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Nothing to do here for clicks, as that's handled by the 'notificationclick' event listener.
});

// Event listener for when a user clicks on a notification.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const notificationData = event.notification.data;
  console.log('[firebase-messaging-sw.js] Notification click received.', notificationData);

  // Check for a URL in the notification payload.
  // The server actions (`sendNotificationsForNewPost`, `sendChatNotification`) are configured
  // to add this data.
  let openUrl = '/';
  if (notificationData.postId) {
      openUrl = `/posts/${notificationData.postId}`;
  } else if (notificationData.conversationId) {
      openUrl = `/chat/${notificationData.conversationId}`;
  }

  // This function tells the browser to open a new window or focus an existing one.
  event.waitUntil(
      clients.matchAll({
          type: "window"
      }).then(function(clientList) {
          // Check if there's already a window open for this site.
          for (var i = 0; i < clientList.length; i++) {
              var client = clientList[i];
              if (client.url === '/' && 'focus' in client) {
                  // If we find an open window, focus it and navigate to the correct URL.
                  return client.focus().then(client => client.navigate(openUrl));
              }
          }
          // If no window is open, open a new one.
          if (clients.openWindow) {
              return clients.openWindow(openUrl);
          }
      })
  );
});

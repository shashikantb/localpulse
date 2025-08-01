# Firebase Studio (LocalPulse)

This is a NextJS starter application, configured to use PostgreSQL as its database.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or later recommended)
- npm or yarn
- A running PostgreSQL instance (either local or cloud-hosted)
- A process manager like `pm2` for production.
- NGINX or another reverse proxy for production deployments.

## Environment Variables

Create a `.env.local` file in the root of your project and add the following environment variables.

```env
# Recommended for Production for better performance and security
NODE_ENV=production

# PostgreSQL Connection URL (MANDATORY)
# Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
POSTGRES_URL=your_postgresql_connection_string

# Optional: If your PostgreSQL instance requires SSL (common for cloud databases)
POSTGRES_SSL=true

# Secure key for signing user session tokens (JWTs) (MANDATORY FOR PRODUCTION)
# This is crucial for production security.
# You can generate a strong secret with the command: openssl rand -hex 32
JWT_SECRET=your_super_secret_jwt_key_here

# --- Genkit AI Helper (MANDATORY for AI features) ---
# This key is required to power the "AI Local Helper" feature.
# It allows the app to connect to Google's Gemini models.
# Get your key from Google AI Studio: https://aistudio.google.com/app/apikey
#
# COST: The Gemini API has a generous free tier. For many apps, especially
# during development and early stages, usage will likely fall within this
# free tier, meaning there is no cost. You only pay for what you use
# above the free limit, and this requires setting up a billing account.
GOOGLE_GENAI_API_KEY=your_google_genai_api_key

# SerpApi API Key (MANDATORY for AI Content Seeding)
# This key is required for the content seeding feature to perform live web searches for news.
# Get your key from https://serpapi.com/
SERPAPI_API_KEY=your_serpapi_api_key

# Admin Credentials (change these for production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123

# Official User Password (Optional)
# Set this if you want to be able to log in as the official@localpulse.in user.
# If not set, the account will be locked and cannot be logged into.
OFFICIAL_USER_PASSWORD=your_official_user_password

# --- Firebase Configuration (for Web Push Notifications) ---
# This is required for handling notification clicks on the web.
# To find these values:
# 1. Go to your Firebase project: https://console.firebase.google.com/
# 2. Go to Project Settings (click the gear icon).
# 3. Under the "General" tab, scroll down to "Your apps".
# 4. If you haven't already, add a "Web" app.
# 5. In the app's configuration, you will find these values.
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"

```

**Important Notes:**
- **`POSTGRES_URL`**: Ensure special characters in your username/password are URL-encoded.
- **`JWT_SECRET`**: This MUST be set to a secure random string for production. You can generate one with `openssl rand -hex 32`.

## Getting Started (Local Development)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables:**
    Create the `.env.local` file as described above.

3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
---

## Production Deployment Guide

For production, the recommended setup is to run the Next.js app using a process manager like `pm2` and have a reverse proxy like NGINX handle incoming traffic and SSL.

### Step 1: Build the Application
On your server, run the build command:
```bash
npm run build
```

### Step 2: Configure PM2
This project includes an `ecosystem.config.js` file to simplify running the app with `pm2`.

To start the application, use:
```bash
pm2 start ecosystem.config.js
```
This will start the app named `localpulse-app`.

To check logs:
```bash
pm2 logs localpulse-app
```
To reload the app after making changes to `.env.local`:
```bash
pm2 reload localpulse-app --update-env
```

### Step 3: Configure NGINX as a Reverse Proxy
Your application **must** be served over HTTPS for secure login cookies to work correctly. Create an NGINX site configuration for your domain (`localpulse.in`) to proxy requests to your Next.js application (which runs on port 3000 by default).

A sample NGINX configuration snippet:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name localpulse.in;

    # SSL Certs from Let's Encrypt or your provider
    ssl_certificate /path/to/your/fullchain.pem;
    ssl_certificate_key /path/to/your/privkey.pem;
    # ... other ssl settings

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # CRITICAL LINE FOR SECURE COOKIES
        # This tells Next.js that the original connection was secure (HTTPS).
        proxy_set_header X-Forwarded-Proto https;
    }
}
```
After saving your configuration, enable it and reload NGINX:
```bash
sudo systemctl reload nginx
```

## Troubleshooting

### Login works, but I'm immediately logged out.

This is the classic symptom of your NGINX reverse proxy not correctly telling the Next.js application that the connection is secure (HTTPS). The application then creates a session cookie that the browser refuses to send back, causing you to be logged out.

**The Solution: Verify NGINX Configuration**

The most secure and permanent solution is to ensure the following line is present in your NGINX site configuration file (e.g., `/etc/nginx/sites-available/localpulse.in`):

```nginx
# ... inside your server { ... } block
    location / {
        proxy_pass http://localhost:3000;
        # ... other proxy settings
        
        # CRITICAL LINE FOR SECURE COOKIES
        # This tells Next.js that the original connection from the user was secure (HTTPS).
        proxy_set_header X-Forwarded-Proto https;
    }
# ...
```

After adding or verifying this line, reload NGINX for the change to take effect:
```bash
sudo systemctl reload nginx
```

Finally, **clear your browser's cookies** for `localpulse.in` and log in again.

### I see `ERR_JWS_SIGNATURE_VERIFICATION_FAILED` in my server logs.

This error means you recently changed your `JWT_SECRET` environment variable, but your browser is still trying to use a cookie signed with the old secret.

**The Solution: Clear Browser Cookies**

Clear your browser's cookies and site data for `localpulse.in`, then log in again. This will create a new, valid cookie signed with the new secret.

### I see `Error: Failed to find Server Action "..."` in my server logs.

This error typically happens after you have deployed new code, but your browser is still running an older version of the application. The page in your browser is trying to call a server function that has a different ID in the new deployment.

**The Solution: Hard Refresh Your Browser**

The solution is to force your browser to load the latest version of the application.
- On Windows/Linux: Press `Ctrl+Shift+R`.
- On Mac: Press `Cmd+Shift+R`.

This will clear the cache for the page and resolve the mismatch.

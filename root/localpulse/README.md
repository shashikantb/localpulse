
# Firebase Studio (LocalPulse)

This is a NextJS starter application, now configured to use PostgreSQL as its database.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or later recommended)
- npm or yarn
- A running PostgreSQL instance (either local or cloud-hosted like Google Cloud SQL)
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

# Google Generative AI API Key (if using Genkit features)
GOOGLE_GENAI_API_KEY=your_google_genai_api_key

# Admin Credentials (change these for production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123
```

**Important Notes:**
- **URL Encoding:** If your username or password in `POSTGRES_URL` contains special characters, they must be URL-encoded.
- **`JWT_SECRET`**: This is **mandatory** for production security.

## Production Setup with NGINX Reverse Proxy (HTTPS)

For production deployments, your application **must** be served over HTTPS for secure login cookies to work. The recommended setup is to use a reverse proxy like NGINX to handle SSL termination.

### 1. Configure NGINX
In your NGINX site configuration file, you need to proxy requests to your Next.js application (which runs on port 3000 by default). Critically, you must add the `X-Forwarded-Proto` header so that Next.js knows the original connection was secure.

Here is a sample NGINX configuration snippet:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your_domain.com;

    # SSL Certs from Let's Encrypt or your provider
    ssl_certificate /etc/letsencrypt/live/your_domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your_domain.com/privkey.pem;
    # ... other ssl settings

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # CRITICAL LINE FOR SECURE COOKIES
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### 2. Run the Production Server
After setting up your `.env.local` file and configuring NGINX, run the application:
```bash
npm run build
npm start 
# Or using a process manager like pm2
# pm2 start npm --name "localpulse-app" -- start
```

## Getting Started (Local Development)

1.  **Install Dependencies:** `npm install`
2.  **Set Up Environment Variables:** Create `.env.local`.
3.  **Run Development Server:** `npm run dev`

## Troubleshooting

### Login works, but I'm logged out on other pages (Production)
This is the classic symptom of the secure cookie issue.
- **Verify NGINX Config**: Ensure `proxy_set_header X-Forwarded-Proto https;` is present in your NGINX configuration and that NGINX has been reloaded (`sudo systemctl reload nginx`).
- **Restart the App**: After making any changes, you must restart your application (`pm2 restart <app-name>`).

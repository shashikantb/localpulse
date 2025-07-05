
# Firebase Studio (LocalPulse)

This is a NextJS starter application, now configured to use PostgreSQL as its database.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or later recommended)
- npm or yarn
- A running PostgreSQL instance (either local or cloud-hosted like Google Cloud SQL)

## Environment Variables

Create a `.env.local` file in the root of your project and add the following environment variables. **The application may not function correctly in production if critical variables like `POSTGRES_URL` and `JWT_SECRET` are missing.**

```env
# PostgreSQL Connection URL (MANDATORY)
# Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
# Example for a local DB: postgresql://youruser:yourpassword@localhost:5432/yourdatabase
# Example for a cloud DB: postgresql://youruser:yourpassword@your-cloud-host.com:5432/yourdatabase
POSTGRES_URL=your_postgresql_connection_string

# Optional: If your PostgreSQL instance requires SSL (common for cloud databases)
# Set to true if SSL is required, e.g., for Google Cloud SQL, AWS RDS, Azure PostgreSQL.
# POSTGRES_SSL=true 

# Secure key for signing user session tokens (JWTs) (MANDATORY FOR PRODUCTION)
# This is crucial for production security.
# The key should be a long, random string (at least 32 characters).
# You can generate a strong secret with the command: openssl rand -hex 32
JWT_SECRET=your_super_secret_jwt_key_here

# Recommended for Production for better performance and security
NODE_ENV=production

# !! IMPORTANT FOR PRODUCTION LOGIN !!
# Use this setting ONLY if your production site is not served over HTTPS.
# By default, production cookies are 'Secure', meaning browsers only send them over HTTPS.
# If your load balancer or reverse proxy terminates SSL and talks to Node.js over HTTP,
# the browser might not send the login cookie, and users will appear logged out.
# Setting this to 'true' makes the cookie non-secure, which is less safe but may be necessary
# for certain hosting environments.
# The best solution is to ensure end-to-end HTTPS.
ALLOW_INSECURE_LOGIN_FOR_HTTP=true

# Google Generative AI API Key (if using Genkit features)
GOOGLE_GENAI_API_KEY=your_google_genai_api_key

# Admin Credentials (change these for production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123
```

Replace `your_postgresql_connection_string` with the actual connection string for your PostgreSQL database.
You **must** replace `your_super_secret_jwt_key_here` with a secure, randomly generated string.
Update `ADMIN_USERNAME` and `ADMIN_PASSWORD` to secure values, especially for production.

**Important Notes for Production:**
- **`JWT_SECRET`**: This variable is **mandatory** for user authentication to work in production.
- **`POSTGRES_URL`**: This variable is **mandatory** for any database functionality.
- **HTTPS Required**: Because user login cookies are marked as `Secure`, your production deployment **must** be served over HTTPS for authentication to work correctly. If your site is served over HTTP, browsers will not send the login cookie, and the server will think you are a guest. See the `ALLOW_INSECURE_LOGIN_FOR_HTTP` setting for workarounds.
- **URL Encoding:** If your username or password in `POSTGRES_URL` contains special characters (e.g., `@`, `#`, `!`, `:`, `/`, `?`, `[`, `]`), they **must be URL-encoded**. For example, `my@secret#pass` becomes `my%40secret%23pass`.
- **SSL:** For cloud-hosted PostgreSQL (like Google Cloud SQL, AWS RDS, Azure), you will likely need to enable SSL by setting `POSTGRES_SSL=true`.

## Getting Started

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
    Open your web browser and go to `http://localhost:3000`.

## Troubleshooting

### PostgreSQL Connection Errors
This error means the application could not connect to your PostgreSQL server.
- **Check `.env.local`**: Ensure `POSTGRES_URL` is correct.
- **Restart Dev Server**: After any changes to `.env.local`, restart your server.
- **Firewall Rules**: For remote databases, ensure your firewall allows connections from your IP.
- **Local PostgreSQL Server**: Ensure your local PostgreSQL server is running and accessible.

### User is Not Logged In (in Production)
If login works but features for logged-in users (like SOS, Add Family, Profile editing) are missing in your production environment:
- **Check `JWT_SECRET`**: Ensure the `JWT_SECRET` environment variable is correctly set in your production hosting environment (e.g., in Google Cloud Run's environment variable settings).
- **Check for HTTPS**: The application sets secure cookies in production, which require an HTTPS connection. If your production site is not served over HTTPS, browsers will not send the login cookie, and the server will think you are a guest. As a temporary workaround for environments without end-to-end HTTPS, you can set `ALLOW_INSECURE_LOGIN_FOR_HTTP=true` in your `.env.local` file, but this is less secure.

To get started, take a look at `src/app/page.tsx`.

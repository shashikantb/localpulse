# Firebase Studio (LocalPulse)

This is a NextJS starter application, now configured to use PostgreSQL as its database.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or later recommended)
- npm or yarn
- A running PostgreSQL instance (either local or cloud-hosted like Google Cloud SQL)
- `openssl` for generating SSL certificates in production.

## Environment Variables

Create a `.env.local` file in the root of your project and add the following environment variables.

```env
# Recommended for Production for better performance and security
NODE_ENV=production

# PostgreSQL Connection URL (MANDATORY)
# Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
# Example: postgresql://youruser:yourpassword@your-cloud-host.com:5432/yourdatabase
POSTGRES_URL=your_postgresql_connection_string

# Optional: If your PostgreSQL instance requires SSL (common for cloud databases)
# Set to true if required, e.g., for Google Cloud SQL, AWS RDS, Azure PostgreSQL.
# POSTGRES_SSL=true 

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

**Important Notes for `POSTGRES_URL`:**
- **URL Encoding:** If your username or password contains special characters (e.g., `@`, `#`, `!`), they **must be URL-encoded**.
- **SSL:** For cloud databases, you will likely need to enable SSL by setting `POSTGRES_SSL=true`.

## Production Setup with HTTPS

For production deployments, especially when behind a load balancer that terminates SSL, the application must run in HTTPS mode to ensure secure cookies work correctly.

### 1. Generate Self-Signed Certificates
On your production VM, navigate to the project's root directory (`/home/meghaborase1/app/localpulse`) and run the following command to generate a self-signed SSL certificate and key. These will be used by the application's internal server.

```bash
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.cert -days 365 -nodes
```
When prompted, you can leave the fields blank by pressing Enter. This will create two files: `server.key` and `server.cert`.

**Important**: If you are running multiple VMs, this command must be run on **each VM**.

### 2. Configure Your Load Balancer
Ensure your GCP Load Balancer's backend service is configured to use the **HTTPS** protocol to communicate with your VMs on port 3000 (or your configured port). You may need to configure health checks to also use HTTPS.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables:**
    Create the `.env.local` file as described above.

3.  **Run the Development Server (Local):**
    ```bash
    npm run dev
    ```

4.  **Run the Production Server:**
    After setting up your `.env.local` file and generating SSL certs (if in production), run:
    ```bash
    npm run build
    npm start 
    # Or using a process manager like pm2
    # pm2 start npm --name "localpulse-app" -- start
    ```

## Troubleshooting

### Login works, but I'm logged out on other pages (Production)
This is the classic symptom of the secure cookie issue.
- **Verify Certificates**: Ensure `server.key` and `server.cert` exist in your project's root directory on the production VM.
- **Verify `package.json`**: Make sure the `start` script is `node server.js`.
- **Verify Load Balancer Protocol**: Double-check that your load balancer's backend service is set to use **HTTPS** to communicate with your VMs.
- **Restart the App**: After making any changes, you must rebuild and restart your application (`npm run build`, `pm2 restart <app-name>`).

To get started, take a look at `src/app/page.tsx`.


# Firebase Studio (LocalPulse)

This is a NextJS starter application, now configured to use PostgreSQL as its database.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or later recommended)
- npm or yarn
- A running PostgreSQL instance (either local or cloud-hosted like Google Cloud SQL)

## Environment Variables

Create a `.env.local` file in the root of your project and add the following environment variables. **The application will not start if critical variables like `POSTGRES_URL` and `JWT_SECRET` are missing.**

```env
# PostgreSQL Connection URL (MANDATORY)
# Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
# Example for a local DB: postgresql://youruser:yourpassword@localhost:5432/yourdatabase
# Example for a cloud DB: postgresql://youruser:yourpassword@your-cloud-host.com:5432/yourdatabase
POSTGRES_URL=your_postgresql_connection_string

# Optional: If your PostgreSQL instance requires SSL (common for cloud databases)
# Set to true if SSL is required, e.g., for Google Cloud SQL, AWS RDS, Azure PostgreSQL.
# POSTGRES_SSL=true 

# Secure key for signing user session tokens (JWTs) (MANDATORY)
# This is crucial for production security. The application will not start without it.
# The key MUST be at least 32 characters long.
# You can generate a strong secret with the command: openssl rand -hex 32
JWT_SECRET=your_super_secret_jwt_key_of_at_least_32_chars

# Google Generative AI API Key (if using Genkit features)
GOOGLE_GENAI_API_KEY=your_google_genai_api_key

# Admin Credentials (change these for production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123
```

Replace `your_postgresql_connection_string` with the actual connection string for your PostgreSQL database.
You **must** replace `your_super_secret_jwt_key_of_at_least_32_chars` with a secure, randomly generated string that is at least 32 characters long.
Update `ADMIN_USERNAME` and `ADMIN_PASSWORD` to secure values, especially for production.

**Important Notes for `POSTGRES_URL`:**
- **URL Encoding:** If your username or password contains special characters (e.g., `@`, `#`, `!`, `:`, `/`, `?`, `[`, `]`), they **must be URL-encoded**. For example, if your password is `my@secret#pass`, it should be `my%40secret%23pass` in the connection string.
- **SSL:** For cloud-hosted PostgreSQL (like Google Cloud SQL, AWS RDS, Azure Database for PostgreSQL), you will likely need to enable SSL. Set `POSTGRES_SSL=true` in your `.env.local` file if your provider requires it. For Google Cloud SQL, SSL is generally recommended.

## Getting Started

1.  **Install Dependencies:**
    Open your terminal and navigate to the project directory. Then run:
    ```bash
    npm install
    # or
    # yarn install
    ```

2.  **Set Up Environment Variables:**
    Create or update the `.env.local` file as described above with your PostgreSQL connection string and a secure `JWT_SECRET`.

3.  **Initialize Database Schema:**
    The application will attempt to create the necessary tables in your PostgreSQL database on startup if they don't already exist. Ensure your PostgreSQL server is running and accessible using the `POSTGRES_URL` you provided.

4.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    This will start the Next.js development server, typically on `http://localhost:9002`.
    **Important:** If you created or modified the `.env.local` file, you **must restart** the development server for the changes to take effect.

5.  **Access the Application:**
    Open your web browser and go to `http://localhost:9002` to see the application.
    The admin panel can be accessed at `http://localhost:9002/admin/login` using the credentials defined in your `.env.local` file.

## Key Technologies

- **Frontend:** Next.js (React)
- **Backend:** Next.js (API Routes / Server Actions)
- **Database:** PostgreSQL
- **Styling:** Tailwind CSS, ShadCN UI
- **AI Integration (Optional):** Genkit with Google AI

## Troubleshooting

### PostgreSQL Connection Errors (e.g., `ECONNREFUSED 127.0.0.1:5432`)

This error means the application tried to connect to a PostgreSQL server at `127.0.0.1` (localhost) on port `5432` but failed.

- **Check `.env.local`:**
    - Ensure the `POSTGRES_URL` is correctly set and points to your intended PostgreSQL server (local or remote).
    - **Verify URL Encoding:** If your password or username in `POSTGRES_URL` contains special characters (like `@`, `#`, `!`), they must be URL-encoded. For example, `@` becomes `%40`, `#` becomes `%23`.
      Incorrect: `postgresql://user:pass@word@host:port/db`
      Correct: `postgresql://user:pass%40word@host:port/db`
- **Restart Dev Server:** After any changes to `.env.local`, **stop and restart** your Next.js development server (`npm run dev`).
- **SSL Configuration:** If connecting to a cloud database (like Google Cloud SQL), you might need SSL. Add `POSTGRES_SSL=true` to your `.env.local` file.
- **Firewall Rules (for remote DBs):** If connecting to a remote database (e.g., on Google Cloud SQL), ensure its firewall rules allow incoming connections from your IP address (your local machine's public IP for development, or your deployment server's IP).
- **Local PostgreSQL Server:** If you intend to use a local PostgreSQL server:
    - Ensure it's installed and running.
    - Verify it's configured to listen on `127.0.0.1` (or `localhost`) and port `5432`.
    - Check if your local firewall is blocking connections.
- **Database/User Existence:** Ensure the database and user specified in your `POSTGRES_URL` exist and the user has the necessary permissions.

## Data Migration (If applicable)

If you were previously using SQLite or another database and have existing data, you will need to manually migrate that data to your new PostgreSQL database. This process is outside the scope of this application's codebase and typically involves:
1. Exporting data from the old database (e.g., to CSV or SQL dump).
2. Transforming the data/schema if necessary to match PostgreSQL.
3. Importing the data into your PostgreSQL instance.
Tools like `pgloader` or custom scripts can be helpful for this.

To get started, take a look at `src/app/page.tsx`.

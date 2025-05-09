# Firebase Studio (LocalPulse)

This is a NextJS starter application, now configured to use PostgreSQL as its database.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or later recommended)
- npm or yarn
- A running PostgreSQL instance

## Environment Variables

Create a `.env.local` file in the root of your project and add the following environment variables:

```env
# PostgreSQL Connection URL
# Example: postgresql://youruser:yourpassword@yourhost:yourport/yourdatabase
POSTGRES_URL=your_postgresql_connection_string

# Optional: If your PostgreSQL instance requires SSL
# POSTGRES_SSL=true 

# Google Generative AI API Key (if using Genkit features)
GOOGLE_GENAI_API_KEY=your_google_genai_api_key

# Admin Credentials (change these for production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123
```

Replace `your_postgresql_connection_string` with the actual connection string for your PostgreSQL database.
Update `ADMIN_USERNAME` and `ADMIN_PASSWORD` to secure values, especially for production.

## Getting Started

1.  **Install Dependencies:**
    Open your terminal and navigate to the project directory. Then run:
    ```bash
    npm install
    # or
    # yarn install
    ```

2.  **Initialize Database Schema:**
    The application will attempt to create the necessary tables in your PostgreSQL database on startup if they don't already exist. Ensure your PostgreSQL server is running and accessible using the `POSTGRES_URL` you provided.

3.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    This will start the Next.js development server, typically on `http://localhost:9002`.

4.  **Access the Application:**
    Open your web browser and go to `http://localhost:9002` to see the application.
    The admin panel can be accessed at `http://localhost:9002/admin/login` using the credentials defined in your `.env.local` file.

## Key Technologies

- **Frontend:** Next.js (React)
- **Backend:** Next.js (API Routes / Server Actions)
- **Database:** PostgreSQL
- **Styling:** Tailwind CSS, ShadCN UI
- **AI Integration (Optional):** Genkit with Google AI

## Data Migration (If applicable)

If you were previously using SQLite and have existing data, you will need to manually migrate that data to your new PostgreSQL database. This process is outside the scope of this application's codebase and typically involves:
1. Exporting data from SQLite (e.g., to CSV or SQL dump).
2. Transforming the data/schema if necessary to match PostgreSQL.
3. Importing the data into your PostgreSQL instance.
Tools like `pgloader` or custom scripts can be helpful for this.

To get started, take a look at `src/app/page.tsx`.

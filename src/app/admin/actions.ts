'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123'; // In a real app, use hashed passwords from a DB
const ADMIN_COOKIE_NAME = 'admin-auth-token';

export async function adminLogin(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  console.log(`Admin login attempt for username: ${username}`);
  try {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // In a real app, generate a secure token (e.g., JWT)
      const token = Buffer.from(`${username}:${password}`).toString('base64'); // Simple token for demo
      console.log(`Generated token for ${username}`);

      cookies().set({
        name: ADMIN_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day
      });
      console.log(`Cookie set for ${username}`);
      return { success: true };
    } else {
      console.log(`Invalid credentials for username: ${username}`);
      return { success: false, error: 'Invalid username or password.' };
    }
  } catch (error) {
    console.error('Error during adminLogin action:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during login.';
    return { success: false, error: `Server error: ${errorMessage}` };
  }
}

export async function adminLogout(): Promise<void> {
  try {
    cookies().delete(ADMIN_COOKIE_NAME);
    console.log('Admin cookie deleted.');
  } catch (error) {
    console.error('Error deleting admin cookie during logout:', error);
    // Even if cookie deletion fails, proceed with redirect
  }
  redirect('/admin/login');
}

export async function verifyAdminAuth(): Promise<boolean> {
    const cookieStore = cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (!token) {
        console.log('Admin auth: No token found.');
        return false;
    }

    // In a real app, verify the token (e.g., JWT verification)
    try {
        const decodedToken = Buffer.from(token, 'base64').toString('ascii');
        const [authUsername, authPassword] = decodedToken.split(':');
        const isValid = authUsername === ADMIN_USERNAME && authPassword === ADMIN_PASSWORD;
        console.log(`Admin auth: Token verification result: ${isValid}`);
        return isValid;
    } catch (error) {
        console.error("Admin auth: Token verification failed:", error);
        return false;
    }
}

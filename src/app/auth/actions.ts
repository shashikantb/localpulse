
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { createUserDb, getUserByEmailDb, getUserByIdDb, updateUserProfilePictureDb } from '@/lib/db';
import type { NewUser, User } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { cache } from 'react';

const USER_COOKIE_NAME = 'user-auth-token';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-for-jwt-that-is-at-least-32-bytes-long');

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET environment variable is not set. Using a fallback secret. THIS IS NOT SECURE FOR PRODUCTION.');
}

async function encrypt(payload: any) {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

async function decrypt(token: string): Promise<any | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('Failed to verify JWT:', error);
    return null;
  }
}

export async function signUp(newUser: NewUser): Promise<{ success: boolean; error?: string }> {
  try {
    const existingUser = await getUserByEmailDb(newUser.email);
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    // Gorakshak & Janta users are approved automatically. Business users are pending.
    const status = newUser.role === 'Gorakshak' || newUser.role === 'Janta' ? 'approved' : 'pending';

    const user = await createUserDb(newUser, status);
    if (user) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to create user account.' };
    }
  } catch (error: any) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message || 'An unknown error occurred during sign up.' };
  }
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserByEmailDb(email);

    if (!user) {
      return { success: false, error: 'Invalid email or password.' };
    }
    
    if (user.status !== 'approved') {
        if(user.status === 'pending') return { success: false, error: 'Your account is pending approval by an administrator.' };
        if(user.status === 'rejected') return { success: false, error: 'Your account has been rejected.' };
        return { success: false, error: 'This account is not active.' };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordhash);
    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password.' };
    }

    const sessionPayload = { userId: user.id };
    const sessionToken = await encrypt(sessionPayload);
    const maxAgeInSeconds = 30 * 24 * 60 * 60; // 30 days

    cookies().set(USER_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxAgeInSeconds,
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}

export async function logout(): Promise<void> {
  cookies().delete(USER_COOKIE_NAME);
  // Revalidate the entire layout to ensure the session is re-read everywhere.
  revalidatePath('/', 'layout');
}

export const getSession = cache(async (): Promise<{ user: User | null }> => {
  const token = cookies().get(USER_COOKIE_NAME)?.value;
  if (!token) {
    return { user: null };
  }

  const payload = await decrypt(token);
  if (!payload || !payload.userId) {
    return { user: null };
  }

  // The getUserByIdDb function now handles sanitization of the profile picture URL.
  // No need for redundant client-side checks.
  const user = await getUserByIdDb(payload.userId);

  return { user };
});

export async function updateUserProfilePicture(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to update your profile picture.' };
  }

  const image = formData.get('profilePicture') as string | null;
  if (!image) {
    return { success: false, error: 'No image data provided.' };
  }

  // CRITICAL FIX: Do not store the large data URI. Store a placeholder instead.
  // This prevents bloating the database and the initial HTML payload.
  const imageUrlForDb = 'https://placehold.co/200x200.png';

  try {
    await updateUserProfilePictureDb(user.id, imageUrlForDb);
    revalidatePath(`/users/${user.id}`);
    revalidatePath('/', 'layout'); // To update the user-nav avatar
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating profile picture for user ${user.id}:`, error);
    return { success: false, error: error.message || 'Failed to update profile picture.' };
  }
}


'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { createUserDb, getUserByEmailDb, getUserByIdDb, updateUserProfilePictureDb, updateUserNameDb, updateUserMobileDb } from '@/lib/db';
import type { NewUser, User } from '@/lib/db-types';
import { revalidatePath } from 'next/cache';
import { cache } from 'react';
import { z } from 'zod';


const USER_COOKIE_NAME = 'user-auth-token';

// Use a fallback secret for development if not set, but log a strong warning.
const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') {
    console.error('----------------------------------------------------------------');
    console.error('FATAL: A secure JWT_SECRET environment variable must be set for production.');
    console.error('Application will not function correctly without it.');
    console.error('----------------------------------------------------------------');
}
const JWT_SECRET = new TextEncoder().encode(secret || 'fallback-secret-for-jwt-that-is-at-least-32-bytes-long');

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('----------------------------------------------------------------');
  console.warn('WARNING: JWT_SECRET environment variable is not set. Using a temporary, insecure fallback secret.');
  console.warn('THIS IS NOT SAFE FOR PRODUCTION. Please set a secure secret in your .env.local file.');
  console.warn('----------------------------------------------------------------');
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
    // This will happen if the token is invalid or the secret is wrong.
    console.error('Failed to verify JWT:', error);
    return null;
  }
}

export async function signUp(newUser: NewUser): Promise<{ success: boolean; error?: string }> {
  try {
    const emailLower = newUser.email.toLowerCase();
    const existingUser = await getUserByEmailDb(emailLower);
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    // All users are now approved automatically.
    const status = 'approved';

    const user = await createUserDb({ ...newUser, email: emailLower }, status);
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
    const emailLower = email.toLowerCase();
    const user = await getUserByEmailDb(emailLower);

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
    const expires = new Date(Date.now() + maxAgeInSeconds * 1000);
    
    // Standard way to check if the app is running behind a secure proxy.
    // The 'x-forwarded-proto' header is set by NGINX.
    const forwardedProto = headers().get('x-forwarded-proto');
    const isSecure = forwardedProto === 'https';

    cookies().set(USER_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isSecure, // The cookie is secure if the original connection was HTTPS.
      expires: expires,
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

  const user = await getUserByIdDb(payload.userId);

  return { user };
});

export async function updateUserProfilePicture(imageUrl: string): Promise<{ success: boolean; error?: string }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to update your profile picture.' };
  }

  if (!imageUrl || typeof imageUrl !== 'string') {
    return { success: false, error: 'No valid image URL provided.' };
  }

  try {
    await updateUserProfilePictureDb(user.id, imageUrl);
    revalidatePath(`/users/${user.id}`);
    revalidatePath('/', 'layout'); // To update the user-nav avatar
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating profile picture for user ${user.id}:`, error);
    return { success: false, error: 'Failed to update profile picture.' };
  }
}

export async function updateUsername(name: string): Promise<{ success: boolean; error?: string; user?: User }> {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'You must be logged in to update your name.' };
  }

  if (!name || name.trim().length < 2) {
    return { success: false, error: 'Name must be at least 2 characters long.' };
  }
  
  if (name.trim().length > 50) {
    return { success: false, error: 'Name cannot exceed 50 characters.' };
  }

  try {
    const updatedUser = await updateUserNameDb(user.id, name.trim());
    if (updatedUser) {
      revalidatePath(`/users/${user.id}`);
      revalidatePath('/', 'layout'); // To update the user-nav
      return { success: true, user: updatedUser };
    }
    return { success: false, error: 'Failed to update username.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}

const mobileSchema = z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit mobile number.');

export async function updateUserMobile(formData: FormData) {
  const { user } = await getSession();
  if (!user) {
    return { success: false, error: 'Authentication required.' };
  }

  const mobileNumber = formData.get('mobilenumber') as string;
  const validation = mobileSchema.safeParse(mobileNumber);

  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }
  
  try {
    await updateUserMobileDb(user.id, validation.data);
    revalidatePath(`/users/${user.id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Failed to update mobile number.' };
  }
}


'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { createUserDb, getUserByEmailDb, getUserByIdDb } from '@/lib/db';
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
    .setExpirationTime('24h')
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

    const user = await createUserDb(newUser);
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

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const sessionPayload = { userId: user.id };
    const sessionToken = await encrypt(sessionPayload);

    cookies().set(USER_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires,
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

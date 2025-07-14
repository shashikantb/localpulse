
// src/app/api/actions/register-token-from-sw/route.ts
import { NextResponse } from 'next/server';
import { registerDeviceToken } from '@/app/actions';

// This is a simple API route wrapper that allows the service worker
// to call a server action, since service workers cannot call them directly.
export async function POST(request: Request) {
  try {
    const { token, latitude, longitude } = await request.json();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    const result = await registerDeviceToken(token, latitude, longitude);
    
    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

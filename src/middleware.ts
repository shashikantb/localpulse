
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin-auth-token';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';


async function verifyToken(token: string): Promise<boolean> {
    // In a real app, this would involve JWT verification or a session check against a database.
    // For this demo, we decode the simple base64 token.
    try {
        const decodedToken = Buffer.from(token, 'base64').toString('ascii');
        const [username, password] = decodedToken.split(':');
        return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
    } catch (error) {
        console.error("Token verification failed in middleware:", error);
        return false;
    }
}


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const tokenCookie = request.cookies.get(ADMIN_COOKIE_NAME);

    if (!tokenCookie || !(await verifyToken(tokenCookie.value))) {
      const loginUrl = new URL('/admin/login', request.url);
      // If there was a page they were trying to access, redirect them back after login
      if (pathname !== '/admin') {
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

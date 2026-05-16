import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Jika sudah login, dilarang ke halaman auth
  if (token && (pathname === '/login' || pathname === '/signup' || pathname === '/verify-otp')) {
    // Biarkan halaman login/dashboard yang menentukan arah spesifiknya
    return NextResponse.next(); 
  }

  // Jika BELUM login, dilarang masuk ke area terproteksi
  if (!token && (pathname.startsWith('/teacher') || pathname.startsWith('/student'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/teacher/:path*', '/student/:path*', '/login', '/signup', '/verify-otp'],
};
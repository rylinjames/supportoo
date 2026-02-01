/**
 * CSRF Protection Utilities
 * 
 * Provides CSRF token generation and validation for API routes.
 * Uses double-submit cookie pattern for stateless CSRF protection.
 */

import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;
const TOKEN_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token in HTTP-only cookie
 */
export async function setCSRFCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
}

/**
 * Get CSRF token from cookie
 */
export async function getCSRFFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Validate CSRF token from request
 * Compares header token with cookie token (double-submit pattern)
 */
export async function validateCSRFToken(request: Request): Promise<boolean> {
  // Skip CSRF for webhook endpoints (they use signature validation)
  if (request.url.includes('/api/webhooks/')) {
    return true;
  }

  // Skip for GET requests (should be idempotent)
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    console.warn('CSRF validation failed: No token in header');
    return false;
  }

  // Get token from cookie
  const cookieToken = await getCSRFFromCookie();
  if (!cookieToken) {
    console.warn('CSRF validation failed: No token in cookie');
    return false;
  }

  // Compare tokens (constant-time comparison to prevent timing attacks)
  const valid = crypto.timingSafeEqual(
    Buffer.from(headerToken),
    Buffer.from(cookieToken)
  );

  if (!valid) {
    console.warn('CSRF validation failed: Token mismatch');
  }

  return valid;
}

/**
 * CSRF middleware for API routes
 * Returns 403 Forbidden if CSRF validation fails
 */
export async function csrfMiddleware(request: Request): Promise<Response | null> {
  const valid = await validateCSRFToken(request);
  
  if (!valid) {
    return new Response(
      JSON.stringify({ error: 'Invalid CSRF token' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null; // Continue processing
}

/**
 * Get or create CSRF token for current session
 */
export async function getOrCreateCSRFToken(): Promise<string> {
  let token = await getCSRFFromCookie();
  
  if (!token) {
    token = generateCSRFToken();
    await setCSRFCookie(token);
  }
  
  return token;
}
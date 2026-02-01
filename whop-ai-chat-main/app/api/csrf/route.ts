/**
 * CSRF Token Endpoint
 * 
 * Provides CSRF tokens to the frontend for API requests.
 */

import { NextResponse } from 'next/server';
import { getOrCreateCSRFToken } from '@/app/lib/csrf';

export async function GET() {
  try {
    const token = await getOrCreateCSRFToken();
    
    return NextResponse.json(
      { token },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Failed to generate CSRF token:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
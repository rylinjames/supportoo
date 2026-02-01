/**
 * CSRF Token Hook
 * 
 * Provides CSRF token management for frontend API calls.
 */

import { useState, useEffect } from 'react';

export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);

  useEffect(() => {
    // Get CSRF token on mount
    fetchCSRFToken();
  }, []);

  const fetchCSRFToken = async () => {
    try {
      const response = await fetch('/api/csrf');
      if (response.ok) {
        const data = await response.json();
        setCSRFToken(data.token);
      }
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
  };

  /**
   * Add CSRF header to fetch options
   */
  const addCSRFHeader = (options: RequestInit = {}): RequestInit => {
    if (!csrfToken) return options;

    return {
      ...options,
      headers: {
        ...options.headers,
        'x-csrf-token': csrfToken,
      },
    };
  };

  return { csrfToken, addCSRFHeader, refreshToken: fetchCSRFToken };
}
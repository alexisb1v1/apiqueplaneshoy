import { CookieOptions } from 'express';

export const REFRESH_TOKEN_COOKIE_NAME = 'qph_refresh_token';

export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días en milisegundos
};


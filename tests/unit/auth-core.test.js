import { createHash } from 'node:crypto';
import { hexOf, accountView, deletedAnswer } from '../../core/auth-core.js';

const player = (metadata) => ({ user: { email: 'pat@example.com', user_metadata: metadata } });

describe('auth-core.js', () => {
  test('a fingerprint is its bytes as lower-case hex, two digits each, small bytes zero-padded', () => {
    expect(hexOf(new Uint8Array([0, 1, 15, 16, 171, 255]).buffer)).toBe('00010f10abff');
    expect(hexOf(new ArrayBuffer(0))).toBe('');
  });

  test('a one-time word\'s fingerprint is the one Supabase checks: SHA-256 in hex', async () => {
    const word = 'one-time-word';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(word));
    expect(hexOf(digest)).toBe(createHash('sha256').update(word).digest('hex'));
  });

  test('signed out, the site bar shows Sign in and no one', () => {
    expect(accountView(null)).toEqual({ signedIn: false, picture: '', initial: '', email: '' });
  });

  test('signed in, the site bar shows the player\'s Google picture and email', () => {
    expect(accountView(player({ full_name: 'Pat Player', avatar_url: 'https://lh3.example/pat.png' }))).toEqual({
      signedIn: true, picture: 'https://lh3.example/pat.png', initial: 'P', email: 'pat@example.com',
    });
  });

  test('with no picture from Google, the player\'s initial stands in, from their name', () => {
    expect(accountView(player({ full_name: 'élodie Grew' }))).toEqual({
      signedIn: true, picture: '', initial: 'É', email: 'pat@example.com',
    });
  });

  test('with no name from Google either, the initial is their email\'s', () => {
    expect(accountView(player({})).initial).toBe('P');
    expect(accountView({ user: { email: 'zed@example.com', user_metadata: { full_name: '' } } }).initial).toBe('Z');
  });

  test('an account is deleted when the database answers without an error', () => {
    expect(deletedAnswer({ data: null, error: null, status: 204 })).toBe(true);
  });

  test('any refusal leaves the account where it was', () => {
    expect(deletedAnswer({ data: null, error: { message: 'Failed to fetch' }, status: 0 })).toBe(false);
    expect(deletedAnswer({ data: null, error: { code: '42501', message: 'permission denied' }, status: 403 })).toBe(false);
  });
});

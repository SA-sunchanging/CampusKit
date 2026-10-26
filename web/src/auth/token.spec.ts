import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeToken, MemoryStorage } from '../test/memory-storage.ts';
import {
  decodeToken,
  expireSession,
  getToken,
  onSessionExpired,
  setToken,
  storeToken,
  subscribeToken,
  TOKEN_KEY,
} from './token.ts';

const NOW = Date.UTC(2026, 9, 26);
const LATER = NOW / 1000 + 3600;

describe('decodeToken', () => {
  it('reads the id, role, and expiry of a valid token', () => {
    const token = fakeToken({ sub: 'u1', role: 'student', exp: LATER });
    expect(decodeToken(token, NOW)).toEqual({
      id: 'u1',
      role: 'student',
      expiresAt: LATER * 1000,
    });
  });

  it('accepts the admin role', () => {
    const token = fakeToken({ sub: 'a1', role: 'admin', exp: LATER });
    expect(decodeToken(token, NOW)?.role).toBe('admin');
  });

  it('treats an expired token as logged out', () => {
    const token = fakeToken({ sub: 'u1', role: 'student', exp: NOW / 1000 });
    expect(decodeToken(token, NOW)).toBeNull();
  });

  it('treats an unknown role as logged out', () => {
    const token = fakeToken({ sub: 'u1', role: 'owner', exp: LATER });
    expect(decodeToken(token, NOW)).toBeNull();
  });

  it('treats missing claims as logged out', () => {
    expect(decodeToken(fakeToken({ role: 'student', exp: LATER }), NOW)).toBe(
      null,
    );
    expect(decodeToken(fakeToken({ sub: 'u1', role: 'student' }), NOW)).toBe(
      null,
    );
  });

  it.each(['', 'not-a-token', 'a.b', 'a.%%%.c', 'a.bm90IGpzb24.c'])(
    'treats the malformed token %j as logged out',
    (token) => {
      expect(decodeToken(token, NOW)).toBeNull();
    },
  );
});

describe('token storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores and deletes the token under one key', () => {
    setToken('abc');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc');
    expect(getToken()).toBe('abc');
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it('storeToken keeps a valid token and returns its session', () => {
    const token = fakeToken({
      sub: 'u1',
      role: 'student',
      exp: Date.now() / 1000 + 3600,
    });
    expect(storeToken(token).id).toBe('u1');
    expect(getToken()).toBe(token);
  });

  it('storeToken rejects an unusable token and stores nothing', () => {
    expect(() => storeToken('not-a-token')).toThrow('unusable token');
    expect(getToken()).toBeNull();
  });

  it('notifies subscribers on every change until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToken(listener);
    setToken('abc');
    setToken(null);
    unsubscribe();
    setToken('def');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('expireSession clears the token and reports the expiry', () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    setToken('abc');
    expireSession();
    unsubscribe();
    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });
});

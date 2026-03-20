import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';

// ── Backend response shapes ───────────────────────────────────────────────────
// POST /api/login and POST /api/signup both return:
//   { "token": "...", "user": { "id": 1, "username": "...", "email": "..." } }
// Error responses return:
//   { "error": "..." }

function mockFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    // Suppress any unexpected console.error output
    vi.spyOn(console, 'error').mockImplementation(() => {});

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ── isLoggedIn ───────────────────────────────────────────────────────────

  it('isLoggedIn returns false when no user is set', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  // ── login() ──────────────────────────────────────────────────────────────

  it('login() sets currentUser and stores JWT token on success', async () => {
    // Matches exact backend response: handleLogin → writeJSON(200, { token, user })
    globalThis.fetch = mockFetch({
      token: 'eyJhbGciOiJIUzI1NiJ9.test',
      user: { id: 1, username: 'GatorFan', email: 'fan@ufl.edu' },
    });

    await service.login('fan@ufl.edu', 'Password1');

    expect(service.currentUser()).not.toBeNull();
    expect(service.currentUser()?.username).toBe('GatorFan');
    expect(service.currentUser()?.email).toBe('fan@ufl.edu');
    expect(service.currentUser()?.id).toBe('1'); // String(data.user.id)
    expect(service.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('token')).toBe('eyJhbGciOiJIUzI1NiJ9.test');
  });

  it('login() throws when backend returns 401 Unauthorized', async () => {
    // Matches: writeJSON(401, { "error": "Invalid email or password" })
    globalThis.fetch = mockFetch({ error: 'Invalid email or password' }, false);

    await expect(service.login('bad@ufl.edu', 'wrongpass')).rejects.toThrow(
      'Invalid email or password'
    );
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  // ── signup() ─────────────────────────────────────────────────────────────

  it('signup() sets currentUser on successful registration', async () => {
    // Matches: handleSignup → writeJSON(201, { token, user })
    globalThis.fetch = mockFetch({
      token: 'newuser-jwt-token',
      user: { id: 5, username: 'NewGator', email: 'new@ufl.edu' },
    });

    await service.signup('NewGator', 'new@ufl.edu', 'Password1', 'Password1');

    expect(service.currentUser()?.username).toBe('NewGator');
    expect(service.currentUser()?.id).toBe('5');
    expect(service.isLoggedIn()).toBe(true);
    expect(localStorage.getItem('token')).toBe('newuser-jwt-token');
  });

  it('signup() throws when backend returns 409 Conflict (duplicate email)', async () => {
    // Matches: writeJSON(409, { "error": "Username or email already exists" })
    globalThis.fetch = mockFetch({ error: 'Username or email already exists' }, false);

    await expect(
      service.signup('Dup', 'dup@ufl.edu', 'Password1', 'Password1')
    ).rejects.toThrow('Username or email already exists');
  });

  // ── updateProfile() ──────────────────────────────────────────────────────

  it('updateProfile() merges new fields into the existing user without touching other fields', async () => {
    globalThis.fetch = mockFetch({
      token: 'tok',
      user: { id: 3, username: 'Original', email: 'orig@ufl.edu' },
    });
    await service.login('orig@ufl.edu', 'pass');

    service.updateProfile({ username: 'Updated', role: 'Faculty' });

    expect(service.currentUser()?.username).toBe('Updated');
    expect(service.currentUser()?.role).toBe('Faculty');
    expect(service.currentUser()?.email).toBe('orig@ufl.edu'); // unchanged
  });

  // ── logout() ─────────────────────────────────────────────────────────────

  it('logout() clears currentUser and removes JWT from localStorage', async () => {
    globalThis.fetch = mockFetch({
      token: 'valid-token',
      user: { id: 4, username: 'Bye', email: 'bye@ufl.edu' },
    });
    await service.login('bye@ufl.edu', 'pass');
    expect(service.isLoggedIn()).toBe(true);

    service.logout();

    expect(service.currentUser()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });
});

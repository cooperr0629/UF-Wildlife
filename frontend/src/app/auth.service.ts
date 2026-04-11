import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  joinDate: string;
  avatarUrl: string | null;
}

interface AuthResponse {
  token: string;
  user: { id: number; username: string; email: string };
}

interface ErrorResponse {
  error: string;
}

const API_BASE = 'http://localhost:8080/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private _currentUser = signal<User | null>(this.restoreUser());
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  private restoreUser(): User | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private persistUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err: ErrorResponse = await res.json();
      throw new Error(err.error || 'Login failed');
    }

    const data: AuthResponse = await res.json();
    localStorage.setItem('token', data.token);

    const user: User = {
      id: String(data.user.id),
      username: data.user.username,
      email: data.user.email,
      role: 'Student',
      joinDate: new Date().toISOString().split('T')[0],
      avatarUrl: null,
    };
    this._currentUser.set(user);
    this.persistUser(user);
  }

  async signup(
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, confirmPassword }),
    });

    if (!res.ok) {
      const err: ErrorResponse = await res.json();
      throw new Error(err.error || 'Signup failed');
    }

    const data: AuthResponse = await res.json();
    localStorage.setItem('token', data.token);

    const user: User = {
      id: String(data.user.id),
      username: data.user.username,
      email: data.user.email,
      role: 'Student',
      joinDate: new Date().toISOString().split('T')[0],
      avatarUrl: null,
    };
    this._currentUser.set(user);
    this.persistUser(user);
  }

  updateProfile(fields: Partial<User>) {
    const current = this._currentUser();
    if (!current) return;
    const updated = { ...current, ...fields };
    this._currentUser.set(updated);
    this.persistUser(updated);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }
}

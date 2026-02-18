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

  private _currentUser = signal<User | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

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

    this._currentUser.set({
      id: String(data.user.id),
      username: data.user.username,
      email: data.user.email,
      role: 'Student',
      joinDate: new Date().toISOString().split('T')[0],
      avatarUrl: null,
    });
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

    this._currentUser.set({
      id: String(data.user.id),
      username: data.user.username,
      email: data.user.email,
      role: 'Student',
      joinDate: new Date().toISOString().split('T')[0],
      avatarUrl: null,
    });
  }

  updateProfile(fields: Partial<User>) {
    const current = this._currentUser();
    if (!current) return;
    this._currentUser.set({ ...current, ...fields });
  }

  logout() {
    localStorage.removeItem('token');
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }
}

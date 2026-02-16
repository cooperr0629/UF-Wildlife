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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private _currentUser = signal<User | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  login(email: string, _password: string) {
    const user: User = {
      id: crypto.randomUUID(),
      username: email.split('@')[0],
      email,
      role: 'Student',
      joinDate: new Date().toISOString().split('T')[0],
      avatarUrl: null,
    };
    this._currentUser.set(user);
  }

  signup(username: string, email: string) {
    const user: User = {
      id: crypto.randomUUID(),
      username,
      email,
      role: 'Student',
      joinDate: new Date().toISOString().split('T')[0],
      avatarUrl: null,
    };
    this._currentUser.set(user);
  }

  updateProfile(fields: Partial<User>) {
    const current = this._currentUser();
    if (!current) return;
    this._currentUser.set({ ...current, ...fields });
  }

  logout() {
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }
}

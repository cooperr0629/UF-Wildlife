import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoginComponent } from './login';
import { AuthService } from '../auth.service';

// ── Stubs ────────────────────────────────────────────────────────────────────
const authServiceStub = {
  login: vi.fn().mockResolvedValue(undefined),
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let router: Router;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (authServiceStub.login as ReturnType<typeof vi.fn>)
      .mockClear()
      .mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('initializes with empty fields and no error', () => {
    expect(component.email()).toBe('');
    expect(component.password()).toBe('');
    expect(component.errorMessage()).toBe('');
    expect(component.isLoading()).toBe(false);
    expect(component.showPassword()).toBe(false);
  });

  // ── onSubmit() validation ─────────────────────────────────────────────────

  it('onSubmit() sets error when email is empty', async () => {
    component.password.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Please enter your email address.');
    expect(authServiceStub.login).not.toHaveBeenCalled();
  });

  it('onSubmit() sets error when email is invalid', async () => {
    component.email.set('not-an-email');
    component.password.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Please enter a valid email address.');
    expect(authServiceStub.login).not.toHaveBeenCalled();
  });

  it('onSubmit() sets error when password is empty', async () => {
    component.email.set('user@ufl.edu');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Please enter your password.');
    expect(authServiceStub.login).not.toHaveBeenCalled();
  });

  it('onSubmit() trims email before validating', async () => {
    component.email.set('  user@ufl.edu  ');
    component.password.set('Password1');
    await component.onSubmit();
    expect(authServiceStub.login).toHaveBeenCalledWith('user@ufl.edu', 'Password1');
  });

  // ── onSubmit() success ────────────────────────────────────────────────────

  it('onSubmit() calls authService.login with email and password', async () => {
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    await component.onSubmit();
    expect(authServiceStub.login).toHaveBeenCalledWith('user@ufl.edu', 'Password1');
  });

  it('onSubmit() navigates to /home on success', async () => {
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    await component.onSubmit();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('onSubmit() clears errorMessage on a valid submission', async () => {
    component.errorMessage.set('previous error');
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('');
  });

  it('onSubmit() resets isLoading to false after success', async () => {
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    await component.onSubmit();
    expect(component.isLoading()).toBe(false);
  });

  // ── onSubmit() error path ─────────────────────────────────────────────────

  it('onSubmit() shows error message from rejected login', async () => {
    (authServiceStub.login as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Invalid email or password')
    );
    component.email.set('user@ufl.edu');
    component.password.set('wrongpass');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Invalid email or password');
    expect(component.isLoading()).toBe(false);
  });

  it('onSubmit() falls back to generic message when error has no message', async () => {
    (authServiceStub.login as ReturnType<typeof vi.fn>).mockRejectedValue({});
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Login failed. Please try again.');
  });

  it('onSubmit() does not navigate when login fails', async () => {
    (authServiceStub.login as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('bad')
    );
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    await component.onSubmit();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

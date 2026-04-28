import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignupComponent } from './signup';
import { AuthService } from '../auth.service';

const authServiceStub = {
  signup: vi.fn().mockResolvedValue(undefined),
};

describe('SignupComponent', () => {
  let component: SignupComponent;
  let router: Router;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (authServiceStub.signup as ReturnType<typeof vi.fn>)
      .mockClear()
      .mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SignupComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial state ────────────────────────────────────────────────────────

  it('initializes with empty fields and no error', () => {
    expect(component.username()).toBe('');
    expect(component.email()).toBe('');
    expect(component.password()).toBe('');
    expect(component.confirmPassword()).toBe('');
    expect(component.errorMessage()).toBe('');
    expect(component.isLoading()).toBe(false);
  });

  // ── passwordChecks getter ────────────────────────────────────────────────

  it('passwordChecks reports all false for empty password', () => {
    component.password.set('');
    const c = component.passwordChecks;
    expect(c.minLength).toBe(false);
    expect(c.hasLower).toBe(false);
    expect(c.hasUpper).toBe(false);
    expect(c.hasNumber).toBe(false);
  });

  it('passwordChecks reports true for each requirement met', () => {
    component.password.set('Password1');
    const c = component.passwordChecks;
    expect(c.minLength).toBe(true);
    expect(c.hasLower).toBe(true);
    expect(c.hasUpper).toBe(true);
    expect(c.hasNumber).toBe(true);
  });

  it('passwordChecks reports minLength false for short passwords', () => {
    component.password.set('Pa1');
    expect(component.passwordChecks.minLength).toBe(false);
  });

  // ── isPasswordValid getter ───────────────────────────────────────────────

  it('isPasswordValid is true for a fully valid password', () => {
    component.password.set('Password1');
    expect(component.isPasswordValid).toBe(true);
  });

  it('isPasswordValid is false when missing a number', () => {
    component.password.set('Password');
    expect(component.isPasswordValid).toBe(false);
  });

  it('isPasswordValid is false when missing uppercase', () => {
    component.password.set('password1');
    expect(component.isPasswordValid).toBe(false);
  });

  // ── onSubmit() validation ────────────────────────────────────────────────

  it('onSubmit() sets error when username is empty', async () => {
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    component.confirmPassword.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Please enter a username.');
    expect(authServiceStub.signup).not.toHaveBeenCalled();
  });

  it('onSubmit() sets error when email is empty', async () => {
    component.username.set('NewGator');
    component.password.set('Password1');
    component.confirmPassword.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Please enter your email address.');
  });

  it('onSubmit() sets error for invalid email', async () => {
    component.username.set('NewGator');
    component.email.set('not-an-email');
    component.password.set('Password1');
    component.confirmPassword.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Please enter a valid email address.');
  });

  it('onSubmit() sets error when password requirements are not met', async () => {
    component.username.set('NewGator');
    component.email.set('user@ufl.edu');
    component.password.set('weak');
    component.confirmPassword.set('weak');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Password does not meet all requirements.');
  });

  it('onSubmit() sets error when passwords do not match', async () => {
    component.username.set('NewGator');
    component.email.set('user@ufl.edu');
    component.password.set('Password1');
    component.confirmPassword.set('Password2');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Passwords do not match.');
    expect(authServiceStub.signup).not.toHaveBeenCalled();
  });

  // ── onSubmit() success ───────────────────────────────────────────────────

  it('onSubmit() calls authService.signup with form values', async () => {
    component.username.set('NewGator');
    component.email.set('new@ufl.edu');
    component.password.set('Password1');
    component.confirmPassword.set('Password1');
    await component.onSubmit();
    expect(authServiceStub.signup).toHaveBeenCalledWith(
      'NewGator',
      'new@ufl.edu',
      'Password1',
      'Password1'
    );
  });

  it('onSubmit() navigates to /home on success', async () => {
    component.username.set('NewGator');
    component.email.set('new@ufl.edu');
    component.password.set('Password1');
    component.confirmPassword.set('Password1');
    await component.onSubmit();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  // ── onSubmit() error path ────────────────────────────────────────────────

  it('onSubmit() shows error message from rejected signup', async () => {
    (authServiceStub.signup as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Username or email already exists')
    );
    component.username.set('Dup');
    component.email.set('dup@ufl.edu');
    component.password.set('Password1');
    component.confirmPassword.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Username or email already exists');
    expect(component.isLoading()).toBe(false);
  });

  it('onSubmit() falls back to generic message when error has no message', async () => {
    (authServiceStub.signup as ReturnType<typeof vi.fn>).mockRejectedValue({});
    component.username.set('NewGator');
    component.email.set('new@ufl.edu');
    component.password.set('Password1');
    component.confirmPassword.set('Password1');
    await component.onSubmit();
    expect(component.errorMessage()).toBe('Signup failed. Please try again.');
  });
});

import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class SignupComponent {
  username = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  errorMessage = signal('');
  isLoading = signal(false);

  constructor(private router: Router) {}

  get passwordChecks() {
    const pw = this.password();
    return {
      minLength: pw.length >= 8,
      hasLower: /[a-z]/.test(pw),
      hasUpper: /[A-Z]/.test(pw),
      hasNumber: /[0-9]/.test(pw),
    };
  }

  get isPasswordValid(): boolean {
    const checks = this.passwordChecks;
    return checks.minLength && checks.hasLower && checks.hasUpper && checks.hasNumber;
  }

  onSubmit() {
    const usernameValue = this.username().trim();
    const emailValue = this.email().trim();

    if (!usernameValue) {
      this.errorMessage.set('Please enter a username.');
      return;
    }

    if (!emailValue) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }

    if (!this.isValidEmail(emailValue)) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    if (!this.isPasswordValid) {
      this.errorMessage.set('Password does not meet all requirements.');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.errorMessage.set('');
    this.isLoading.set(true);

    // TODO: Connect to backend registration API
    // For now, simulate registration and redirect to creation page
    setTimeout(() => {
      this.isLoading.set(false);
      this.router.navigate(['/create']);
    }, 1000);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

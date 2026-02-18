import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private authService = inject(AuthService);

  email = signal('');
  password = signal('');
  showPassword = signal(false);
  errorMessage = signal('');
  isLoading = signal(false);

  constructor(private router: Router) {}

  async onSubmit() {
    const emailValue = this.email().trim();
    const passwordValue = this.password();

    if (!emailValue) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }

    if (!this.isValidEmail(emailValue)) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    if (!passwordValue) {
      this.errorMessage.set('Please enter your password.');
      return;
    }

    this.errorMessage.set('');
    this.isLoading.set(true);

    try {
      await this.authService.login(emailValue, passwordValue);
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Login failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

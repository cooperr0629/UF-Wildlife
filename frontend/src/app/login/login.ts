import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  errorMessage = signal('');
  isLoading = signal(false);

  constructor(private router: Router) {}

  onSubmit() {
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

    // TODO: Connect to backend authentication API
    // For now, simulate login and redirect to home
    setTimeout(() => {
      this.isLoading.set(false);
      this.router.navigate(['/home']);
    }, 1000);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

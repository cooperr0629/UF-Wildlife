import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { SignupComponent } from './signup/signup';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  // TODO: Add these routes as pages are built
  // { path: 'home', component: HomeComponent },
  // { path: 'create', component: CreateComponent },
];

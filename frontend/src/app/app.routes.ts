import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { SignupComponent } from './signup/signup';
import { HomeComponent } from './home/home';
import { MapComponent } from './map/map';
import { SpeciesComponent } from './species/species';
import { PhotosComponent } from './photos/photos';
import { ProfileComponent } from './profile/profile';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: 'home',
    component: HomeComponent,
    children: [
      { path: '', redirectTo: 'map', pathMatch: 'full' },
      { path: 'map', component: MapComponent },
      { path: 'species', component: SpeciesComponent },
      { path: 'photos', component: PhotosComponent },
      { path: 'profile', component: ProfileComponent },
    ],
  },
];

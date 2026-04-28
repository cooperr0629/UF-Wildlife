import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a router-outlet for the active child route', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('renders the Map, Species, Photos, and Profile bottom-nav tabs', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(compiled.querySelectorAll('.bottom-bar a.tab')).map(
      (el) => el.textContent?.trim() || ''
    );
    expect(tabs).toHaveLength(4);
    expect(tabs.some((t) => t.includes('Map'))).toBe(true);
    expect(tabs.some((t) => t.includes('Species'))).toBe(true);
    expect(tabs.some((t) => t.includes('Photos'))).toBe(true);
    expect(tabs.some((t) => t.includes('Profile'))).toBe(true);
  });

  it('renders the top-bar header with the UFWildlife branding', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const header = compiled.querySelector('header.top-bar');
    expect(header).not.toBeNull();
    expect(header?.textContent).toContain('Wildlife');
  });
});

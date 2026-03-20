import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MapComponent } from './map';
import { SightingService } from '../sighting.service';
import { AuthService } from '../auth.service';
import { UploadService } from '../upload.service';

// ── Minimal stubs ────────────────────────────────────────────────
const sightingServiceStub = {
  sightings: () => [],
  loadAll: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
};

const authServiceStub = {
  currentUser: () => ({ id: 'u1', username: 'Gator' }),
};

const uploadServiceStub = {
  uploadPhoto: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
};

// ── Suite ────────────────────────────────────────────────────────
describe('MapComponent', () => {
  let component: MapComponent;

  beforeEach(async () => {
    // Block fetch so the service constructor doesn't hit the backend
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        provideRouter([]),
        // Run as server-side so ngAfterViewInit skips Leaflet DOM init
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: SightingService, useValue: sightingServiceStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: UploadService, useValue: uploadServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // toggleHeatmap
  it('toggleHeatmap() flips showHeatmap from false to true', () => {
    expect(component.showHeatmap()).toBe(false);
    component.toggleHeatmap();
    expect(component.showHeatmap()).toBe(true);
  });

  it('toggleHeatmap() flips showHeatmap back to false on second call', () => {
    component.toggleHeatmap();
    component.toggleHeatmap();
    expect(component.showHeatmap()).toBe(false);
  });

  // onCategoryChipClick
  it('onCategoryChipClick() sets category and clears animalName', () => {
    component.onCategoryChipClick('Bird');
    expect(component.sighting().category).toBe('Bird');
    expect(component.sighting().animalName).toBe('');
  });

  it('onCategoryChipClick() switching category resets animalName', () => {
    component.onCategoryChipClick('Mammal');
    component.updateField('animalName', 'Raccoon');
    component.onCategoryChipClick('Bird');
    expect(component.sighting().category).toBe('Bird');
    expect(component.sighting().animalName).toBe('');
  });

  // availableSpecies
  it('availableSpecies returns species list for selected category', () => {
    component.onCategoryChipClick('Bird');
    expect(component.availableSpecies).toContain('Sandhill Crane');
    expect(component.availableSpecies.length).toBeGreaterThan(0);
  });

  it('availableSpecies returns empty array for "Other" category', () => {
    component.onCategoryChipClick('Other');
    expect(component.availableSpecies).toEqual([]);
  });

  // categoryColor
  it('categoryColor() returns the correct color for Bird', () => {
    expect(component.categoryColor('Bird')).toBe('#1E88E5');
  });

  it('categoryColor() falls back to Other color for unknown category', () => {
    expect(component.categoryColor('UnknownCategory')).toBe('#757575');
  });

  // openSightingForm / closeSightingForm
  it('openSightingForm() shows the modal and sets coordinates', () => {
    component.openSightingForm(29.64, -82.35, 'UF Campus');
    expect(component.showSightingForm()).toBe(true);
    expect(component.sighting().latitude).toBe(29.64);
    expect(component.sighting().longitude).toBe(-82.35);
    expect(component.sighting().address).toBe('UF Campus');
  });

  it('closeSightingForm() hides the modal', () => {
    component.openSightingForm(29.64, -82.35, 'UF Campus');
    component.closeSightingForm();
    expect(component.showSightingForm()).toBe(false);
  });

  // updateField
  it('updateField() updates a single field without affecting others', () => {
    component.openSightingForm(29.64, -82.35, 'UF Campus');
    component.updateField('quantity', 5);
    expect(component.sighting().quantity).toBe(5);
    expect(component.sighting().address).toBe('UF Campus'); // unchanged
  });

  // removePhoto
  it('removePhoto() clears photoPreview and photoFile', () => {
    component.photoPreview.set('data:image/png;base64,...');
    component.removePhoto();
    expect(component.photoPreview()).toBeNull();
    expect(component.photoFile()).toBeNull();
  });

  // clearSearch
  it('clearSearch() resets query, results, and search state', () => {
    component.query.set('gator pond');
    component.showResults.set(true);
    component.searchError.set('No results found.');

    component.clearSearch();

    expect(component.query()).toBe('');
    expect(component.showResults()).toBe(false);
    expect(component.searchError()).toBe('');
  });
});

import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PhotosComponent } from './photos';
import { SightingService } from '../sighting.service';

const mockSightings: any[] = [];

const sightingServiceStub = {
  sightings: () => mockSightings,
  groupedByCategory: () => new Map<string, any[]>(),
};

function makeSighting(overrides: any = {}) {
  return {
    id: '1',
    userId: '1',
    username: 'Gator',
    latitude: 29.6436,
    longitude: -82.3549,
    address: 'UF Campus',
    animalName: 'Sandhill Crane',
    category: 'Bird',
    quantity: 2,
    behavior: 'Feeding',
    description: '',
    date: '2025-01-01',
    time: '09:00',
    photoUrl: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

describe('PhotosComponent', () => {
  let component: PhotosComponent;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSightings.length = 0;

    await TestBed.configureTestingModule({
      imports: [PhotosComponent],
      providers: [
        // Run as server so the leaflet effect skips DOM init
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: SightingService, useValue: sightingServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhotosComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.restoreAllMocks();
  });

  // ── isEmpty ──────────────────────────────────────────────────────────────

  it('isEmpty is true when no sightings exist', () => {
    expect(component.isEmpty()).toBe(true);
  });

  it('isEmpty is false when sightings exist', () => {
    mockSightings.push(makeSighting());
    expect(component.isEmpty()).toBe(false);
  });

  // ── selectedSighting ─────────────────────────────────────────────────────

  it('selectCard() sets selectedSighting', () => {
    const s = makeSighting();
    component.selectCard(s);
    expect(component.selectedSighting()).toBe(s);
  });

  it('closeDetail() clears selectedSighting', () => {
    component.selectCard(makeSighting());
    component.closeDetail();
    expect(component.selectedSighting()).toBeNull();
  });

  // ── selectedSpeciesInfo ──────────────────────────────────────────────────

  it('selectedSpeciesInfo returns null when no sighting selected', () => {
    expect(component.selectedSpeciesInfo()).toBeNull();
  });

  it('selectedSpeciesInfo returns metadata for known species', () => {
    component.selectCard(makeSighting({ animalName: 'Sandhill Crane' }));
    const info = component.selectedSpeciesInfo();
    expect(info).not.toBeNull();
    expect(info?.habitat).toBeTruthy();
  });

  it('selectedSpeciesInfo returns null for unknown species', () => {
    component.selectCard(makeSighting({ animalName: 'Unknown Creature' }));
    expect(component.selectedSpeciesInfo()).toBeNull();
  });

  // ── speciesSightings ─────────────────────────────────────────────────────

  it('speciesSightings is empty when no selection', () => {
    expect(component.speciesSightings()).toEqual([]);
  });

  it('speciesSightings returns only sightings of the selected species', () => {
    const a = makeSighting({ id: 'a', animalName: 'Raccoon', category: 'Mammal' });
    const b = makeSighting({ id: 'b', animalName: 'Raccoon', category: 'Mammal' });
    const c = makeSighting({ id: 'c', animalName: 'Osprey', category: 'Bird' });
    mockSightings.push(a, b, c);
    component.selectCard(a);
    const matches = component.speciesSightings();
    expect(matches).toHaveLength(2);
    expect(matches.every((s) => s.animalName === 'Raccoon')).toBe(true);
  });

  // ── color ────────────────────────────────────────────────────────────────

  it('color() returns mapped category color', () => {
    expect(component.color('Bird')).toBe('#1E88E5');
  });

  it('color() falls back to Other color for unknown category', () => {
    expect(component.color('Mythical')).toBe('#757575');
  });
});

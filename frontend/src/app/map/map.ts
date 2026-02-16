import {
  Component,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  effect,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SightingService, Sighting, CATEGORY_COLORS } from '../sighting.service';
import { AuthService } from '../auth.service';
import type * as L from 'leaflet';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface SightingForm {
  latitude: number;
  longitude: number;
  address: string;
  animalName: string;
  category: string;
  quantity: number;
  behavior: string;
  description: string;
  date: string;
  time: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private sightingService = inject(SightingService);
  private authService = inject(AuthService);
  private map: L.Map | null = null;
  private leaflet: typeof L | null = null;
  private searchMarker: L.Marker | null = null;
  private redIcon: L.Icon | null = null;
  private sightingMarkers: L.Marker[] = [];
  private iconCache = new Map<string, L.Icon>();

  query = signal('');
  results = signal<NominatimResult[]>([]);
  showResults = signal(false);
  isSearching = signal(false);
  searchError = signal('');

  // Sighting form
  showSightingForm = signal(false);
  sighting = signal<SightingForm>(this.defaultSighting());
  photoPreview = signal<string | null>(null);
  photoFile = signal<File | null>(null);
  isDragging = signal(false);
  isSubmitting = signal(false);

  categories = ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Insect', 'Other'];
  behaviors = ['Resting', 'Feeding', 'Moving', 'Nesting', 'Swimming', 'Flying', 'Unknown'];

  constructor() {
    effect(() => {
      const list = this.sightingService.sightings();
      this.renderSightingMarkers(list);
    });
  }

  private defaultSighting(): SightingForm {
    const now = new Date();
    return {
      latitude: 0,
      longitude: 0,
      address: '',
      animalName: '',
      category: '',
      quantity: 1,
      behavior: '',
      description: '',
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
    };
  }

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const leaflet = await import('leaflet');
    this.leaflet = leaflet;

    this.map = leaflet.map('map', {
      center: [29.6436, -82.3549],
      zoom: 15,
    });

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      })
      .addTo(this.map);

    const redSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="#E53935"/>
      <circle cx="16" cy="15" r="7" fill="#fff"/>
      <circle cx="16" cy="15" r="3.5" fill="#E53935"/>
    </svg>`;

    this.redIcon = leaflet.icon({
      iconUrl: 'data:image/svg+xml;base64,' + btoa(redSvg),
      iconSize: [32, 44],
      iconAnchor: [16, 44],
      popupAnchor: [0, -44],
    });

    // Render any existing sightings
    this.renderSightingMarkers(this.sightingService.sightings());

    // Click anywhere on the map to add a sighting
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (this.searchMarker) {
        this.searchMarker.remove();
      }

      this.searchMarker = leaflet
        .marker([lat, lng], { icon: this.redIcon! })
        .addTo(this.map!);

      this.searchMarker.on('click', () => {
        this.openSightingForm(lat, lng, this.sighting().address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      });

      // Reverse geocode to get address, then open form
      this.reverseGeocode(lat, lng);
    });
  }

  private async reverseGeocode(lat: number, lng: number) {
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { 'Accept-Language': 'en' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          address = data.display_name;
        }
      }
    } catch {
      // Use coordinate string as fallback
    }

    this.openSightingForm(lat, lng, address);
  }

  private getCategoryIcon(category: string): L.Icon {
    if (!this.leaflet) return this.redIcon!;

    const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];

    if (this.iconCache.has(color)) return this.iconCache.get(color)!;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="${color}"/>
      <circle cx="16" cy="15" r="7" fill="#fff"/>
      <circle cx="16" cy="15" r="3.5" fill="${color}"/>
    </svg>`;

    const icon = this.leaflet.icon({
      iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
      iconSize: [32, 44],
      iconAnchor: [16, 44],
      popupAnchor: [0, -44],
    });

    this.iconCache.set(color, icon);
    return icon;
  }

  private renderSightingMarkers(sightings: Sighting[]) {
    if (!this.map || !this.leaflet) return;

    for (const m of this.sightingMarkers) {
      m.remove();
    }
    this.sightingMarkers = [];

    for (const s of sightings) {
      const icon = this.getCategoryIcon(s.category);
      const popup = `<strong>${s.animalName}</strong><br/>
        <span style="color:${CATEGORY_COLORS[s.category] || CATEGORY_COLORS['Other']}">${s.category || 'Other'}</span>
        &middot; Qty: ${s.quantity}<br/>
        ${s.behavior ? s.behavior + '<br/>' : ''}
        <small>${s.date} ${s.time}</small>`;

      const marker = this.leaflet
        .marker([s.latitude, s.longitude], { icon })
        .addTo(this.map)
        .bindPopup(popup);

      this.sightingMarkers.push(marker);
    }
  }

  async search() {
    const q = this.query().trim();
    if (!q) return;

    this.isSearching.set(true);
    this.searchError.set('');
    this.results.set([]);
    this.showResults.set(false);

    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '5',
        viewbox: '-82.38,29.66,-82.33,29.62',
        bounded: '0',
      });

      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en' },
      });

      if (!res.ok) throw new Error('Search failed');

      const data: NominatimResult[] = await res.json();

      if (data.length === 0) {
        this.searchError.set('No results found.');
      } else if (data.length === 1) {
        this.selectResult(data[0]);
      } else {
        this.results.set(data);
        this.showResults.set(true);
      }
    } catch {
      this.searchError.set('Search failed. Please try again.');
    } finally {
      this.isSearching.set(false);
    }
  }

  selectResult(result: NominatimResult) {
    if (!this.map || !this.leaflet) return;

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    this.showResults.set(false);
    this.searchError.set('');

    if (this.searchMarker) {
      this.searchMarker.remove();
    }

    this.searchMarker = this.leaflet
      .marker([lat, lng], { icon: this.redIcon! })
      .addTo(this.map)
      .bindPopup(result.display_name)
      .openPopup();

    this.searchMarker.on('click', () => {
      this.openSightingForm(lat, lng, result.display_name);
    });

    this.map.setView([lat, lng], 17);
  }

  openSightingForm(lat: number, lng: number, address: string) {
    const now = new Date();
    this.sighting.set({
      ...this.defaultSighting(),
      latitude: lat,
      longitude: lng,
      address,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
    });
    this.photoPreview.set(null);
    this.photoFile.set(null);
    this.showSightingForm.set(true);
  }

  closeSightingForm() {
    this.showSightingForm.set(false);
  }

  categoryColor(cat: string): string {
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];
  }

  updateField(field: keyof SightingForm, value: string | number) {
    this.sighting.set({ ...this.sighting(), [field]: value });
  }

  // Photo handling
  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.handleFile(file);
      }
    }
  }

  private handleFile(file: File) {
    this.photoFile.set(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  removePhoto() {
    this.photoPreview.set(null);
    this.photoFile.set(null);
  }

  submitSighting() {
    const s = this.sighting();
    if (!s.animalName.trim()) return;

    this.isSubmitting.set(true);

    const newSighting: Sighting = {
      id: crypto.randomUUID(),
      userId: this.authService.currentUser()?.id || '',
      latitude: s.latitude,
      longitude: s.longitude,
      address: s.address,
      animalName: s.animalName,
      category: s.category || 'Other',
      quantity: s.quantity,
      behavior: s.behavior,
      description: s.description,
      date: s.date,
      time: s.time,
      photoUrl: this.photoPreview(),
    };

    this.sightingService.add(newSighting);

    // Remove the search marker since a category-colored one replaces it
    if (this.searchMarker) {
      this.searchMarker.remove();
      this.searchMarker = null;
    }

    this.isSubmitting.set(false);
    this.showSightingForm.set(false);
  }

  clearSearch() {
    this.query.set('');
    this.results.set([]);
    this.showResults.set(false);
    this.searchError.set('');

    if (this.searchMarker) {
      this.searchMarker.remove();
      this.searchMarker = null;
    }
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}

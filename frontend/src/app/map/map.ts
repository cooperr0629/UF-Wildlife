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
import { RouterLink } from '@angular/router';
import { SightingService, Sighting, CATEGORY_COLORS, SPECIES_BY_CATEGORY } from '../sighting.service';
import { AuthService } from '../auth.service';
import { UploadService } from '../upload.service';
import type * as L from 'leaflet';

// Module-level reference survives HMR cycles
let _hmrMapInstance: L.Map | null = null;

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Comment {
  ID: number;
  SightingID: number;
  Sender: string;
  Content: string;
  CreateTime: string;
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
  imports: [FormsModule, RouterLink],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private sightingService = inject(SightingService);
  private authService = inject(AuthService);
  private uploadService = inject(UploadService);
  private map: L.Map | null = null;
  private leaflet: typeof L | null = null;
  private searchMarker: L.Marker | null = null;
  private redIcon: L.Icon | null = null;
  private sightingMarkers: L.Marker[] = [];
  private heatmapLayers: L.CircleMarker[] = [];
  private iconCache = new Map<string, L.Icon>();

  query = signal('');
  results = signal<NominatimResult[]>([]);
  showResults = signal(false);
  isSearching = signal(false);
  searchError = signal('');
  showHeatmap = signal(false);

  // Sighting form
  showSightingForm = signal(false);
  loginRequired = signal(false);
  sighting = signal<SightingForm>(this.defaultSighting());
  photoPreview = signal<string | null>(null);
  photoFile = signal<File | null>(null);
  isDragging = signal(false);
  isSubmitting = signal(false);
  photoCropY = signal(50);       // 0–100%, vertical crop position
  photoIsPortrait = signal(false); // true when image needs vertical cropping

  // Sighting detail panel + comments
  selectedSighting = signal<Sighting | null>(null);
  comments = signal<Comment[]>([]);
  commentText = signal('');
  isLoadingComments = signal(false);
  isSubmittingComment = signal(false);
  confirmDeleteSighting = signal(false);

  // Likes
  likeCount = signal(0);
  likedByMe = signal(false);
  isTogglingLike = signal(false);

  // Category filter
  activeCategory = signal<string>('');
  isFilterLoading = signal(false);

  // Stats
  showStatsPanel = signal(false);
  isLoadingStats = signal(false);
  stats = signal<{ totalSightings: number; totalUsers: number; byCategory: Record<string, number> } | null>(null);

  // Nearby
  showNearbyPanel = signal(false);
  nearbyRadius = signal(1000);
  nearbyResults = signal<Sighting[]>([]);
  isLoadingNearby = signal(false);
  nearbyError = signal('');
  nearbyOrigin = signal<{ lat: number; lng: number; source: 'gps' | 'map' } | null>(null);
  private nearbyCircle: L.Circle | null = null;
  private nearbyOriginMarker: L.CircleMarker | null = null;

  categories = ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Insect', 'Other'];
  behaviors = ['Resting', 'Feeding', 'Moving', 'Nesting', 'Swimming', 'Flying', 'Unknown'];

  speciesByCategory = SPECIES_BY_CATEGORY;

  get availableSpecies(): string[] {
    const cat = this.sighting().category;
    return this.speciesByCategory[cat] || [];
  }

  onCategoryChipClick(cat: string) {
    this.sighting.set({ ...this.sighting(), category: cat, animalName: '' });
  }

  constructor() {
    effect(() => {
      const list = this.sightingService.sightings();
      const isHeatmap = this.showHeatmap();
      if (isHeatmap) {
        for (const m of this.sightingMarkers) m.remove();
        this.sightingMarkers = [];
        this.renderHeatmap(list);
      } else {
        this.clearHeatmap();
        this.renderSightingMarkers(list);
      }
    });
  }

  toggleHeatmap() {
    this.showHeatmap.set(!this.showHeatmap());
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

    // Clean up any existing map instance (handles HMR reinit)
    if (_hmrMapInstance) {
      _hmrMapInstance.remove();
      _hmrMapInstance = null;
    }

    this.map = leaflet.map('map', {
      center: [29.6436, -82.3549],
      zoom: 15,
    });
    _hmrMapInstance = this.map;

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

    // Load sightings from backend, then render
    await this.sightingService.loadAll();
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
      const marker = this.leaflet
        .marker([s.latitude, s.longitude], { icon })
        .addTo(this.map);

      marker.on('click', () => this.openSightingDetail(s));
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
    if (!this.authService.currentUser()) {
      this.loginRequired.set(true);
      return;
    }
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
    this.photoCropY.set(50);
    this.photoIsPortrait.set(false);
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
    this.photoCropY.set(50);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.photoPreview.set(dataUrl);
      // Detect if portrait (needs vertical crop for banner display)
      const img = new Image();
      img.onload = () => {
        // Banner ratio is ~2.5:1; portrait if image is taller than banner would be
        const BANNER_RATIO = 2.5;
        this.photoIsPortrait.set(img.naturalHeight / img.naturalWidth > 1 / BANNER_RATIO);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  removePhoto() {
    this.photoPreview.set(null);
    this.photoFile.set(null);
    this.photoIsPortrait.set(false);
    this.photoCropY.set(50);
  }

  private cropImageToBlob(file: File, cropY: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const BANNER_RATIO = 2.5;
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;
        const cropH = Math.round(srcW / BANNER_RATIO);

        if (cropH >= srcH) {
          // Already wide enough – no cropping needed, return original as blob
          file.arrayBuffer().then(buf => resolve(new Blob([buf], { type: file.type })));
          return;
        }

        const maxOffsetY = srcH - cropH;
        const offsetY = Math.round((cropY / 100) * maxOffsetY);

        const canvas = document.createElement('canvas');
        canvas.width = srcW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, offsetY, srcW, cropH, 0, 0, srcW, cropH);
        canvas.toBlob(
          blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
          'image/jpeg',
          0.92,
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async submitSighting() {
    const s = this.sighting();
    if (!s.animalName.trim()) return;

    this.isSubmitting.set(true);

    // Upload photo to Supabase Storage if a file was selected
    let photoUrl: string | null = null;
    const file = this.photoFile();
    if (file) {
      try {
        const cropY = this.photoCropY();
        const croppedBlob = await this.cropImageToBlob(file, cropY);
        const croppedFile = new File([croppedBlob], file.name, { type: 'image/jpeg' });
        photoUrl = await this.uploadService.uploadPhoto(croppedFile);
      } catch (err) {
        console.error('Photo upload failed:', err);
        photoUrl = this.photoPreview();
      }
    }

    const newSighting: Sighting = {
      id: crypto.randomUUID(),
      userId: this.authService.currentUser()?.id || '',
      username: this.authService.currentUser()?.username || '',
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
      photoUrl,
    };

    await this.sightingService.add(newSighting);

    // Remove the search marker since a category-colored one replaces it
    if (this.searchMarker) {
      this.searchMarker.remove();
      this.searchMarker = null;
    }

    this.isSubmitting.set(false);
    this.showSightingForm.set(false);
  }

  openSightingDetail(s: Sighting) {
    this.selectedSighting.set(s);
    this.commentText.set('');
    this.likeCount.set(s.likeCount || 0);
    this.likedByMe.set(false);
    this.loadComments(s.id);
    this.loadLikes(s.id);
  }

  closeSightingDetail() {
    this.selectedSighting.set(null);
    this.comments.set([]);
    this.commentText.set('');
    this.confirmDeleteSighting.set(false);
    this.likeCount.set(0);
    this.likedByMe.set(false);
  }

  async loadLikes(sightingId: string) {
    const userId = this.authService.currentUser()?.id;
    const { count, likedByMe } = await this.sightingService.getLikes(sightingId, userId);
    this.likeCount.set(count);
    this.likedByMe.set(likedByMe);
  }

  async toggleLike() {
    const s = this.selectedSighting();
    const user = this.authService.currentUser();
    if (!s || !user) {
      this.loginRequired.set(true);
      return;
    }
    if (this.isTogglingLike()) return;
    this.isTogglingLike.set(true);
    try {
      const { liked, count } = await this.sightingService.toggleLike(s.id, user.id);
      this.likedByMe.set(liked);
      this.likeCount.set(count);
    } catch (err) {
      console.error('toggle like failed', err);
    } finally {
      this.isTogglingLike.set(false);
    }
  }

  // ---- Nearby ----
  toggleNearbyPanel() {
    const next = !this.showNearbyPanel();
    this.showNearbyPanel.set(next);
    if (next) {
      this.findNearby();
    } else {
      this.clearNearbyCircle();
      this.nearbyResults.set([]);
    }
  }

  setNearbyRadius(value: number) {
    this.nearbyRadius.set(value);
  }

  private getDeviceLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  async findNearby() {
    if (!this.map || !this.leaflet) return;
    this.isLoadingNearby.set(true);
    this.nearbyError.set('');

    let lat: number;
    let lng: number;
    let source: 'gps' | 'map' = 'gps';

    try {
      const loc = await this.getDeviceLocation();
      lat = loc.lat;
      lng = loc.lng;
    } catch (err: any) {
      // Fall back to map center if user denies / no GPS
      const code = err?.code;
      if (code === 1) this.nearbyError.set('Location permission denied — using map center.');
      else if (code === 2) this.nearbyError.set('Location unavailable — using map center.');
      else if (code === 3) this.nearbyError.set('Location timed out — using map center.');
      else this.nearbyError.set('Geolocation failed — using map center.');
      const center = this.map.getCenter();
      lat = center.lat;
      lng = center.lng;
      source = 'map';
    }

    this.nearbyOrigin.set({ lat, lng, source });

    try {
      const results = await this.sightingService.getNearby(lat, lng, this.nearbyRadius());
      this.nearbyResults.set(results);
      this.drawNearbyCircle(lat, lng, this.nearbyRadius());
      // Pan map to the search origin so the user can see the radius
      this.map.setView([lat, lng], this.map.getZoom());
    } catch (err) {
      console.error('nearby fetch failed', err);
      this.nearbyResults.set([]);
    } finally {
      this.isLoadingNearby.set(false);
    }
  }

  private drawNearbyCircle(lat: number, lng: number, radius: number) {
    if (!this.map || !this.leaflet) return;
    this.clearNearbyCircle();
    this.nearbyCircle = this.leaflet
      .circle([lat, lng], {
        radius,
        color: '#0021A5',
        weight: 2,
        fillColor: '#0021A5',
        fillOpacity: 0.08,
      })
      .addTo(this.map);
    // Small dot showing the origin point
    this.nearbyOriginMarker = this.leaflet
      .circleMarker([lat, lng], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#0021A5',
        fillOpacity: 1,
      })
      .addTo(this.map);
  }

  private clearNearbyCircle() {
    if (this.nearbyCircle) {
      this.nearbyCircle.remove();
      this.nearbyCircle = null;
    }
    if (this.nearbyOriginMarker) {
      this.nearbyOriginMarker.remove();
      this.nearbyOriginMarker = null;
    }
  }

  flyToNearby(s: Sighting) {
    if (!this.map) return;
    this.map.setView([s.latitude, s.longitude], 18);
    this.openSightingDetail(s);
  }

  formatDistance(meters: number | undefined): string {
    if (!meters && meters !== 0) return '';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  }

  // ---- Category filter ----
  async selectCategory(cat: string) {
    if (this.activeCategory() === cat) return;
    this.activeCategory.set(cat);
    this.isFilterLoading.set(true);
    try {
      await this.sightingService.loadAll(cat || undefined);
    } finally {
      this.isFilterLoading.set(false);
    }
  }

  // ---- Stats ----
  async toggleStatsPanel() {
    const next = !this.showStatsPanel();
    this.showStatsPanel.set(next);
    if (next && !this.stats()) {
      await this.loadStats();
    }
  }

  async loadStats() {
    this.isLoadingStats.set(true);
    try {
      const s = await this.sightingService.getStats();
      this.stats.set(s);
    } catch (err) {
      console.error('stats fetch failed', err);
      this.stats.set(null);
    } finally {
      this.isLoadingStats.set(false);
    }
  }

  statsCategoryEntries(): { name: string; count: number; color: string; pct: number }[] {
    const s = this.stats();
    if (!s) return [];
    const max = Math.max(...Object.values(s.byCategory), 1);
    return Object.entries(s.byCategory)
      .map(([name, count]) => ({
        name,
        count,
        color: CATEGORY_COLORS[name] || CATEGORY_COLORS['Other'],
        pct: (count / max) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  isOwner(sighting: Sighting): boolean {
    const user = this.authService.currentUser();
    return !!user && user.id === sighting.userId;
  }

  requestDeleteSighting() {
    this.confirmDeleteSighting.set(true);
  }

  cancelDeleteSighting() {
    this.confirmDeleteSighting.set(false);
  }

  async executeDeleteSighting() {
    const s = this.selectedSighting();
    if (!s) return;
    await this.sightingService.remove(s.id);
    this.closeSightingDetail();
  }

  async loadComments(sightingId: string) {
    this.isLoadingComments.set(true);
    try {
      const res = await fetch(`http://localhost:8080/api/sightings/${sightingId}/messages`);
      const data = await res.json();
      this.comments.set(Array.isArray(data) ? data : []);
    } catch {
      this.comments.set([]);
    } finally {
      this.isLoadingComments.set(false);
    }
  }

  async submitComment() {
    const content = this.commentText().trim();
    const s = this.selectedSighting();
    if (!content || !s) return;

    this.isSubmittingComment.set(true);
    try {
      const user = this.authService.currentUser();
      await fetch(`http://localhost:8080/api/sightings/${s.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          sender: user?.username ?? 'Anonymous',
          sender_id: user?.id ?? '',
        }),
      });
      this.commentText.set('');
      await this.loadComments(s.id);
    } finally {
      this.isSubmittingComment.set(false);
    }
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

  private renderHeatmap(sightings: Sighting[]) {
    if (!this.map || !this.leaflet) return;
    this.clearHeatmap();

    for (const s of sightings) {
      const outerRadius = Math.min(22 + s.quantity * 6, 58);
      const innerRadius = Math.max(outerRadius * 0.45, 8);

      const outer = this.leaflet.circleMarker([s.latitude, s.longitude], {
        radius: outerRadius,
        fillColor: '#FA7C1C',
        fillOpacity: 0.14,
        color: 'transparent',
        weight: 0,
        interactive: false,
      }).addTo(this.map);

      const inner = this.leaflet.circleMarker([s.latitude, s.longitude], {
        radius: innerRadius,
        fillColor: '#E53200',
        fillOpacity: 0.42,
        color: 'transparent',
        weight: 0,
        interactive: false,
      }).addTo(this.map);

      this.heatmapLayers.push(outer, inner);
    }
  }

  private clearHeatmap() {
    for (const l of this.heatmapLayers) l.remove();
    this.heatmapLayers = [];
  }

  ngOnDestroy() {
    this.clearHeatmap();
    this.clearNearbyCircle();
    this.map?.remove();
    _hmrMapInstance = null;
  }
}

import {
  Component,
  inject,
  computed,
  signal,
  effect,
  PLATFORM_ID,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser, KeyValuePipe } from '@angular/common';
import { SightingService, CATEGORY_COLORS, SPECIES_INFO, Sighting } from '../sighting.service';
import type * as L from 'leaflet';

@Component({
  selector: 'app-photos',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './photos.html',
  styleUrl: './photos.css',
})
export class PhotosComponent implements OnDestroy {
  private sightingService = inject(SightingService);
  private platformId = inject(PLATFORM_ID);
  private detailMap: L.Map | null = null;

  readonly grouped = this.sightingService.groupedByCategory;
  readonly isEmpty = computed(() => this.sightingService.sightings().length === 0);

  selectedSighting = signal<Sighting | null>(null);

  readonly selectedSpeciesInfo = computed(() => {
    const s = this.selectedSighting();
    if (!s) return null;
    return SPECIES_INFO[s.animalName] ?? null;
  });

  readonly speciesSightings = computed(() => {
    const s = this.selectedSighting();
    if (!s) return [];
    return this.sightingService.sightings().filter(x => x.animalName === s.animalName);
  });

  constructor() {
    effect(() => {
      const s = this.selectedSighting();
      if (s && isPlatformBrowser(this.platformId)) {
        setTimeout(() => this.initDetailMap(), 80);
      } else {
        this.destroyDetailMap();
      }
    });
  }

  private async initDetailMap() {
    const el = document.getElementById('photo-detail-map');
    if (!el) return;
    this.destroyDetailMap();

    const L = await import('leaflet');
    const sightings = this.speciesSightings();
    const selected = this.selectedSighting();
    const cat = selected?.category || 'Other';
    const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];

    const center: [number, number] =
      sightings.length > 0
        ? [sightings[0].latitude, sightings[0].longitude]
        : [29.6436, -82.3549];

    this.detailMap = L.map('photo-detail-map', { center, zoom: 14 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.detailMap);

    for (const s of sightings) {
      const outerR = Math.min(18 + s.quantity * 4, 40);
      const innerR = Math.max(outerR * 0.45, 6);

      L.circleMarker([s.latitude, s.longitude] as [number, number], {
        radius: outerR,
        fillColor: color,
        color: color,
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.22,
      }).addTo(this.detailMap);

      L.circleMarker([s.latitude, s.longitude] as [number, number], {
        radius: innerR,
        fillColor: color,
        color: 'transparent',
        weight: 0,
        fillOpacity: 0.65,
      })
        .addTo(this.detailMap)
        .bindPopup(`<strong>${s.animalName}</strong><br/>${s.date}<br/><small>${s.address}</small>`);
    }

    if (sightings.length > 1) {
      const bounds = L.latLngBounds(
        sightings.map(s => [s.latitude, s.longitude] as [number, number])
      );
      this.detailMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  private destroyDetailMap() {
    if (this.detailMap) {
      this.detailMap.remove();
      this.detailMap = null;
    }
  }

  color(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  }

  selectCard(s: Sighting) {
    this.selectedSighting.set(s);
  }

  closeDetail() {
    this.selectedSighting.set(null);
  }

  ngOnDestroy() {
    this.destroyDetailMap();
  }
}

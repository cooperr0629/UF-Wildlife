import {
  Component,
  inject,
  computed,
  signal,
  effect,
  PLATFORM_ID,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SightingService, CATEGORY_COLORS, SPECIES_BY_CATEGORY, SPECIES_INFO } from '../sighting.service';
import type * as L from 'leaflet';

interface SpeciesEntry {
  name: string;
  count: number;
}

@Component({
  selector: 'app-species',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './species.html',
  styleUrl: './species.css',
})
export class SpeciesComponent implements OnDestroy {
  private sightingService = inject(SightingService);
  private platformId = inject(PLATFORM_ID);
  private speciesMap: L.Map | null = null;

  readonly categories = ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Insect', 'Other'];
  readonly speciesInfo = SPECIES_INFO;

  readonly categoryCovers = computed(() => {
    const all = this.sightingService.sightings();
    const covers: Record<string, string | null> = {};
    for (const cat of this.categories) {
      const withPhoto = all.find(s => s.category === cat && !!s.photoUrl);
      covers[cat] = withPhoto?.photoUrl ?? null;
    }
    return covers;
  });

  selectedCategory = signal<string | null>(null);
  selectedSpecies = signal<string | null>(null);
  searchQuery = signal('');

  readonly searchResults = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    const results: { name: string; category: string }[] = [];
    for (const cat of this.categories) {
      for (const sp of (SPECIES_BY_CATEGORY[cat] || [])) {
        if (sp.toLowerCase().includes(q)) {
          results.push({ name: sp, category: cat });
        }
      }
    }
    return results.slice(0, 20);
  });

  readonly sightingsByCategory = computed(() => {
    const all = this.sightingService.sightings();
    const map: Record<string, SpeciesEntry[]> = {};
    for (const cat of this.categories) {
      // Start with all predefined species for this category (count = 0)
      const speciesMap = new Map<string, number>();
      for (const name of (SPECIES_BY_CATEGORY[cat] || [])) {
        speciesMap.set(name, 0);
      }
      // Add counts from actual sightings (also adds any user-recorded species not in the predefined list)
      for (const s of all.filter(s => s.category === cat)) {
        speciesMap.set(s.animalName, (speciesMap.get(s.animalName) || 0) + s.quantity);
      }
      map[cat] = Array.from(speciesMap.entries()).map(([name, count]) => ({ name, count }));
    }
    return map;
  });

  readonly categoryCounts = computed(() => {
    const map: Record<string, number> = {};
    for (const cat of this.categories) {
      map[cat] = this.sightingsByCategory()[cat]?.length || 0;
    }
    return map;
  });

  readonly currentSpecies = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    return this.sightingsByCategory()[cat] || [];
  });

  readonly speciesSightings = computed(() => {
    const sp = this.selectedSpecies();
    if (!sp) return [];
    return this.sightingService.sightings().filter(s => s.animalName === sp);
  });

  readonly speciesStats = computed(() => {
    const sightings = this.speciesSightings();
    const totalSightings = sightings.length;
    const totalQuantity = sightings.reduce((sum, s) => sum + s.quantity, 0);
    const behaviors = [...new Set(sightings.map(s => s.behavior).filter(b => b))];
    const dates = sightings.map(s => s.date).filter(d => d).sort();
    const firstSeen = dates[0] || '';
    const lastSeen = dates[dates.length - 1] || '';
    return { totalSightings, totalQuantity, behaviors, firstSeen, lastSeen };
  });

  constructor() {
    effect(() => {
      const sp = this.selectedSpecies();
      if (sp && isPlatformBrowser(this.platformId)) {
        setTimeout(() => this.initSpeciesMap(), 50);
      } else {
        this.destroySpeciesMap();
      }
    });
  }

  private async initSpeciesMap() {
    const el = document.getElementById('species-heatmap');
    if (!el) return;
    this.destroySpeciesMap();

    const L = await import('leaflet');
    const sightings = this.speciesSightings();
    const cat = this.selectedCategory() || 'Other';
    const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];

    const center: [number, number] =
      sightings.length > 0
        ? [sightings[0].latitude, sightings[0].longitude]
        : [29.6436, -82.3549];

    this.speciesMap = L.map('species-heatmap', { center, zoom: 15 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.speciesMap);

    for (const s of sightings) {
      L.circleMarker([s.latitude, s.longitude] as [number, number], {
        radius: 10 + Math.min(s.quantity * 2, 14),
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.45,
      })
        .addTo(this.speciesMap)
        .bindPopup(
          `<strong>${s.animalName}</strong><br/>${s.date} ${s.time}<br/><small>${s.address}</small>`
        );
    }

    if (sightings.length > 1) {
      const bounds = L.latLngBounds(
        sightings.map(s => [s.latitude, s.longitude] as [number, number])
      );
      this.speciesMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  private destroySpeciesMap() {
    if (this.speciesMap) {
      this.speciesMap.remove();
      this.speciesMap = null;
    }
  }

  color(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  }

  selectCategory(cat: string) {
    this.selectedCategory.set(cat);
  }

  selectSpecies(name: string) {
    this.selectedSpecies.set(name);
  }

  selectSearchResult(result: { name: string; category: string }) {
    this.searchQuery.set('');
    this.selectedCategory.set(result.category);
    this.selectedSpecies.set(result.name);
  }

  goBack() {
    if (this.selectedSpecies()) {
      this.destroySpeciesMap();
      this.selectedSpecies.set(null);
    } else {
      this.selectedCategory.set(null);
    }
  }

  ngOnDestroy() {
    this.destroySpeciesMap();
  }
}

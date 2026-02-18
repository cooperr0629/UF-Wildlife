import { Component, inject, computed, signal } from '@angular/core';
import { SightingService, CATEGORY_COLORS } from '../sighting.service';

interface SpeciesEntry {
  name: string;
  count: number;
}

@Component({
  selector: 'app-species',
  standalone: true,
  imports: [],
  templateUrl: './species.html',
  styleUrl: './species.css',
})
export class SpeciesComponent {
  private sightingService = inject(SightingService);

  readonly categories = ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Insect', 'Other'];

  // Auto-pick the first sighting photo for each category as cover
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

  readonly sightingsByCategory = computed(() => {
    const all = this.sightingService.sightings();
    const map: Record<string, SpeciesEntry[]> = {};
    for (const cat of this.categories) {
      const inCat = all.filter(s => s.category === cat);
      const speciesMap = new Map<string, number>();
      for (const s of inCat) {
        speciesMap.set(s.animalName, (speciesMap.get(s.animalName) || 0) + s.quantity);
      }
      map[cat] = Array.from(speciesMap.entries()).map(([name, count]) => ({ name, count }));
    }
    return map;
  });

  readonly categoryCounts = computed(() => {
    const all = this.sightingService.sightings();
    const map: Record<string, number> = {};
    for (const cat of this.categories) {
      map[cat] = all.filter(s => s.category === cat).length;
    }
    return map;
  });

  readonly currentSpecies = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    return this.sightingsByCategory()[cat] || [];
  });

  color(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  }

  selectCategory(cat: string) {
    this.selectedCategory.set(cat);
  }

  goBack() {
    this.selectedCategory.set(null);
  }
}

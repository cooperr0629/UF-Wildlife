import { Injectable, signal, computed } from '@angular/core';

export interface Sighting {
  id: string;
  userId: string;
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
  photoUrl: string | null;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Mammal: '#E53935',
  Bird: '#1E88E5',
  Reptile: '#43A047',
  Amphibian: '#8E24AA',
  Fish: '#00ACC1',
  Insect: '#FFB300',
  Other: '#757575',
};

@Injectable({ providedIn: 'root' })
export class SightingService {
  private _sightings = signal<Sighting[]>([]);

  readonly sightings = this._sightings.asReadonly();

  readonly groupedByCategory = computed(() => {
    const map = new Map<string, Sighting[]>();
    for (const s of this._sightings()) {
      const cat = s.category || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return map;
  });

  add(sighting: Sighting) {
    this._sightings.update((list) => [...list, sighting]);
  }

  remove(id: string) {
    this._sightings.update((list) => list.filter((s) => s.id !== id));
  }

  update(id: string, data: Partial<Sighting>) {
    this._sightings.update((list) =>
      list.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  }

  sightingsByUser(userId: string): Sighting[] {
    return this._sightings().filter((s) => s.userId === userId);
  }
}

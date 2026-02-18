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

const API_BASE = 'http://localhost:8080/api/sightings';

@Injectable({ providedIn: 'root' })
export class SightingService {
  private _sightings = signal<Sighting[]>([]);
  private _loaded = false;

  readonly sightings = this._sightings.asReadonly();

  constructor() {
    // Auto-load sightings from backend on service init
    this.loadAll();
  }

  readonly groupedByCategory = computed(() => {
    const map = new Map<string, Sighting[]>();
    for (const s of this._sightings()) {
      const cat = s.category || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return map;
  });

  async loadAll(): Promise<void> {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load sightings');
      const data: any[] = await res.json();
      this._loaded = true;
      const sightings: Sighting[] = data.map((row) => ({
        id: String(row.id),
        userId: String(row.user_id || ''),
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address || '',
        animalName: row.species,
        category: row.category || 'Other',
        quantity: row.quantity || 1,
        behavior: row.behavior || '',
        description: row.description || '',
        date: row.date || '',
        time: row.time || '',
        photoUrl: row.image_url || null,
      }));
      this._sightings.set(sightings);
    } catch (err) {
      console.error('Failed to load sightings:', err);
    }
  }

  async add(sighting: Sighting): Promise<void> {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: sighting.animalName,
          image_url: sighting.photoUrl || '',
          latitude: sighting.latitude,
          longitude: sighting.longitude,
          address: sighting.address,
          category: sighting.category,
          quantity: sighting.quantity,
          behavior: sighting.behavior,
          description: sighting.description,
          date: sighting.date,
          time: sighting.time,
          userId: sighting.userId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create sighting');
      const data = await res.json();
      // Use the server-assigned ID
      this._sightings.update((list) => [
        ...list,
        { ...sighting, id: String(data.id) },
      ]);
    } catch (err) {
      console.error('Failed to add sighting:', err);
      // Fallback: add locally so the UI still updates
      this._sightings.update((list) => [...list, sighting]);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sighting');
    } catch (err) {
      console.error('Failed to remove sighting:', err);
    }
    this._sightings.update((list) => list.filter((s) => s.id !== id));
  }

  async update(id: string, data: Partial<Sighting>): Promise<void> {
    const current = this._sightings().find((s) => s.id === id);
    if (!current) return;

    const merged = { ...current, ...data };
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: merged.animalName,
          image_url: merged.photoUrl || '',
          latitude: merged.latitude,
          longitude: merged.longitude,
          address: merged.address,
          category: merged.category,
          quantity: merged.quantity,
          behavior: merged.behavior,
          description: merged.description,
          date: merged.date,
          time: merged.time,
        }),
      });
      if (!res.ok) throw new Error('Failed to update sighting');
    } catch (err) {
      console.error('Failed to update sighting:', err);
    }
    this._sightings.update((list) =>
      list.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  }

  sightingsByUser(userId: string): Sighting[] {
    return this._sightings().filter((s) => s.userId === userId);
  }
}

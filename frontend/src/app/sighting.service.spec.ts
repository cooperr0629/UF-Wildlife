import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SightingService, Sighting } from './sighting.service';

// ── Backend response shape (matches models.Animals JSON tags in Go) ──────────
interface BackendSighting {
  id: number;
  species: string;
  image_url: string;
  latitude: number;
  longitude: number;
  address: string;
  category: string;
  quantity: number;
  behavior: string;
  description: string;
  date: string;
  time: string;
  user_id: number;
  username: string;
  created_at: string;
}

function makeBackendSighting(overrides: Partial<BackendSighting> = {}): BackendSighting {
  return {
    id: 1,
    species: 'Sandhill Crane',
    image_url: '',
    latitude: 29.6436,
    longitude: -82.3549,
    address: 'UF Campus',
    category: 'Bird',
    quantity: 2,
    behavior: 'Feeding',
    description: 'Near the pond',
    date: '2025-01-01',
    time: '09:00',
    user_id: 1,
    username: 'Gator',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// Convenience: frontend Sighting shape used for add/update tests
function makeSighting(overrides: Partial<Sighting> = {}): Sighting {
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
    description: 'Near the pond',
    date: '2025-01-01',
    time: '09:00',
    photoUrl: null,
    ...overrides,
  };
}

// Helper: build a resolved fetch mock
function mockFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

describe('SightingService', () => {
  let service: SightingService;

  beforeEach(() => {
    // Suppress expected console.error from service catch blocks
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Block the constructor's loadAll() from hitting the real backend
    globalThis.fetch = mockFetch([], false);

    TestBed.configureTestingModule({});
    service = TestBed.inject(SightingService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── sightings() ──────────────────────────────────────────────────────────

  it('sightings() starts as an empty array', () => {
    expect(service.sightings()).toEqual([]);
  });

  // ── groupedByCategory() ──────────────────────────────────────────────────

  it('groupedByCategory() groups sightings by category using real backend response format', async () => {
    // Use the exact JSON shape the Go backend returns (snake_case, integer id)
    const rows: BackendSighting[] = [
      makeBackendSighting({ id: 1, category: 'Bird', species: 'Sandhill Crane' }),
      makeBackendSighting({ id: 2, category: 'Mammal', species: 'Raccoon' }),
      makeBackendSighting({ id: 3, category: 'Bird', species: 'Osprey' }),
    ];

    globalThis.fetch = mockFetch(rows);
    await service.loadAll();

    const grouped = service.groupedByCategory();
    expect(grouped.get('Bird')?.length).toBe(2);
    expect(grouped.get('Mammal')?.length).toBe(1);
    expect(grouped.get('Reptile')).toBeUndefined();
  });

  // ── loadAll() ────────────────────────────────────────────────────────────

  it('loadAll() correctly maps backend fields to frontend Sighting shape', async () => {
    const row = makeBackendSighting({
      id: 42,
      species: 'American Alligator',
      image_url: 'https://example.com/gator.jpg',
      category: 'Reptile',
      quantity: 3,
      user_id: 7,
      username: 'BiologyStudent',
    });

    globalThis.fetch = mockFetch([row]);
    await service.loadAll();

    const [s] = service.sightings();
    expect(s.id).toBe('42');               // String(row.id)
    expect(s.animalName).toBe('American Alligator'); // row.species → animalName
    expect(s.photoUrl).toBe('https://example.com/gator.jpg'); // row.image_url → photoUrl
    expect(s.userId).toBe('7');            // String(row.user_id)
    expect(s.category).toBe('Reptile');
    expect(s.quantity).toBe(3);
  });

  // ── add() ────────────────────────────────────────────────────────────────

  it('add() uses the server-assigned integer id from POST response', async () => {
    // Backend POST /api/sightings returns { "id": 99 }
    globalThis.fetch = mockFetch({ id: 99 });

    await service.add(makeSighting({ id: 'local-id' }));

    expect(service.sightings().length).toBe(1);
    expect(service.sightings()[0].id).toBe('99'); // String(data.id)
    expect(service.sightings()[0].animalName).toBe('Sandhill Crane');
  });

  it('add() falls back to local insert when the backend is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await service.add(makeSighting({ id: 'offline-id' }));

    expect(service.sightings().length).toBe(1);
    expect(service.sightings()[0].id).toBe('offline-id');
  });

  // ── remove() ─────────────────────────────────────────────────────────────

  it('remove() deletes the sighting locally after backend DELETE succeeds', async () => {
    // Prime the list with two sightings via the fallback path
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await service.add(makeSighting({ id: '10', animalName: 'Raccoon' }));
    await service.add(makeSighting({ id: '11', animalName: 'Armadillo' }));
    expect(service.sightings().length).toBe(2);

    // Backend DELETE /api/sightings/{id} returns { "status": "deleted" } (200 OK)
    globalThis.fetch = mockFetch({ status: 'deleted' });
    await service.remove('10');

    expect(service.sightings().length).toBe(1);
    expect(service.sightings()[0].id).toBe('11');
  });

  // ── update() ─────────────────────────────────────────────────────────────

  it('update() merges changed fields after backend PUT succeeds', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await service.add(makeSighting({ id: '20', quantity: 1 }));

    // Backend PUT /api/sightings/{id} returns { "status": "updated" } (200 OK)
    globalThis.fetch = mockFetch({ status: 'updated' });
    await service.update('20', { quantity: 5, behavior: 'Resting' });

    const updated = service.sightings().find((s) => s.id === '20');
    expect(updated?.quantity).toBe(5);
    expect(updated?.behavior).toBe('Resting');
    expect(updated?.animalName).toBe('Sandhill Crane'); // unchanged
  });

  it('update() does nothing when the sighting id does not exist locally', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await service.add(makeSighting({ id: '30', quantity: 2 }));

    await service.update('nonexistent-id', { quantity: 99 });

    expect(service.sightings()[0].quantity).toBe(2); // original unchanged
  });

  // ── getLeaderboard() ──────────────────────────────────────────────────────

  it('getLeaderboard() extracts entries from wrapped response', async () => {
    const entries = [
      { user_id: 1, username: 'Alice', score: 10 },
      { user_id: 2, username: 'Bob', score: 5 },
    ];
    globalThis.fetch = mockFetch({ entries });

    const result = await service.getLeaderboard('sightings', 'all');
    expect(result).toEqual(entries);
  });

  it('getLeaderboard() returns empty array on error', async () => {
    globalThis.fetch = mockFetch({}, false);
    const result = await service.getLeaderboard();
    expect(result).toEqual([]);
  });

  // ── createReport() ────────────────────────────────────────────────────────

  it('createReport() returns success on 200', async () => {
    globalThis.fetch = mockFetch({ id: 1 });
    const result = await service.createReport('5', 3, 'Fake sighting');
    expect(result.success).toBe(true);
  });

  it('createReport() returns error message on failure', async () => {
    globalThis.fetch = mockFetch({ error: 'already reported' }, false);
    const result = await service.createReport('5', 3, 'Fake');
    expect(result.success).toBe(false);
    expect(result.message).toBe('already reported');
  });

  // ── getSubscriptions() ────────────────────────────────────────────────────

  it('getSubscriptions() returns subscription array', async () => {
    const subs = [{ id: 1, user_id: 3, type: 'species', value: 'Raccoon' }];
    globalThis.fetch = mockFetch(subs);
    const result = await service.getSubscriptions('3');
    expect(result).toEqual(subs);
  });

  it('getSubscriptions() returns empty array on error', async () => {
    globalThis.fetch = mockFetch({}, false);
    const result = await service.getSubscriptions('3');
    expect(result).toEqual([]);
  });

  // ── createSubscription() ──────────────────────────────────────────────────

  it('createSubscription() returns success with id', async () => {
    globalThis.fetch = mockFetch({ id: 10 });
    const result = await service.createSubscription(3, 'species', 'Raccoon');
    expect(result.success).toBe(true);
    expect(result.id).toBe(10);
  });

  // ── deleteSubscription() ──────────────────────────────────────────────────

  it('deleteSubscription() returns true on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as unknown as Response);
    const result = await service.deleteSubscription(10);
    expect(result).toBe(true);
  });

  // ── getNotifications() ────────────────────────────────────────────────────

  it('getNotifications() returns notification array', async () => {
    const notifs = [{ id: 1, user_id: 3, message: 'New sighting', is_read: false }];
    globalThis.fetch = mockFetch(notifs);
    const result = await service.getNotifications('3');
    expect(result).toEqual(notifs);
  });

  it('getNotifications() returns empty array for non-array response', async () => {
    globalThis.fetch = mockFetch(null);
    const result = await service.getNotifications('3');
    expect(result).toEqual([]);
  });

  // ── markNotificationRead() ────────────────────────────────────────────────

  it('markNotificationRead() returns true on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as unknown as Response);
    const result = await service.markNotificationRead(1);
    expect(result).toBe(true);
  });

  // ── getChannels() ─────────────────────────────────────────────────────────

  it('getChannels() returns channel array', async () => {
    const channels = [{ id: 1, name: 'Lake Alice', msg_count: 5 }];
    globalThis.fetch = mockFetch(channels);
    const result = await service.getChannels();
    expect(result).toEqual(channels);
  });

  // ── createChannel() ───────────────────────────────────────────────────────

  it('createChannel() returns success with id', async () => {
    globalThis.fetch = mockFetch({ id: 7 });
    const result = await service.createChannel('Test Channel', 'desc', 3);
    expect(result.success).toBe(true);
    expect(result.id).toBe(7);
  });

  // ── getChannelMessages() ──────────────────────────────────────────────────

  it('getChannelMessages() returns message array', async () => {
    const msgs = [{ id: 1, channel_id: 1, sender_name: 'Alice', content: 'Hi' }];
    globalThis.fetch = mockFetch(msgs);
    const result = await service.getChannelMessages(1);
    expect(result).toEqual(msgs);
  });

  it('getChannelMessages() returns empty array for non-array response', async () => {
    globalThis.fetch = mockFetch(null);
    const result = await service.getChannelMessages(1);
    expect(result).toEqual([]);
  });

  // ── sendChannelMessage() ──────────────────────────────────────────────────

  it('sendChannelMessage() returns true on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as unknown as Response);
    const result = await service.sendChannelMessage(1, 3, 'Alice', 'Hello!');
    expect(result).toBe(true);
  });

  // ── changePassword() ──────────────────────────────────────────────────────

  it('changePassword() returns success on 200', async () => {
    globalThis.fetch = mockFetch({ message: 'password changed' });
    const result = await service.changePassword(3, 'OldPass1', 'NewPass1');
    expect(result.success).toBe(true);
  });

  it('changePassword() returns error message on failure', async () => {
    globalThis.fetch = mockFetch({ error: 'incorrect old password' }, false);
    const result = await service.changePassword(3, 'wrong', 'NewPass1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('incorrect old password');
  });
});

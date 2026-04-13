import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FriendService } from './friend.service';

// ── Helper: build a resolved fetch mock ─────────────────────────────────────
function mockFetch(body: unknown, ok = true, status = ok ? 200 : 400) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

describe('FriendService', () => {
  let service: FriendService;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Block any accidental real network calls
    globalThis.fetch = mockFetch([], false);

    TestBed.configureTestingModule({});
    service = TestBed.inject(FriendService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── sendFriendRequest ────────────────────────────────────────────────────

  it('sendFriendRequest() returns status on success', async () => {
    globalThis.fetch = mockFetch({ status: 'requested' });
    const result = await service.sendFriendRequest('1', 'Bob');
    expect(result.status).toBe('requested');
  });

  it('sendFriendRequest() throws with server error message on failure', async () => {
    globalThis.fetch = mockFetch({ error: 'already friends' }, false);
    await expect(service.sendFriendRequest('1', 'Bob')).rejects.toThrow('already friends');
  });

  it('sendFriendRequest() throws network error when fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(service.sendFriendRequest('1', 'Bob')).rejects.toThrow('Cannot reach server');
  });

  it('sendFriendRequest() throws generic error when server returns no body error field', async () => {
    globalThis.fetch = mockFetch({}, false, 500);
    await expect(service.sendFriendRequest('1', 'Bob')).rejects.toThrow('Server error 500');
  });

  // ── getFriends ───────────────────────────────────────────────────────────

  it('getFriends() returns array of friends on success', async () => {
    const friends = [
      { friendship_id: 1, friend_id: 2, username: 'Bob' },
      { friendship_id: 2, friend_id: 3, username: 'Alice' },
    ];
    globalThis.fetch = mockFetch(friends);
    const result = await service.getFriends('1');
    expect(result).toHaveLength(2);
    expect(result[0].username).toBe('Bob');
    expect(result[1].friend_id).toBe(3);
  });

  it('getFriends() returns empty array when backend fails', async () => {
    globalThis.fetch = mockFetch(null, false);
    const result = await service.getFriends('1');
    expect(result).toEqual([]);
  });

  // ── getFriendRequests ────────────────────────────────────────────────────

  it('getFriendRequests() returns pending requests', async () => {
    const requests = [
      { id: 10, requester_id: 5, username: 'Charlie', created_at: '2025-01-01T00:00:00Z' },
    ];
    globalThis.fetch = mockFetch(requests);
    const result = await service.getFriendRequests('1');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('Charlie');
  });

  it('getFriendRequests() returns empty array when backend fails', async () => {
    globalThis.fetch = mockFetch(null, false);
    const result = await service.getFriendRequests('1');
    expect(result).toEqual([]);
  });

  // ── acceptRequest ────────────────────────────────────────────────────────

  it('acceptRequest() sends correct payload to backend', async () => {
    const fetchSpy = mockFetch({ status: 'accepted' });
    globalThis.fetch = fetchSpy;
    await service.acceptRequest(42, '7');

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/friends/accept');
    const body = JSON.parse(options.body as string);
    expect(body.friendship_id).toBe(42);
    expect(body.user_id).toBe(7);
  });

  // ── declineRequest ───────────────────────────────────────────────────────

  it('declineRequest() sends correct payload to backend', async () => {
    const fetchSpy = mockFetch({ status: 'declined' });
    globalThis.fetch = fetchSpy;
    await service.declineRequest(55, '3');

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/friends/decline');
    const body = JSON.parse(options.body as string);
    expect(body.friendship_id).toBe(55);
    expect(body.user_id).toBe(3);
  });

  // ── removeFriend ─────────────────────────────────────────────────────────

  it('removeFriend() sends correct payload to backend', async () => {
    const fetchSpy = mockFetch({ status: 'removed' });
    globalThis.fetch = fetchSpy;
    await service.removeFriend('2', 99);

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/friends/remove');
    const body = JSON.parse(options.body as string);
    expect(body.friendship_id).toBe(99);
    expect(body.user_id).toBe(2);
  });

  // ── getMessages ──────────────────────────────────────────────────────────

  it('getMessages() returns messages array on success', async () => {
    const msgs = [
      { id: 1, sender_id: 1, sender_name: 'Me', receiver_id: 2, content: 'Hello', created_at: '2025-01-01T10:00:00Z' },
      { id: 2, sender_id: 2, sender_name: 'Bob', receiver_id: 1, content: 'Hi!', created_at: '2025-01-01T10:01:00Z' },
    ];
    globalThis.fetch = mockFetch(msgs);
    const result = await service.getMessages('1', 2);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Hello');
  });

  it('getMessages() returns empty array when backend fails', async () => {
    globalThis.fetch = mockFetch(null, false);
    const result = await service.getMessages('1', 2);
    expect(result).toEqual([]);
  });

  it('getMessages() returns empty array when backend returns non-array', async () => {
    globalThis.fetch = mockFetch({ error: 'something' });
    const result = await service.getMessages('1', 2);
    expect(result).toEqual([]);
  });

  // ── sendMessage ──────────────────────────────────────────────────────────

  it('sendMessage() sends correct payload to backend', async () => {
    const fetchSpy = mockFetch({ status: 'sent' });
    globalThis.fetch = fetchSpy;
    await service.sendMessage('1', 2, 'Hey there!');

    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/dm');
    const body = JSON.parse(options.body as string);
    expect(body.sender_id).toBe(1);
    expect(body.receiver_id).toBe(2);
    expect(body.content).toBe('Hey there!');
  });
});

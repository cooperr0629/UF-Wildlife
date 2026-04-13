import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MapComponent } from './map';
import { SightingService } from '../sighting.service';
import { AuthService } from '../auth.service';
import { UploadService } from '../upload.service';
import { FriendService } from '../friend.service';

// ── Minimal stubs ────────────────────────────────────────────────
const sightingServiceStub = {
  sightings: () => [],
  loadAll: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
};

let authCurrentUser: { id: string; username: string } | null = { id: 'u1', username: 'Gator' };
const authServiceStub = {
  currentUser: () => authCurrentUser,
};

const uploadServiceStub = {
  uploadPhoto: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
};

const friendServiceStub = {
  sendFriendRequest: vi.fn().mockResolvedValue({ status: 'requested' }),
};

// ── Suite ────────────────────────────────────────────────────────
describe('MapComponent', () => {
  let component: MapComponent;

  beforeEach(async () => {
    // Block fetch so the service constructor doesn't hit the backend
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    authCurrentUser = { id: 'u1', username: 'Gator' };
    (friendServiceStub.sendFriendRequest as ReturnType<typeof vi.fn>)
      .mockClear()
      .mockResolvedValue({ status: 'requested' });

    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        provideRouter([]),
        // Run as server-side so ngAfterViewInit skips Leaflet DOM init
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: SightingService, useValue: sightingServiceStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: UploadService, useValue: uploadServiceStub },
        { provide: FriendService, useValue: friendServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // toggleHeatmap
  it('toggleHeatmap() flips showHeatmap from false to true', () => {
    expect(component.showHeatmap()).toBe(false);
    component.toggleHeatmap();
    expect(component.showHeatmap()).toBe(true);
  });

  it('toggleHeatmap() flips showHeatmap back to false on second call', () => {
    component.toggleHeatmap();
    component.toggleHeatmap();
    expect(component.showHeatmap()).toBe(false);
  });

  // onCategoryChipClick
  it('onCategoryChipClick() sets category and clears animalName', () => {
    component.onCategoryChipClick('Bird');
    expect(component.sighting().category).toBe('Bird');
    expect(component.sighting().animalName).toBe('');
  });

  it('onCategoryChipClick() switching category resets animalName', () => {
    component.onCategoryChipClick('Mammal');
    component.updateField('animalName', 'Raccoon');
    component.onCategoryChipClick('Bird');
    expect(component.sighting().category).toBe('Bird');
    expect(component.sighting().animalName).toBe('');
  });

  // availableSpecies
  it('availableSpecies returns species list for selected category', () => {
    component.onCategoryChipClick('Bird');
    expect(component.availableSpecies).toContain('Sandhill Crane');
    expect(component.availableSpecies.length).toBeGreaterThan(0);
  });

  it('availableSpecies returns empty array for "Other" category', () => {
    component.onCategoryChipClick('Other');
    expect(component.availableSpecies).toEqual([]);
  });

  // categoryColor
  it('categoryColor() returns the correct color for Bird', () => {
    expect(component.categoryColor('Bird')).toBe('#1E88E5');
  });

  it('categoryColor() falls back to Other color for unknown category', () => {
    expect(component.categoryColor('UnknownCategory')).toBe('#757575');
  });

  // openSightingForm / closeSightingForm
  it('openSightingForm() shows the modal and sets coordinates', () => {
    component.openSightingForm(29.64, -82.35, 'UF Campus');
    expect(component.showSightingForm()).toBe(true);
    expect(component.sighting().latitude).toBe(29.64);
    expect(component.sighting().longitude).toBe(-82.35);
    expect(component.sighting().address).toBe('UF Campus');
  });

  it('closeSightingForm() hides the modal', () => {
    component.openSightingForm(29.64, -82.35, 'UF Campus');
    component.closeSightingForm();
    expect(component.showSightingForm()).toBe(false);
  });

  // updateField
  it('updateField() updates a single field without affecting others', () => {
    component.openSightingForm(29.64, -82.35, 'UF Campus');
    component.updateField('quantity', 5);
    expect(component.sighting().quantity).toBe(5);
    expect(component.sighting().address).toBe('UF Campus'); // unchanged
  });

  // removePhoto
  it('removePhoto() clears photoPreview and photoFile', () => {
    component.photoPreview.set('data:image/png;base64,...');
    component.removePhoto();
    expect(component.photoPreview()).toBeNull();
    expect(component.photoFile()).toBeNull();
  });

  // clearSearch
  it('clearSearch() resets query, results, and search state', () => {
    component.query.set('gator pond');
    component.showResults.set(true);
    component.searchError.set('No results found.');

    component.clearSearch();

    expect(component.query()).toBe('');
    expect(component.showResults()).toBe(false);
    expect(component.searchError()).toBe('');
  });

  // ── openAddFriendPopup / closeAddFriendPopup ─────────────────────────────

  it('openAddFriendPopup() sets addFriendTarget when user is logged in', () => {
    component.openAddFriendPopup('Bob');
    expect(component.addFriendTarget()).toBe('Bob');
    expect(component.addFriendStatus()).toBe('idle');
  });

  it('openAddFriendPopup() does nothing when clicking own username', () => {
    component.openAddFriendPopup('Gator'); // same as authServiceStub username
    expect(component.addFriendTarget()).toBeNull();
  });

  it('openAddFriendPopup() shows login prompt when user is not logged in', () => {
    authCurrentUser = null;
    component.openAddFriendPopup('Bob');
    expect(component.addFriendTarget()).toBeNull();
    expect(component.loginRequired()).toBe(true);
  });

  it('closeAddFriendPopup() clears target, status, and error', () => {
    component.openAddFriendPopup('Bob');
    component.addFriendError.set('some error');
    component.addFriendStatus.set('error');

    component.closeAddFriendPopup();

    expect(component.addFriendTarget()).toBeNull();
    expect(component.addFriendStatus()).toBe('idle');
    expect(component.addFriendError()).toBe('');
  });

  // ── confirmAddFriend ─────────────────────────────────────────────────────

  it('confirmAddFriend() sets status to success on successful request', async () => {
    component.openAddFriendPopup('Bob');
    await component.confirmAddFriend();
    expect(component.addFriendStatus()).toBe('success');
  });

  it('confirmAddFriend() sets status to already when error contains "already"', async () => {
    (friendServiceStub.sendFriendRequest as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('already friends')
    );
    component.openAddFriendPopup('Bob');
    await component.confirmAddFriend();
    expect(component.addFriendStatus()).toBe('already');
  });

  it('confirmAddFriend() sets status to error on generic failure', async () => {
    (friendServiceStub.sendFriendRequest as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network timeout')
    );
    component.openAddFriendPopup('Bob');
    await component.confirmAddFriend();
    expect(component.addFriendStatus()).toBe('error');
    expect(component.addFriendError()).toBe('Network timeout');
  });

  it('confirmAddFriend() does nothing when no target is set', async () => {
    await component.confirmAddFriend();
    expect(friendServiceStub.sendFriendRequest).not.toHaveBeenCalled();
  });

  // ── isCommentOwner ────────────────────────────────────────────────────────

  it('isCommentOwner() returns true when comment sender matches current user', () => {
    const comment = { ID: 1, SightingID: 1, Sender: 'Gator', Content: 'Nice!', CreateTime: '' };
    expect(component.isCommentOwner(comment)).toBe(true);
  });

  it('isCommentOwner() returns false when comment sender is a different user', () => {
    const comment = { ID: 2, SightingID: 1, Sender: 'Bob', Content: 'Cool!', CreateTime: '' };
    expect(component.isCommentOwner(comment)).toBe(false);
  });

  it('isCommentOwner() returns false when no user is logged in', () => {
    authCurrentUser = null;
    const comment = { ID: 3, SightingID: 1, Sender: 'Gator', Content: '...', CreateTime: '' };
    expect(component.isCommentOwner(comment)).toBe(false);
  });

  // ── deleteComment ────────────────────────────────────────────────────────

  it('deleteComment() removes the comment from the local list after success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as unknown as Response);
    component.comments.set([
      { ID: 10, SightingID: 1, Sender: 'Gator', Content: 'Hello', CreateTime: '' },
      { ID: 11, SightingID: 1, Sender: 'Bob', Content: 'World', CreateTime: '' },
    ]);

    await component.deleteComment(10);

    expect(component.comments()).toHaveLength(1);
    expect(component.comments()[0].ID).toBe(11);
  });

  it('deleteComment() logs error and does not crash on network failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    component.comments.set([
      { ID: 10, SightingID: 1, Sender: 'Gator', Content: 'Hello', CreateTime: '' },
    ]);

    await expect(component.deleteComment(10)).resolves.not.toThrow();
    expect(component.comments()).toHaveLength(1); // unchanged on error
  });

  // ── formatCommentTime ────────────────────────────────────────────────────

  it('formatCommentTime() returns "just now" for very recent timestamps', () => {
    const now = new Date().toISOString();
    expect(component.formatCommentTime(now)).toBe('just now');
  });

  it('formatCommentTime() returns minutes ago for timestamps under 1 hour', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(component.formatCommentTime(fiveMinAgo)).toBe('5m ago');
  });

  it('formatCommentTime() returns hours ago for timestamps under 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(component.formatCommentTime(twoHoursAgo)).toBe('2h ago');
  });

  it('formatCommentTime() returns days ago for timestamps under 7 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(component.formatCommentTime(threeDaysAgo)).toBe('3d ago');
  });

  it('formatCommentTime() returns empty string for empty input', () => {
    expect(component.formatCommentTime('')).toBe('');
  });
});

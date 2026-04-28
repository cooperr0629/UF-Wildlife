import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileComponent } from './profile';
import { AuthService } from '../auth.service';
import { SightingService } from '../sighting.service';
import { FriendService } from '../friend.service';

// ── Stubs ────────────────────────────────────────────────────────────────────
let currentUser: { id: string; username: string; email: string; role: string; avatarUrl: string | null } | null = {
  id: '1',
  username: 'Gator',
  email: 'gator@ufl.edu',
  role: 'Student',
  avatarUrl: null,
};

const authServiceStub = {
  currentUser: () => currentUser,
  isLoggedIn: () => currentUser !== null,
  updateProfile: vi.fn(),
  logout: vi.fn(),
};

const sightingServiceStub = {
  sightingsByUser: vi.fn().mockReturnValue([]),
  sightings: () => [],
  update: vi.fn(),
  remove: vi.fn(),
  changePassword: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
};

const friendServiceStub = {
  getFriends: vi.fn().mockResolvedValue([]),
  getFriendRequests: vi.fn().mockResolvedValue([]),
  acceptRequest: vi.fn().mockResolvedValue(undefined),
  declineRequest: vi.fn().mockResolvedValue(undefined),
  removeFriend: vi.fn().mockResolvedValue(undefined),
};

describe('ProfileComponent', () => {
  let component: ProfileComponent;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    currentUser = {
      id: '1',
      username: 'Gator',
      email: 'gator@ufl.edu',
      role: 'Student',
      avatarUrl: null,
    };

    // Reset call histories on each test
    Object.values(authServiceStub).forEach((v) => {
      if (typeof v === 'function' && 'mockClear' in v) (v as any).mockClear();
    });
    Object.values(sightingServiceStub).forEach((v) => {
      if (typeof v === 'function' && 'mockClear' in v) (v as any).mockClear();
    });
    Object.values(friendServiceStub).forEach((v) => {
      if (typeof v === 'function' && 'mockClear' in v) (v as any).mockClear();
    });

    sightingServiceStub.sightingsByUser.mockReturnValue([]);
    sightingServiceStub.changePassword.mockResolvedValue({ success: true, message: 'ok' });
    friendServiceStub.getFriends.mockResolvedValue([]);
    friendServiceStub.getFriendRequests.mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceStub },
        { provide: SightingService, useValue: sightingServiceStub },
        { provide: FriendService, useValue: friendServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.restoreAllMocks();
  });

  // ── Edit profile ────────────────────────────────────────────────────────

  it('startEditProfile() populates editForm from current user', () => {
    component.startEditProfile();
    expect(component.editMode()).toBe(true);
    expect(component.editForm()).toEqual({
      username: 'Gator',
      email: 'gator@ufl.edu',
      role: 'Student',
    });
  });

  it('cancelEditProfile() clears edit state and avatar preview', () => {
    component.startEditProfile();
    component.avatarPreview.set('data:image/png;base64,abc');
    component.cancelEditProfile();
    expect(component.editMode()).toBe(false);
    expect(component.avatarPreview()).toBeNull();
  });

  it('saveProfile() calls authService.updateProfile with form values and exits edit mode', () => {
    component.startEditProfile();
    component.updateEditForm('username', 'Updated');
    component.updateEditForm('role', 'Faculty');
    component.avatarPreview.set('data:image/png;base64,xyz');

    component.saveProfile();

    expect(authServiceStub.updateProfile).toHaveBeenCalledWith({
      username: 'Updated',
      email: 'gator@ufl.edu',
      role: 'Faculty',
      avatarUrl: 'data:image/png;base64,xyz',
    });
    expect(component.editMode()).toBe(false);
  });

  it('updateEditForm() updates a single field without affecting others', () => {
    component.startEditProfile();
    component.updateEditForm('email', 'new@ufl.edu');
    expect(component.editForm().email).toBe('new@ufl.edu');
    expect(component.editForm().username).toBe('Gator');
  });

  // ── categoryColor ────────────────────────────────────────────────────────

  it('categoryColor() returns the mapped color for known category', () => {
    expect(component.categoryColor('Bird')).toBe('#1E88E5');
  });

  it('categoryColor() falls back to Other color for unknown category', () => {
    expect(component.categoryColor('UnknownCategory')).toBe('#757575');
  });

  // ── Sighting editing ────────────────────────────────────────────────────

  it('startEditSighting() loads form from sighting and sets editId', () => {
    const sighting = {
      id: 'sx',
      userId: '1',
      username: 'Gator',
      latitude: 0,
      longitude: 0,
      address: '',
      animalName: 'Raccoon',
      category: 'Mammal',
      quantity: 2,
      behavior: 'Feeding',
      description: 'Trash bin',
      date: '2025-01-01',
      time: '08:00',
      photoUrl: null,
    };
    component.startEditSighting(sighting);
    expect(component.editSightingId()).toBe('sx');
    expect(component.editSightingForm().animalName).toBe('Raccoon');
    expect(component.editSightingForm().quantity).toBe(2);
  });

  it('cancelEditSighting() clears editSightingId', () => {
    component.editSightingId.set('sx');
    component.cancelEditSighting();
    expect(component.editSightingId()).toBeNull();
  });

  it('saveEditSighting() calls sightingService.update and clears editId', () => {
    component.editSightingId.set('s1');
    component.editSightingForm.set({ animalName: 'Updated', quantity: 3 });
    component.saveEditSighting();
    expect(sightingServiceStub.update).toHaveBeenCalledWith('s1', {
      animalName: 'Updated',
      quantity: 3,
    });
    expect(component.editSightingId()).toBeNull();
  });

  it('saveEditSighting() does nothing when editSightingId is null', () => {
    component.editSightingId.set(null);
    component.saveEditSighting();
    expect(sightingServiceStub.update).not.toHaveBeenCalled();
  });

  it('updateSightingField() updates a single field', () => {
    component.editSightingForm.set({ animalName: 'Raccoon', quantity: 1 });
    component.updateSightingField('quantity', 5);
    expect(component.editSightingForm().quantity).toBe(5);
    expect(component.editSightingForm().animalName).toBe('Raccoon');
  });

  // ── Delete confirmation ─────────────────────────────────────────────────

  it('requestDelete() sets confirmDeleteId', () => {
    component.requestDelete('s2');
    expect(component.confirmDeleteId()).toBe('s2');
  });

  it('cancelDelete() clears confirmDeleteId', () => {
    component.confirmDeleteId.set('s2');
    component.cancelDelete();
    expect(component.confirmDeleteId()).toBeNull();
  });

  it('confirmDelete() calls sightingService.remove and clears confirmId', () => {
    component.confirmDelete('s3');
    expect(sightingServiceStub.remove).toHaveBeenCalledWith('s3');
    expect(component.confirmDeleteId()).toBeNull();
  });

  // ── Change password ─────────────────────────────────────────────────────

  it('toggleChangePassword() opens the panel and clears all fields', () => {
    component.oldPassword.set('something');
    component.newPassword.set('Newpass1');
    component.confirmNewPassword.set('Newpass1');
    component.changePasswordError.set('err');
    component.changePasswordSuccess.set('ok');

    component.toggleChangePassword();

    expect(component.showChangePassword()).toBe(true);
    expect(component.oldPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
    expect(component.changePasswordError()).toBe('');
    expect(component.changePasswordSuccess()).toBe('');
  });

  it('savePassword() shows error when new passwords do not match', async () => {
    component.oldPassword.set('Oldpass1');
    component.newPassword.set('Newpass1');
    component.confirmNewPassword.set('Different1');
    await component.savePassword();
    expect(component.changePasswordError()).toBe('New passwords do not match.');
    expect(sightingServiceStub.changePassword).not.toHaveBeenCalled();
  });

  it('savePassword() shows error when new password is too short', async () => {
    component.oldPassword.set('Oldpass1');
    component.newPassword.set('Short1');
    component.confirmNewPassword.set('Short1');
    await component.savePassword();
    expect(component.changePasswordError()).toBe('Password must be at least 8 characters.');
    expect(sightingServiceStub.changePassword).not.toHaveBeenCalled();
  });

  it('savePassword() shows success message and clears fields on backend success', async () => {
    sightingServiceStub.changePassword.mockResolvedValue({ success: true, message: '' });
    component.oldPassword.set('Oldpass1');
    component.newPassword.set('Newpass12');
    component.confirmNewPassword.set('Newpass12');

    await component.savePassword();

    expect(sightingServiceStub.changePassword).toHaveBeenCalledWith(1, 'Oldpass1', 'Newpass12');
    expect(component.changePasswordSuccess()).toBe('Password changed successfully!');
    expect(component.oldPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmNewPassword()).toBe('');
  });

  it('savePassword() shows backend error message on failure', async () => {
    sightingServiceStub.changePassword.mockResolvedValue({
      success: false,
      message: 'Old password incorrect',
    });
    component.oldPassword.set('Wrongpass1');
    component.newPassword.set('Newpass12');
    component.confirmNewPassword.set('Newpass12');

    await component.savePassword();

    expect(component.changePasswordError()).toBe('Old password incorrect');
    expect(component.changePasswordSuccess()).toBe('');
  });

  it('savePassword() does nothing when no user is logged in', async () => {
    currentUser = null;
    await component.savePassword();
    expect(sightingServiceStub.changePassword).not.toHaveBeenCalled();
  });

  // ── Friends / chat ──────────────────────────────────────────────────────

  it('openChat() sets chatFriend with id and name from friend record', () => {
    component.openChat({
      friendship_id: 10,
      friend_id: 99,
      username: 'Bob',
    } as any);
    expect(component.chatFriend()).toEqual({ id: 99, name: 'Bob' });
  });

  it('closeChat() clears chatFriend', () => {
    component.chatFriend.set({ id: 99, name: 'Bob' });
    component.closeChat();
    expect(component.chatFriend()).toBeNull();
  });

  it('acceptRequest() calls friendService.acceptRequest with current user id', async () => {
    await component.acceptRequest({ id: 5 } as any);
    expect(friendServiceStub.acceptRequest).toHaveBeenCalledWith(5, '1');
  });

  it('declineRequest() calls friendService.declineRequest with current user id', async () => {
    await component.declineRequest({ id: 7 } as any);
    expect(friendServiceStub.declineRequest).toHaveBeenCalledWith(7, '1');
  });

  it('removeFriend() calls friendService.removeFriend with current user id and friendship id', async () => {
    await component.removeFriend({ friendship_id: 22, friend_id: 33, username: 'Bob' } as any);
    expect(friendServiceStub.removeFriend).toHaveBeenCalledWith('1', 22);
  });

  it('acceptRequest() does nothing when no user is logged in', async () => {
    currentUser = null;
    await component.acceptRequest({ id: 5 } as any);
    expect(friendServiceStub.acceptRequest).not.toHaveBeenCalled();
  });

  // ── Stats ───────────────────────────────────────────────────────────────

  it('stats computes totals across multiple sightings', () => {
    sightingServiceStub.sightingsByUser.mockReturnValue([
      {
        id: '1', userId: '1', username: 'Gator',
        latitude: 0, longitude: 0, address: 'A', animalName: 'Raccoon',
        category: 'Mammal', quantity: 1, behavior: '', description: '',
        date: '2025-01-01', time: '09:00', photoUrl: null,
      },
      {
        id: '2', userId: '1', username: 'Gator',
        latitude: 0, longitude: 0, address: 'B', animalName: 'Raccoon',
        category: 'Mammal', quantity: 1, behavior: '', description: '',
        date: '2025-01-02', time: '09:00', photoUrl: null,
      },
      {
        id: '3', userId: '1', username: 'Gator',
        latitude: 0, longitude: 0, address: 'C', animalName: 'Osprey',
        category: 'Bird', quantity: 1, behavior: '', description: '',
        date: '2025-01-03', time: '09:00', photoUrl: null,
      },
    ]);
    const s = component.stats();
    expect(s.total).toBe(3);
    expect(s.uniqueSpecies).toBe(2);
    expect(s.uniqueLocations).toBe(3);
    expect(s.topCategory).toBe('Mammal');
  });

  it('stats returns N/A topCategory when no sightings', () => {
    sightingServiceStub.sightingsByUser.mockReturnValue([]);
    expect(component.stats().topCategory).toBe('N/A');
    expect(component.stats().total).toBe(0);
  });

  // ── logout ──────────────────────────────────────────────────────────────

  it('logout() delegates to authService.logout()', () => {
    component.logout();
    expect(authServiceStub.logout).toHaveBeenCalled();
  });
});

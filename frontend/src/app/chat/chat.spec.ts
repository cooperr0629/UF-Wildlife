import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatComponent } from './chat';
import { FriendService, DirectMessage } from '../friend.service';
import { AuthService } from '../auth.service';

// ── Stubs ────────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: 1,
    sender_id: 1,
    sender_name: 'Me',
    receiver_id: 2,
    content: 'Hello',
    created_at: '2025-06-01T10:00:00Z',
    ...overrides,
  };
}

const friendServiceStub = {
  getMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn().mockResolvedValue(undefined),
};

const authServiceStub = {
  currentUser: () => ({ id: '1', username: 'Gator' }),
};

// ── Suite ────────────────────────────────────────────────────────────────────

describe('ChatComponent', () => {
  let component: ChatComponent;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (friendServiceStub.getMessages as ReturnType<typeof vi.fn>)
      .mockClear()
      .mockResolvedValue([]);
    (friendServiceStub.sendMessage as ReturnType<typeof vi.fn>)
      .mockClear()
      .mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        { provide: FriendService, useValue: friendServiceStub },
        { provide: AuthService, useValue: authServiceStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    component.friendId = 2;
    component.friendName = 'Bob';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── isMine ────────────────────────────────────────────────────────────────

  it('isMine() returns true when sender_id matches current user id', () => {
    const msg = makeMessage({ sender_id: 1 });
    expect(component.isMine(msg)).toBe(true);
  });

  it('isMine() returns false when sender_id is a different user', () => {
    const msg = makeMessage({ sender_id: 99 });
    expect(component.isMine(msg)).toBe(false);
  });

  // ── formatTime ────────────────────────────────────────────────────────────

  it('formatTime() returns HH:MM string from ISO timestamp', () => {
    // Use a fixed UTC timestamp: 2025-06-01T14:30:00Z
    const result = component.formatTime('2025-06-01T14:30:00Z');
    // Timezone may shift the displayed time, so just verify HH:MM format
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('formatTime() returns a valid time string for midnight UTC', () => {
    const result = component.formatTime('2025-01-15T00:00:00Z');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  // ── currentUserId ─────────────────────────────────────────────────────────

  it('currentUserId returns the authenticated user id', () => {
    expect(component.currentUserId).toBe('1');
  });

  // ── ngOnInit ──────────────────────────────────────────────────────────────

  it('ngOnInit() calls getMessages and sets isLoading to false', async () => {
    const msgs = [makeMessage({ id: 1, content: 'Hi' })];
    (friendServiceStub.getMessages as ReturnType<typeof vi.fn>).mockResolvedValue(msgs);

    await component.ngOnInit();

    expect(component.messages()).toHaveLength(1);
    expect(component.messages()[0].content).toBe('Hi');
    expect(component.isLoading()).toBe(false);
  });

  it('ngOnInit() sets messages to empty array when getMessages returns empty', async () => {
    (friendServiceStub.getMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await component.ngOnInit();
    expect(component.messages()).toEqual([]);
    expect(component.isLoading()).toBe(false);
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────

  it('ngOnDestroy() clears the polling interval without errors', async () => {
    await component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  it('sendMessage() calls friendService.sendMessage with correct args', async () => {
    await component.ngOnInit();
    component.inputText.set('Hello Bob!');

    await component.sendMessage();

    expect(friendServiceStub.sendMessage).toHaveBeenCalledWith('1', 2, 'Hello Bob!');
  });

  it('sendMessage() clears input after sending', async () => {
    await component.ngOnInit();
    component.inputText.set('Test message');

    await component.sendMessage();

    expect(component.inputText()).toBe('');
  });

  it('sendMessage() does nothing when input is empty or whitespace', async () => {
    await component.ngOnInit();
    component.inputText.set('   ');

    await component.sendMessage();

    expect(friendServiceStub.sendMessage).not.toHaveBeenCalled();
  });

  it('sendMessage() does nothing when already sending', async () => {
    await component.ngOnInit();
    // reset call count from ngOnInit's internal getMessages chain
    (friendServiceStub.sendMessage as ReturnType<typeof vi.fn>).mockClear();

    component.inputText.set('Hello');
    component.isSending.set(true);

    await component.sendMessage();

    expect(friendServiceStub.sendMessage).not.toHaveBeenCalled();
  });

  it('sendMessage() resets isSending to false after completion', async () => {
    await component.ngOnInit();
    component.inputText.set('Hi!');

    await component.sendMessage();

    expect(component.isSending()).toBe(false);
  });

  it('sendMessage() resets isSending to false even when sendMessage throws', async () => {
    (friendServiceStub.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );
    await component.ngOnInit();
    component.inputText.set('Hi!');

    // sendMessage() propagates the rejection but the finally block still resets isSending
    await component.sendMessage().catch(() => {});
    expect(component.isSending()).toBe(false);
  });
});

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  signal,
  inject,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FriendService, DirectMessage } from '../friend.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() friendId!: number;
  @Input() friendName!: string;
  @Output() close = new EventEmitter<void>();

  @ViewChild('messageList') private messageList!: ElementRef<HTMLDivElement>;

  private friendService = inject(FriendService);
  private authService = inject(AuthService);

  messages = signal<DirectMessage[]>([]);
  inputText = signal('');
  isSending = signal(false);
  isLoading = signal(true);

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private shouldScrollToBottom = false;

  get currentUserId(): string {
    return this.authService.currentUser()?.id ?? '';
  }

  async ngOnInit() {
    await this.loadMessages();
    this.isLoading.set(false);
    this.shouldScrollToBottom = true;
    // Poll for new messages every 3 seconds
    this.pollInterval = setInterval(() => this.pollMessages(), 3000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private async loadMessages() {
    const msgs = await this.friendService.getMessages(this.currentUserId, this.friendId);
    this.messages.set(msgs);
  }

  private async pollMessages() {
    const msgs = await this.friendService.getMessages(this.currentUserId, this.friendId);
    const prev = this.messages();
    if (msgs.length !== prev.length) {
      this.messages.set(msgs);
      this.shouldScrollToBottom = true;
    }
  }

  async sendMessage() {
    const content = this.inputText().trim();
    if (!content || this.isSending()) return;
    this.isSending.set(true);
    try {
      await this.friendService.sendMessage(this.currentUserId, this.friendId, content);
      this.inputText.set('');
      await this.loadMessages();
      this.shouldScrollToBottom = true;
    } finally {
      this.isSending.set(false);
    }
  }

  isMine(msg: DirectMessage): boolean {
    return String(msg.sender_id) === this.currentUserId;
  }

  formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private scrollToBottom() {
    try {
      if (this.messageList?.nativeElement) {
        this.messageList.nativeElement.scrollTop = this.messageList.nativeElement.scrollHeight;
      }
    } catch {}
  }
}

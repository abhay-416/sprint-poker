import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RoomService } from '../../core/services/room.service';
import { Participant } from '../../core/models/room.model';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './room.component.html',
  styles: [`
    /* Custom CSS for exact voting card dimensions and glow animations */
    .poker-card {
      width: 90px;
      height: 160px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.25rem; /* text-4xl */
      font-weight: 700;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      user-select: none;
    }
    
    .poker-card:hover {
      transform: translateY(-5px) scale(1.05);
      border-color: #11D8FF;
      box-shadow: 0 0 15px rgba(17, 216, 255, 0.3);
    }
    
    .poker-card-selected, .poker-card-selected:hover {
      background-color: #11D8FF;
      color: #001C4A;
      box-shadow: 0 0 25px rgba(17, 216, 255, 0.6);
      transform: translateY(-8px) scale(1.05) !important;
      border-color: #11D8FF;
    }
  `]
})
export class RoomComponent implements OnInit, OnDestroy {
  public roomService = inject(RoomService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  public roomId = signal<string>('');
  public showJoinOverlay = signal<boolean>(false);
  public joinForm!: FormGroup;
  public linkCopied = signal<boolean>(false);

  // Card deck choices
  public cardDeck = ['1', '2', '3', '5', '8', '13', '21', '?'];

  // Safe signals shortcut
  public currentRoom = this.roomService.currentRoom;
  public participants = this.roomService.participants;
  public currentUser = this.roomService.currentUser;
  public votes = this.roomService.votes;
  public revealed = this.roomService.revealed;
  public stats = this.roomService.stats;

  // Calculate vote progress string (excluding the facilitator since they are scrum master)
  public voteProgress = computed(() => {
    const room = this.currentRoom();
    if (!room) return '0 of 0 Voted';
    
    const facilitatorId = room.facilitatorId;
    const excludeFacilitator = !room.facilitatorVotes;
    
    // Total voters
    const total = this.participants().filter(p => !excludeFacilitator || p.id !== facilitatorId).length;
    
    // Voted count
    const votedCount = Object.keys(this.votes()).filter(uid => {
      const isPart = this.participants().some(p => p.id === uid);
      if (!isPart) return false;
      if (excludeFacilitator && uid === facilitatorId) return false;
      const v = this.votes()[uid];
      return v !== null && v !== undefined && v !== '';
    }).length;
    
    return `${votedCount} of ${total} Voted`;
  });

  constructor() {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('roomId');
    if (!id) {
      this.router.navigate(['/']);
      return;
    }
    this.roomId.set(id.toUpperCase());

    // Check if user is already registered in this room (page refresh support)
    this.roomService.loading.set(true);
    this.roomService.checkParticipantRegistered(this.roomId()).then((registeredName) => {
      this.roomService.loading.set(true); // set loading during actual join
      if (registeredName) {
        // Auto-join if already registered
        this.joinRoomSession(registeredName);
      } else {
        this.roomService.loading.set(false);
        this.showJoinOverlay.set(true);
        const savedName = localStorage.getItem('tr_poker_user_name') || '';
        this.initJoinForm(savedName);
      }
    }).catch((err) => {
      console.error('Registration check failed:', err);
      this.roomService.loading.set(false);
      this.showJoinOverlay.set(true);
      const savedName = localStorage.getItem('tr_poker_user_name') || '';
      this.initJoinForm(savedName);
    });
  }

  ngOnDestroy(): void {
    // We clean up when navigating away
    this.roomService.leaveRoom();
  }

  private initJoinForm(initialName: string) {
    this.joinForm = this.fb.group({
      name: [initialName, [Validators.required, Validators.minLength(1)]]
    });
  }

  async onOverlaySubmit() {
    if (this.joinForm.invalid) return;

    const { name } = this.joinForm.value;
    try {
      await this.roomService.joinRoom(this.roomId(), name);
      localStorage.setItem('tr_poker_user_name', name);
      this.showJoinOverlay.set(false);
    } catch (err) {
      console.error('Failed to join:', err);
    }
  }

  private async joinRoomSession(name: string) {
    try {
      await this.roomService.joinRoom(this.roomId(), name);
    } catch (err) {
      // If room not found or join failed, redirect or show join form again
      console.error(err);
      this.showJoinOverlay.set(true);
      this.initJoinForm(name);
    }
  }

  /**
   * Cast a vote by choosing a card
   */
  async selectCard(value: string) {
    // If cards are already revealed, we don't block voting (users can change votes),
    // but standard scrum poker resets or allows vote changes.
    // If they change vote, it behaves like changing vote.
    // Let's check if the user is currently voting the same card, if so, toggle/clear it.
    const currentMyVote = this.votes()[this.currentUser()?.id || ''];
    if (currentMyVote === value) {
      await this.roomService.submitVote('');
    } else {
      await this.roomService.submitVote(value);
    }
  }

  /**
   * Revealed action (only facilitator should trigger or any user based on preference)
   * The prompt says: "Reveal Cards Button" in top bar or stats.
   */
  async onReveal() {
    if (!this.currentUser()?.isFacilitator) return;
    await this.roomService.revealCards();
  }

  /**
   * Reset round (yellow button)
   */
  async onNewRound() {
    if (!this.currentUser()?.isFacilitator) return;
    await this.roomService.resetRound();
  }

  /**
   * Copy room URL to clipboard
   */
  copyRoomLink() {
    const url = window.location.origin + '/room/' + this.roomId();
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  /**
   * Return initials for avatars
   */
  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  /**
   * Safe leave room
   */
  onLeave() {
    this.roomService.leaveRoom();
  }
}

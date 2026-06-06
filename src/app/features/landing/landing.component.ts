import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { RoomService } from '../../core/services/room.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <!-- Title & Header -->
      <div class="text-center mb-8">
        <h1 class="text-5xl font-extrabold text-accent tracking-tight mb-2">SprintPoker</h1>
        <p class="text-secondaryText text-lg">Real-Time Agile Estimation</p>
      </div>

      <!-- Main Card Container -->
      <div class="w-full max-w-md bg-surface border border-border rounded-large shadow-2xl p-8 transition-all duration-300">
        <!-- Tabs -->
        <div class="flex bg-[#051e44] p-1.5 rounded-button mb-8">
          <button 
            type="button"
            class="flex-1 py-3 text-center font-semibold text-sm rounded-button transition-all duration-300"
            [ngClass]="activeTab() === 'join' ? 'bg-card text-accent shadow-md' : 'text-secondaryText hover:text-white'"
            (click)="activeTab.set('join')">
            Join Room
          </button>
          <button 
            type="button"
            class="flex-1 py-3 text-center font-semibold text-sm rounded-button transition-all duration-300"
            [ngClass]="activeTab() === 'create' ? 'bg-card text-accent shadow-md' : 'text-secondaryText hover:text-white'"
            (click)="activeTab.set('create')">
            New Room
          </button>
        </div>

        <!-- Error Message Banner -->
        @if (roomService.error(); as errMsg) {
          <div class="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-3 rounded-button mb-6">
            {{ errMsg }}
          </div>
        }

        <!-- JOIN ROOM FORM -->
        @if (activeTab() === 'join') {
          <form [formGroup]="joinForm" (ngSubmit)="onJoinSubmit()" class="space-y-6">
            <div>
              <h2 class="text-2xl font-bold text-white mb-2">Join a Session</h2>
              <p class="text-secondaryText text-sm mb-6">Enter your name and room code to join your team's estimation session.</p>
            </div>

            <div class="space-y-2">
              <label for="join-name" class="block text-sm font-medium text-secondaryText">Your Name</label>
              <input 
                id="join-name"
                type="text" 
                formControlName="name"
                placeholder="e.g. Alex"
                class="w-full bg-[#051c3f] border border-border rounded-button px-4 py-3 text-white placeholder-secondaryText/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
              />
              @if (joinForm.get('name')?.touched && joinForm.get('name')?.invalid) {
                <span class="text-red-400 text-xs">Name is required.</span>
              }
            </div>

            <div class="space-y-2">
              <label for="join-code" class="block text-sm font-medium text-secondaryText">Room Code</label>
              <input 
                id="join-code"
                type="text" 
                formControlName="code"
                placeholder="e.g. 7NSPEC"
                class="w-full bg-[#051c3f] border border-border rounded-button px-4 py-3 text-white placeholder-secondaryText/40 uppercase focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
              />
              @if (joinForm.get('code')?.touched && joinForm.get('code')?.invalid) {
                <span class="text-red-400 text-xs">Room code is required (6 characters).</span>
              }
            </div>

            <button 
              type="submit" 
              [disabled]="joinForm.invalid || roomService.loading()"
              class="w-full bg-accent hover:bg-accent/85 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-[#001C4A] font-bold py-3.5 px-4 rounded-button transition-all duration-200 shadow-lg shadow-accent/10 mt-4">
              @if (roomService.loading()) {
                <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[#001C4A] border-t-transparent mr-2"></span>
                Joining...
              } @else {
                Join Table
              }
            </button>
          </form>
        }

        <!-- NEW ROOM FORM -->
        @if (activeTab() === 'create') {
          <form [formGroup]="createForm" (ngSubmit)="onCreateSubmit()" class="space-y-6">
            <div>
              <h2 class="text-2xl font-bold text-white mb-2">Host a Session</h2>
              <p class="text-secondaryText text-sm mb-6">Create a new estimation table for your team.</p>
            </div>

            <div class="space-y-2">
              <label for="create-name" class="block text-sm font-medium text-secondaryText">Facilitator Name</label>
              <input 
                id="create-name"
                type="text" 
                formControlName="facilitatorName"
                placeholder="e.g. Alex"
                class="w-full bg-[#051c3f] border border-border rounded-button px-4 py-3 text-white placeholder-secondaryText/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
              />
              @if (createForm.get('facilitatorName')?.touched && createForm.get('facilitatorName')?.invalid) {
                <span class="text-red-400 text-xs">Facilitator name is required.</span>
              }
            </div>

            <div class="space-y-2">
              <label for="session-name" class="block text-sm font-medium text-secondaryText">Sprint Name</label>
              <input 
                id="session-name"
                type="text" 
                formControlName="sessionName"
                placeholder="e.g. Sprint 42 Planning"
                class="w-full bg-[#051c3f] border border-border rounded-button px-4 py-3 text-white placeholder-secondaryText/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
              />
              @if (createForm.get('sessionName')?.touched && createForm.get('sessionName')?.invalid) {
                <span class="text-red-400 text-xs">Session name is required.</span>
              }
            </div>

            <!-- Participate in Voting Checkbox -->
            <div class="flex items-center space-x-3 py-1">
              <label class="flex items-center gap-3 cursor-pointer group">
                <div class="relative flex items-center justify-center">
                  <input 
                    id="participate-voting"
                    type="checkbox" 
                    formControlName="participateInVoting"
                    class="peer sr-only"
                  />
                  <div class="w-6 h-6 border border-border rounded bg-[#051c3f] peer-checked:bg-accent peer-checked:border-accent flex items-center justify-center transition-all duration-200 group-hover:border-accent">
                    <svg class="w-4 h-4 text-[#001C4A] hidden peer-checked:block stroke-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span class="text-sm font-semibold text-secondaryText group-hover:text-white transition-colors">Participate in Voting</span>
              </label>
            </div>

            <button 
              type="submit" 
              [disabled]="createForm.invalid || roomService.loading()"
              class="w-full bg-accent hover:bg-accent/85 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-[#001C4A] font-bold py-3.5 px-4 rounded-button transition-all duration-200 shadow-lg shadow-accent/10 mt-4">
              @if (roomService.loading()) {
                <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[#001C4A] border-t-transparent mr-2"></span>
                Creating...
              } @else {
                Create Table
              }
            </button>
          </form>
        }
      </div>
      

    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class LandingComponent implements OnInit {
  public activeTab = signal<'join' | 'create'>('join');
  public joinForm!: FormGroup;
  public createForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public roomService: RoomService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check local storage for previously used names
    const savedName = localStorage.getItem('tr_poker_user_name') || '';

    // Initialize forms
    this.joinForm = this.fb.group({
      name: [savedName, [Validators.required, Validators.minLength(1)]],
      code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(10)]]
    });

    this.createForm = this.fb.group({
      facilitatorName: [savedName, [Validators.required, Validators.minLength(1)]],
      sessionName: ['', [Validators.required, Validators.minLength(3)]],
      participateInVoting: [true]
    });

    // Check if room code was passed via URL parameter (e.g. ?room=7NSPEC)
    this.route.queryParams.subscribe(params => {
      if (params['room']) {
        this.joinForm.patchValue({ code: params['room'] });
        this.activeTab.set('join');
      }
    });
  }

  async onJoinSubmit() {
    if (this.joinForm.invalid) return;

    const { name, code } = this.joinForm.value;
    try {
      localStorage.setItem('tr_poker_user_name', name);
      await this.roomService.joinRoom(code, name);
      this.router.navigate(['/room', code.toUpperCase()]);
    } catch (err) {
      console.error(err);
    }
  }

  async onCreateSubmit() {
    if (this.createForm.invalid) return;

    const { facilitatorName, sessionName, participateInVoting } = this.createForm.value;
    try {
      localStorage.setItem('tr_poker_user_name', facilitatorName);
      const roomId = await this.roomService.createRoom(facilitatorName, sessionName, participateInVoting);
      await this.roomService.joinRoom(roomId, facilitatorName);
      this.router.navigate(['/room', roomId]);
    } catch (err) {
      console.error(err);
    }
  }
}

import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ref, set, onValue, update, onDisconnect, Unsubscribe } from 'firebase/database';
import { collection, addDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { Room, Participant, VoteStats } from '../models/room.model';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  // Signals for application state
  public currentRoom = signal<Room | null>(null);
  public currentUser = signal<Participant | null>(null);
  public participants = signal<Participant[]>([]);
  public votes = signal<{ [userId: string]: string }>({});
  public revealed = signal<boolean>(false);
  public loading = signal<boolean>(false);
  public error = signal<string | null>(null);
  public isMockMode = signal<boolean>(true);

  // Firestore & RTDB reference listeners
  private roomListenerUnsubscribe: Unsubscribe | null = null;
  private connectionListenerUnsubscribe: Unsubscribe | null = null;

  // Active state variables
  private currentUserId: string = '';
  private currentRoomId: string = '';

  // Mock Mode Internal State
  private mockInterval: any = null;

  // Computed state for stats
  public stats = computed<VoteStats | null>(() => {
    if (!this.revealed()) return null;
    
    const room = this.currentRoom();
    if (!room) return null;
    
    const facilitatorId = room.facilitatorId;
    const excludeFacilitator = !room.facilitatorVotes;

    // Filter out the facilitator's vote if they are observer only
    const votingMembersVotes = Object.entries(this.votes())
      .filter(([userId]) => !excludeFacilitator || userId !== facilitatorId)
      .map(([, vote]) => vote)
      .filter(v => v !== null && v !== undefined && v !== '' && v !== '?');

    if (votingMembersVotes.length === 0) {
      return { average: '-', consensus: 'No', lowest: '-', highest: '-' };
    }

    const numericVotes = votingMembersVotes
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));

    if (numericVotes.length === 0) {
      return { average: '?', consensus: 'No', lowest: '?', highest: '?' };
    }

    const sum = numericVotes.reduce((a, b) => a + b, 0);
    const avg = parseFloat((sum / numericVotes.length).toFixed(1));
    const lowest = Math.min(...numericVotes);
    const highest = Math.max(...numericVotes);
    
    // Consensus is Yes if all active voting members' votes are identical
    const allVotedSame = votingMembersVotes.every(v => v === votingMembersVotes[0]);
    const totalVotersCount = Object.keys(this.votes()).filter(uid => !excludeFacilitator || uid !== facilitatorId).length;
    const consensus = allVotedSame && votingMembersVotes.length === totalVotersCount ? 'Yes' : 'No';

    return {
      average: avg,
      consensus,
      lowest,
      highest
    };
  });

  constructor(
    private firebaseService: FirebaseService,
    private router: Router
  ) {
    this.isMockMode.set(!this.firebaseService.hasRealConfig);
    this.initializeUser();
  }

  /**
   * Initializes user authentication (anonymous sign-in for Firebase, or generated UID for mock mode)
   */
  private initializeUser() {
    if (this.isMockMode()) {
      let mockUid = localStorage.getItem('tr_poker_mock_uid');
      if (!mockUid) {
        mockUid = 'user_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('tr_poker_mock_uid', mockUid);
      }
      this.currentUserId = mockUid;
    } else {
      onAuthStateChanged(this.firebaseService.auth, async (user) => {
        if (user) {
          this.currentUserId = user.uid;
        } else {
          try {
            const credential = await signInAnonymously(this.firebaseService.auth);
            this.currentUserId = credential.user.uid;
          } catch (err: any) {
            console.error('Firebase anonymous auth failed:', err);
            this.error.set('Authentication failed. Falling back to offline mode.');
            this.isMockMode.set(true);
            this.initializeUser(); // retry as mock
          }
        }
      });
    }
  }

  /**
   * Generates a unique room code
   */
  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Creates a new Scrum Poker room
   */
  async createRoom(facilitatorName: string, sessionName: string, participateInVoting: boolean): Promise<string> {
    this.loading.set(true);
    this.error.set(null);
    const roomId = this.generateRoomCode();
    
    if (this.isMockMode()) {
      const room: Room = {
        id: roomId,
        sessionName,
        facilitatorId: this.currentUserId,
        revealed: false,
        facilitatorVotes: participateInVoting,
        participants: {
          [this.currentUserId]: {
            id: this.currentUserId,
            name: facilitatorName,
            isOnline: true,
            isFacilitator: true,
            joinedAt: Date.now()
          }
        },
        votes: {}
      };
      
      localStorage.setItem(`mock_room_${roomId}`, JSON.stringify(room));
      this.loading.set(false);
      return roomId;
    }

    try {
      const roomRef = ref(this.firebaseService.db, `rooms/${roomId}`);
      const roomData = {
        id: roomId,
        sessionName,
        facilitatorId: this.currentUserId,
        revealed: false,
        facilitatorVotes: participateInVoting,
        participants: {
          [this.currentUserId]: {
            id: this.currentUserId,
            name: facilitatorName,
            isOnline: true,
            isFacilitator: true,
            joinedAt: Date.now()
          }
        },
        votes: {}
      };
      
      await set(roomRef, roomData);
      this.loading.set(false);
      return roomId;
    } catch (err: any) {
      this.loading.set(false);
      this.error.set(err.message || 'Failed to create room.');
      throw err;
    }
  }

  /**
   * Checks if a user is already registered as a participant in a room.
   * If yes, returns their name. Otherwise returns null.
   */
  async checkParticipantRegistered(roomId: string): Promise<string | null> {
    const rId = roomId.toUpperCase();
    
    // Wait for currentUserId to be set if in Firebase mode and not signed in yet
    if (!this.isMockMode() && !this.currentUserId) {
      await new Promise<void>((resolve) => {
        const unsubscribe = onAuthStateChanged(this.firebaseService.auth, (user) => {
          if (user) {
            this.currentUserId = user.uid;
            unsubscribe();
            resolve();
          } else {
            // If user is null, authentication initializes anonymously in initialUser
            // We can resolve once initialUser completes, or wait a short timeout
            setTimeout(() => {
              if (this.firebaseService.auth.currentUser) {
                this.currentUserId = this.firebaseService.auth.currentUser.uid;
              }
              resolve();
            }, 1000);
          }
        });
      });
    }

    if (this.isMockMode()) {
      const roomData = localStorage.getItem(`mock_room_${rId}`);
      if (roomData) {
        const room: Room = JSON.parse(roomData);
        if (room.participants && room.participants[this.currentUserId]) {
          return room.participants[this.currentUserId].name;
        }
      }
      return null;
    }

    try {
      const participantRef = ref(this.firebaseService.db, `rooms/${rId}/participants/${this.currentUserId}`);
      return new Promise<string | null>((resolve) => {
        onValue(participantRef, (snapshot) => {
          if (snapshot.exists()) {
            const participant: Participant = snapshot.val();
            // Only count them as registered if they have a name
            resolve(participant.name || null);
          } else {
            resolve(null);
          }
        }, { onlyOnce: true });
      });
    } catch (err) {
      console.error('Error checking participant registration:', err);
      return null;
    }
  }

  /**
   * Joins an existing room
   */
  async joinRoom(roomId: string, participantName: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.currentRoomId = roomId.toUpperCase();

    if (this.isMockMode()) {
      let roomData = localStorage.getItem(`mock_room_${this.currentRoomId}`);
      let room: Room;
      
      if (!roomData) {
        this.loading.set(false);
        const err = new Error('Room not found.');
        this.error.set(err.message);
        throw err;
      }
      
      room = JSON.parse(roomData);

      // Check for duplicate name among active online participants
      const nameExists = Object.values(room.participants || {}).some(
        p => p.id !== this.currentUserId && p.isOnline && p.name.trim().toLowerCase() === participantName.trim().toLowerCase()
      );
      if (nameExists) {
        this.loading.set(false);
        const err = new Error('Name already exists. Please choose another display name.');
        this.error.set(err.message);
        throw err;
      }

      const isFacilitator = room.facilitatorId === this.currentUserId;
      
      const newParticipant: Participant = {
        id: this.currentUserId,
        name: participantName,
        isOnline: true,
        isFacilitator,
        joinedAt: Date.now()
      };

      room.participants[this.currentUserId] = newParticipant;
      localStorage.setItem(`mock_room_${this.currentRoomId}`, JSON.stringify(room));
      
      this.startMockSubscription(room);
      this.loading.set(false);
      return;
    }

    try {
      // Connect to Firebase Realtime Database
      const roomRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}`);
      
      // Fetch room data and write participant, wrapping it in a Promise to block correctly
      await new Promise<void>((resolve, reject) => {
        onValue(roomRef, async (snapshot) => {
          if (!snapshot.exists()) {
            reject(new Error('Room not found.'));
            return;
          }
          
          try {
            const room: Room = snapshot.val();
            
            // Check for duplicate name among active online participants
            const nameExists = Object.values(room.participants || {}).some(
              p => p.id !== this.currentUserId && p.isOnline && p.name.trim().toLowerCase() === participantName.trim().toLowerCase()
            );
            if (nameExists) {
              reject(new Error('Name already exists. Please choose another display name.'));
              return;
            }

            const isFacilitator = room.facilitatorId === this.currentUserId;
            
            const participantRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}/participants/${this.currentUserId}`);
            const newParticipant: Participant = {
              id: this.currentUserId,
              name: participantName,
              isOnline: true,
              isFacilitator,
              joinedAt: Date.now()
            };

            // Write participant data and setup disconnect cleanup
            await set(participantRef, newParticipant);
            onDisconnect(participantRef).update({ isOnline: false });
            
            this.setupRealtimeListeners();
            resolve();
          } catch (err) {
            reject(err);
          }
        }, { onlyOnce: true });
      });

      this.loading.set(false);
    } catch (err: any) {
      this.loading.set(false);
      this.error.set(err.message || 'Failed to join room.');
      throw err;
    }
  }

  /**
   * Sets up realtime Firebase listeners for the joined room
   */
  private setupRealtimeListeners() {
    this.cleanupListeners();

    const roomRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}`);
    
    this.roomListenerUnsubscribe = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.error.set('Room has been deleted.');
        this.leaveRoom();
        return;
      }

      const room: Room = snapshot.val();
      this.currentRoom.set(room);
      this.revealed.set(room.revealed || false);
      
      // Map participants object to list and sort by joined date, putting facilitator at the bottom
      const participantsList = Object.values(room.participants || {})
        .filter(p => p !== null)
        .sort((a, b) => {
          if (a.isFacilitator && !b.isFacilitator) return 1;
          if (!a.isFacilitator && b.isFacilitator) return -1;
          return a.joinedAt - b.joinedAt;
        });
      
      this.participants.set(participantsList);
      this.votes.set(room.votes || {});
      
      const me = participantsList.find(p => p.id === this.currentUserId);
      if (me) {
        this.currentUser.set(me);
      }
    });

    // Handle connection presence status
    const connectedRef = ref(this.firebaseService.db, '.info/connected');
    this.connectionListenerUnsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true && this.currentRoomId) {
        const myPresenceRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}/participants/${this.currentUserId}`);
        update(myPresenceRef, { isOnline: true });
        onDisconnect(myPresenceRef).update({ isOnline: false });
      }
    });
  }

  /**
   * Submits a user vote
   */
  async submitVote(value: string): Promise<void> {
    if (!this.currentRoomId) return;

    if (this.isMockMode()) {
      let roomData = localStorage.getItem(`mock_room_${this.currentRoomId}`);
      if (roomData) {
        const room: Room = JSON.parse(roomData);
        if (!room.votes) room.votes = {};
        room.votes[this.currentUserId] = value;
        localStorage.setItem(`mock_room_${this.currentRoomId}`, JSON.stringify(room));
        this.currentRoom.set(room);
        this.votes.set(room.votes);
      }
      return;
    }

    try {
      const voteRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}/votes/${this.currentUserId}`);
      await set(voteRef, value);
    } catch (err: any) {
      console.error('Error submitting vote:', err);
    }
  }

  /**
   * Reveals all cards and calculates statistics
   */
  async revealCards(): Promise<void> {
    if (!this.currentRoomId) return;

    if (this.isMockMode()) {
      let roomData = localStorage.getItem(`mock_room_${this.currentRoomId}`);
      if (roomData) {
        const room: Room = JSON.parse(roomData);
        room.revealed = true;
        localStorage.setItem(`mock_room_${this.currentRoomId}`, JSON.stringify(room));
        this.currentRoom.set(room);
        this.votes.set(room.votes || {});
        this.revealed.set(true);
      }
      return;
    }

    try {
      // 1. Reveal room in Database
      const roomRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}`);
      await update(roomRef, { revealed: true });

      // 2. Also log session to Firestore (audit log / analytics history)
      const currentStats = this.stats();
      if (this.currentRoom() && currentStats) {
        const historyRef = collection(this.firebaseService.firestore, 'room_sessions');
        await addDoc(historyRef, {
          roomId: this.currentRoomId,
          sessionName: this.currentRoom()?.sessionName || '',
          revealedAt: Date.now(),
          stats: {
            average: currentStats.average,
            consensus: currentStats.consensus,
            lowest: currentStats.lowest,
            highest: currentStats.highest
          },
          voteCount: Object.keys(this.votes()).filter(uid => uid !== this.currentRoom()?.facilitatorId).length
        });
      }
    } catch (err: any) {
      console.error('Error revealing cards:', err);
    }
  }

  /**
   * Resets all votes and starts a new round
   */
  async resetRound(): Promise<void> {
    if (!this.currentRoomId) return;

    if (this.isMockMode()) {
      let roomData = localStorage.getItem(`mock_room_${this.currentRoomId}`);
      if (roomData) {
        const room: Room = JSON.parse(roomData);
        room.revealed = false;
        room.votes = {};
        localStorage.setItem(`mock_room_${this.currentRoomId}`, JSON.stringify(room));
        this.currentRoom.set(room);
        this.votes.set({});
        this.revealed.set(false);
      }
      return;
    }

    try {
      const roomRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}`);
      await update(roomRef, {
        revealed: false,
        votes: {}
      });
    } catch (err: any) {
      console.error('Error resetting round:', err);
    }
  }

  /**
   * Cleans up resources when leaving a room
   */
  leaveRoom() {
    this.cleanupListeners();
    if (this.currentRoomId && !this.isMockMode()) {
      try {
        const participantRef = ref(this.firebaseService.db, `rooms/${this.currentRoomId}/participants/${this.currentUserId}`);
        set(participantRef, null); // remove self
      } catch (err) {
        console.error('Error leaving room:', err);
      }
    }
    
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
    }

    this.currentRoom.set(null);
    this.participants.set([]);
    this.votes.set({});
    this.revealed.set(false);
    this.currentUser.set(null);
    this.currentRoomId = '';
    this.router.navigate(['/']);
  }

  private cleanupListeners() {
    if (this.roomListenerUnsubscribe) {
      this.roomListenerUnsubscribe();
      this.roomListenerUnsubscribe = null;
    }
    if (this.connectionListenerUnsubscribe) {
      this.connectionListenerUnsubscribe();
      this.connectionListenerUnsubscribe = null;
    }
  }

  // --- MOCK MODE SUPPORT ---
  
  private handleStorageChange = (event: StorageEvent) => {
    if (event.key === `mock_room_${this.currentRoomId}` && event.newValue) {
      const room: Room = JSON.parse(event.newValue);
      this.currentRoom.set(room);
      this.revealed.set(room.revealed || false);
      this.votes.set(room.votes || {});
      
      const participantsList = Object.values(room.participants || {})
        .sort((a, b) => {
          if (a.isFacilitator && !b.isFacilitator) return 1;
          if (!a.isFacilitator && b.isFacilitator) return -1;
          return a.joinedAt - b.joinedAt;
        });
      this.participants.set(participantsList);
      
      const me = participantsList.find(p => p.id === this.currentUserId);
      if (me) {
        this.currentUser.set(me);
      }
    }
  };

  private startMockSubscription(room: Room) {
    localStorage.setItem(`mock_room_${this.currentRoomId}`, JSON.stringify(room));
    this.currentRoom.set(room);
    this.revealed.set(room.revealed);
    this.votes.set(room.votes || {});

    // Sort participants, putting facilitator at the bottom
    const participantsList = Object.values(room.participants)
      .sort((a, b) => {
        if (a.isFacilitator && !b.isFacilitator) return 1;
        if (!a.isFacilitator && b.isFacilitator) return -1;
        return a.joinedAt - b.joinedAt;
      });
    this.participants.set(participantsList);

    const me = participantsList.find(p => p.id === this.currentUserId);
    if (me) {
      this.currentUser.set(me);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
      window.addEventListener('storage', this.handleStorageChange);
    }
  }
}

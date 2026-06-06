export interface Participant {
  id: string;
  name: string;
  isOnline: boolean;
  isFacilitator: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  sessionName: string;
  facilitatorId: string;
  revealed: boolean;
  facilitatorVotes: boolean;
  participants: { [userId: string]: Participant };
  votes: { [userId: string]: string };
}

export interface VoteStats {
  average: number | string;
  consensus: string; // 'Yes' | 'No'
  lowest: number | string;
  highest: number | string;
}

export interface RoomState {
  room: Room | null;
  participants: Participant[];
  currentUser: Participant | null;
  currentVote: string | null;
  stats: VoteStats | null;
}

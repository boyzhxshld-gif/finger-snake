export enum GameState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Point {
  x: number;
  y: number;
}

export interface SnakeSegment extends Point {
  id: number;
}

export interface FingerPosition {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  isActive: boolean;
}
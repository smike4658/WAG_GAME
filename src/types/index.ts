/**
 * Core type definitions for WAG GAME
 */

export interface Vector2D {
  x: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface GameConfig {
  readonly worldSize: number;
  readonly playerSpawnPoint: Vector3D;
  readonly gameTimeSeconds: number;
  readonly employeeCount: number;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  fire: boolean;
  sprint: boolean;
}

export interface PlayerConfig {
  readonly moveSpeed: number;
  readonly jumpForce: number;
  readonly lookSensitivity: number;
  readonly netRange: number;
  readonly netCooldown: number;
  readonly height: number;
}

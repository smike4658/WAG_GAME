import type { InputState } from '../types';

/**
 * Manages keyboard and mouse input for the game
 * Handles WASD movement, space jump, and mouse look
 */
export class InputManager {
  private readonly state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    fire: false,
    sprint: false,
  };

  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.setupKeyboardListeners();
    this.setupMouseListeners();
    this.setupPointerLock();
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => this.onKeyChange(e.code, true));
    window.addEventListener('keyup', (e) => this.onKeyChange(e.code, false));
  }

  private onKeyChange(code: string, pressed: boolean): void {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = pressed;
        break;
      case 'Space':
        this.state.jump = pressed;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = pressed;
        break;
    }
  }

  private setupMouseListeners(): void {
    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.state.fire = true;
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.state.fire = false;
      }
    });
  }

  private setupPointerLock(): void {
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  public getState(): Readonly<InputState> {
    return this.state;
  }

  public getMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  public isLocked(): boolean {
    return this.isPointerLocked;
  }
}

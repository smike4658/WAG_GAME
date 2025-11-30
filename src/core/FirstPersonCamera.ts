import * as THREE from 'three';
import type { InputManager } from './InputManager';
import type { PlayerConfig } from '../types';

/**
 * First-person camera controller
 * Handles WASD movement and mouse look
 */
export class FirstPersonCamera {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly euler: THREE.Euler;
  private readonly direction: THREE.Vector3;

  private readonly config: PlayerConfig = {
    moveSpeed: 8,
    jumpForce: 10,
    lookSensitivity: 0.002,
    netRange: 20,
    netCooldown: 1,
    height: 1.7,
  };

  constructor(
    camera: THREE.PerspectiveCamera,
    private readonly inputManager: InputManager
  ) {
    this.camera = camera;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.direction = new THREE.Vector3();

    // Set initial camera height
    this.camera.position.y = this.config.height;
  }

  public update(deltaTime: number): void {
    // Handle mouse look
    if (this.inputManager.isLocked()) {
      const mouseDelta = this.inputManager.getMouseDelta();

      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= mouseDelta.x * this.config.lookSensitivity;
      this.euler.x -= mouseDelta.y * this.config.lookSensitivity;

      // Clamp vertical look to prevent flipping
      const maxPitch = Math.PI / 2 - 0.01;
      this.euler.x = Math.max(-maxPitch, Math.min(maxPitch, this.euler.x));

      this.camera.quaternion.setFromEuler(this.euler);
    }

    // Handle WASD movement
    const input = this.inputManager.getState();
    this.direction.set(0, 0, 0);

    if (input.forward) this.direction.z -= 1;
    if (input.backward) this.direction.z += 1;
    if (input.left) this.direction.x -= 1;
    if (input.right) this.direction.x += 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();

      // Transform direction by camera yaw (not pitch)
      const yawQuaternion = new THREE.Quaternion();
      yawQuaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.euler.y
      );
      this.direction.applyQuaternion(yawQuaternion);

      // Apply movement
      const speed = this.config.moveSpeed * deltaTime;
      this.camera.position.x += this.direction.x * speed;
      this.camera.position.z += this.direction.z * speed;
    }
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }
}

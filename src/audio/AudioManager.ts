import { Howl, Howler } from 'howler';
import * as THREE from 'three';
import {
  MUSIC_CONFIG,
  FOOTSTEP_CONFIG,
  AMBIENT_CONFIG,
  AUDIO_SETTINGS,
} from './AudioConfig';

/**
 * Voice clip definition
 */
interface VoiceClip {
  id: string;
  role: string;
  text: string;
  file: string;
}

/**
 * Player movement state for footsteps
 */
interface PlayerMovementState {
  isMoving: boolean;
  isSprinting: boolean;
}

/**
 * Czech voice lines for employees
 */
const VOICE_CLIPS: VoiceClip[] = [
  // Developer
  { id: 'dev1', role: 'developer', text: 'Ne! Mám ještě bug!', file: 'dev_bug.mp3' },
  { id: 'dev2', role: 'developer', text: 'Nechci do práce!', file: 'dev_nechci.mp3' },
  { id: 'dev3', role: 'developer', text: 'Počkej, commituju!', file: 'dev_commit.mp3' },

  // DevOps
  { id: 'devops1', role: 'devops', text: 'Server padá!', file: 'devops_server.mp3' },
  { id: 'devops2', role: 'devops', text: 'Pomoc!', file: 'devops_pomoc.mp3' },
  { id: 'devops3', role: 'devops', text: 'Kubernetes umírá!', file: 'devops_k8s.mp3' },

  // Product Owner
  { id: 'po1', role: 'product', text: 'Mám meeting!', file: 'po_meeting.mp3' },
  { id: 'po2', role: 'product', text: 'Backlog!', file: 'po_backlog.mp3' },
  { id: 'po3', role: 'product', text: 'Sprint review!', file: 'po_sprint.mp3' },

  // Analyst
  { id: 'analyst1', role: 'analyst', text: 'Data nejsou ready!', file: 'analyst_data.mp3' },
  { id: 'analyst2', role: 'analyst', text: 'Počkej!', file: 'analyst_pockej.mp3' },
  { id: 'analyst3', role: 'analyst', text: 'Ještě analýza!', file: 'analyst_analyza.mp3' },

  // Tester / QA
  { id: 'qa1', role: 'qa', text: 'Našel jsem bug!', file: 'qa_bug.mp3' },
  { id: 'qa2', role: 'qa', text: 'Utíkám!', file: 'qa_utikam.mp3' },
  { id: 'qa3', role: 'qa', text: 'Test selhal!', file: 'qa_test.mp3' },

  // UX Designer
  { id: 'ux1', role: 'designer', text: 'Můj design!', file: 'ux_design.mp3' },
  { id: 'ux2', role: 'designer', text: 'Ne ne ne!', file: 'ux_ne.mp3' },
  { id: 'ux3', role: 'designer', text: 'Wireframe!', file: 'ux_wireframe.mp3' },

  // Ostrava slang - fleeing phrases (used randomly when any employee flees)
  { id: 'flee1', role: 'flee', text: 'Kurňa, ještě jsem nepushnul!', file: 'flee_ostrava1.mp3' },
  { id: 'flee2', role: 'flee', text: 'Pyčo, ten deploy!', file: 'flee_ostrava2.mp3' },
  { id: 'flee3', role: 'flee', text: 'Tyjo, mam tam bug jak baňa!', file: 'flee_ostrava3.mp3' },
  { id: 'flee4', role: 'flee', text: 'Furt debuguju, nech mě!', file: 'flee_ostrava4.mp3' },
  { id: 'flee5', role: 'flee', text: 'Do šaliny a pryč!', file: 'flee_ostrava5.mp3' },

  // Player exhaustion (sprint)
  { id: 'exhaust1', role: 'player', text: 'Už nemůžu!', file: 'player_exhaust1.mp3' },
  { id: 'exhaust2', role: 'player', text: 'Dej mi chvilku...', file: 'player_exhaust2.mp3' },
  { id: 'exhaust3', role: 'player', text: 'Počkej, zadýchám se!', file: 'player_exhaust3.mp3' },

  // Night refusal (employees won't work at night)
  { id: 'night1', role: 'night', text: 'Je noc, nepracuji!', file: 'night_nepracuji.mp3' },
  { id: 'night2', role: 'night', text: 'Mám noční klid!', file: 'night_klid.mp3' },
  { id: 'night3', role: 'night', text: 'Zzz... nech mě spát!', file: 'night_spat.mp3' },
  { id: 'night4', role: 'night', text: 'Přijď ráno!', file: 'night_rano.mp3' },
  { id: 'night5', role: 'night', text: 'Work-life balance!', file: 'night_balance.mp3' },

  // Player idle lines (when searching for employees)
  { id: 'idle1', role: 'player_idle', text: 'Tak kde jsou?', file: 'player_idle1.mp3' },
  { id: 'idle2', role: 'player_idle', text: 'Platby se samy nezpracují!', file: 'player_idle2.mp3' },
  { id: 'idle3', role: 'player_idle', text: 'Ten klientský portál se nedodělá sám!', file: 'player_idle3.mp3' },
  { id: 'idle4', role: 'player_idle', text: 'Kde se schovávají?', file: 'player_idle4.mp3' },
  { id: 'idle5', role: 'player_idle', text: 'Terminály na pumpách čekají!', file: 'player_idle5.mp3' },

  // Player approaching employee
  { id: 'approach1', role: 'player_approach', text: 'Pěkně do práce!', file: 'player_approach1.mp3' },
  { id: 'approach2', role: 'player_approach', text: 'Takhle ty KPI nesplníme!', file: 'player_approach2.mp3' },
  { id: 'approach3', role: 'player_approach', text: 'Mám tě!', file: 'player_approach3.mp3' },
  { id: 'approach4', role: 'player_approach', text: 'Zpátky k monitoru!', file: 'player_approach4.mp3' },
  { id: 'approach5', role: 'player_approach', text: 'Řidiči kamionů čekají na platby!', file: 'player_approach5.mp3' },

  // Player catch success
  { id: 'catch1', role: 'player_catch', text: 'Výborně!', file: 'player_catch1.mp3' },
  { id: 'catch2', role: 'player_catch', text: 'Další do týmu!', file: 'player_catch2.mp3' },
  { id: 'catch3', role: 'player_catch', text: 'Transakce schválena!', file: 'player_catch3.mp3' },
  { id: 'catch4', role: 'player_catch', text: 'A máme ho!', file: 'player_catch4.mp3' },
  { id: 'catch5', role: 'player_catch', text: 'Payment processed!', file: 'player_catch5.mp3' },
];

/**
 * Audio Manager using Howler.js
 * Handles voice clips and spatial 3D audio
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  private readonly sounds: Map<string, Howl> = new Map();
  private readonly clipsByRole: Map<string, VoiceClip[]> = new Map();
  private listenerPosition: THREE.Vector3 = new THREE.Vector3();
  private initialized = false;
  private enabled = true;

  // Music system
  private musicCalmTrack: Howl | null = null;
  private musicIntenseTrack: Howl | null = null;
  private targetIntenseVolume = 0;
  private currentIntenseVolume = 0;
  private musicPlaying = false;

  // Footstep system
  private footstepTimer = 0;
  private lastFootstepIndex = -1;

  // Ambient system
  private ambientSounds: Map<string, Howl> = new Map();
  private ambientPlaying = false;

  // NPC voice cooldown - prevents multiple NPCs speaking at once
  private lastNpcVoiceTime = 0;
  private readonly npcVoiceCooldown = 2000; // 2 seconds between NPC voices

  private constructor() {
    // Organize clips by role
    for (const clip of VOICE_CLIPS) {
      const roleClips = this.clipsByRole.get(clip.role) || [];
      roleClips.push(clip);
      this.clipsByRole.set(clip.role, roleClips);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Initialize audio system and preload sounds
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[AudioManager] Initializing...');

    // Set global volume
    Howler.volume(AUDIO_SETTINGS.masterVolume);

    // Preload all voice clips
    const loadPromises: Promise<void>[] = [];

    for (const clip of VOICE_CLIPS) {
      loadPromises.push(this.loadSound(clip.id, `/assets/audio/voices/${clip.file}`));
    }

    // Load catch sound effect
    loadPromises.push(this.loadSound('catch', '/assets/audio/catch.mp3'));
    loadPromises.push(this.loadSound('net_throw', '/assets/audio/net_throw.mp3'));

    // Load footstep sounds
    for (const footstep of FOOTSTEP_CONFIG.sounds) {
      loadPromises.push(this.loadSound(footstep.id, footstep.file));
    }

    try {
      await Promise.all(loadPromises);
      console.log('[AudioManager] All sounds loaded');
    } catch (error) {
      console.warn('[AudioManager] Some sounds failed to load:', error);
    }

    // Load music tracks (separate handling for looping)
    await this.loadMusicTracks();

    // Load ambient sounds
    await this.loadAmbientSounds();

    this.initialized = true;

    // Auto-start ambient and music if configured
    if (AUDIO_SETTINGS.autoPlayAmbient) {
      this.startAmbient();
    }
    if (AUDIO_SETTINGS.autoPlayMusic) {
      this.startMusic();
    }
  }

  /**
   * Load background music tracks
   */
  private async loadMusicTracks(): Promise<void> {
    const { tracks, masterVolume } = MUSIC_CONFIG;

    // Load calm track
    this.musicCalmTrack = new Howl({
      src: [tracks.calm.file],
      loop: tracks.calm.loop,
      volume: tracks.calm.baseVolume * masterVolume,
      preload: true,
      onloaderror: (_id, error) => {
        console.warn('[AudioManager] Failed to load calm music:', error);
      },
    });

    // Load intense track (starts at 0 volume)
    this.musicIntenseTrack = new Howl({
      src: [tracks.intense.file],
      loop: tracks.intense.loop,
      volume: 0,
      preload: true,
      onloaderror: (_id, error) => {
        console.warn('[AudioManager] Failed to load intense music:', error);
      },
    });

    console.log('[AudioManager] Music tracks loaded');
  }

  /**
   * Load ambient sound layers
   */
  private async loadAmbientSounds(): Promise<void> {
    const { sounds, masterVolume } = AMBIENT_CONFIG;

    for (const [key, config] of Object.entries(sounds)) {
      const sound = new Howl({
        src: [config.file],
        loop: config.loop,
        volume: config.volume * masterVolume,
        preload: true,
        onloaderror: (_id, error) => {
          console.warn(`[AudioManager] Failed to load ambient ${key}:`, error);
        },
      });
      this.ambientSounds.set(config.id, sound);
    }

    console.log('[AudioManager] Ambient sounds loaded');
  }

  /**
   * Load a sound file
   */
  private loadSound(id: string, src: string): Promise<void> {
    return new Promise((resolve) => {
      const sound = new Howl({
        src: [src],
        preload: true,
        volume: 1.0,
        onload: () => {
          this.sounds.set(id, sound);
          resolve();
        },
        onloaderror: (_id, error) => {
          console.warn(`[AudioManager] Failed to load ${src}:`, error);
          resolve(); // Don't fail completely if one sound is missing
        },
      });
    });
  }

  /**
   * Update listener position (usually camera position)
   */
  public updateListenerPosition(position: THREE.Vector3): void {
    this.listenerPosition.copy(position);
    Howler.pos(position.x, position.y, position.z);
  }

  /**
   * Play a random voice clip for a role at a position
   * 40% chance to use Ostrava slang phrases instead of role-specific ones
   * Enforces cooldown so only one NPC speaks at a time
   */
  public playVoiceClip(role: string, position: THREE.Vector3): void {
    if (!this.enabled) return;

    // Check cooldown - only one NPC can speak at a time
    const now = Date.now();
    if (now - this.lastNpcVoiceTime < this.npcVoiceCooldown) {
      console.log(`[AudioManager] NPC voice skipped (cooldown): ${role}`);
      return;
    }

    // 40% chance to use Ostrava slang flee phrases
    const useOstravaSlang = Math.random() < 0.4;
    const fleeClips = this.clipsByRole.get('flee');

    if (useOstravaSlang && fleeClips && fleeClips.length > 0) {
      const clip = fleeClips[Math.floor(Math.random() * fleeClips.length)]!;

      if (!this.sounds.has(clip.id)) {
        console.log(`[Scream] ${role} (ostravsky): "${clip.text}"`);
        return;
      }

      this.lastNpcVoiceTime = now;
      this.playSoundAtPosition(clip.id, position, 2.0);
      return;
    }

    // Normalize role name for role-specific clips
    const normalizedRole = this.normalizeRole(role);
    const clips = this.clipsByRole.get(normalizedRole);

    if (!clips || clips.length === 0) {
      // Fallback: log the scream text if no audio file
      console.log(`[Scream] ${role}: "Ááá!"`);
      return;
    }

    // Pick random clip
    const clip = clips[Math.floor(Math.random() * clips.length)]!;

    // Check if sound exists, if not just log
    if (!this.sounds.has(clip.id)) {
      console.log(`[Scream] ${role}: "${clip.text}"`);
      return;
    }

    // NPC voices use 2x volume multiplier for better audibility
    this.lastNpcVoiceTime = now;
    this.playSoundAtPosition(clip.id, position, 2.0);
  }

  /**
   * Normalize role name to match our clip categories
   */
  private normalizeRole(role: string): string {
    const lower = role.toLowerCase();

    if (lower.includes('dev') && !lower.includes('ops')) return 'developer';
    if (lower.includes('devops') || lower.includes('ops')) return 'devops';
    if (lower.includes('product') || lower.includes('owner') || lower.includes('po')) return 'product';
    if (lower.includes('analyst') || lower.includes('analyt')) return 'analyst';
    if (lower.includes('test') || lower.includes('qa')) return 'qa';
    if (lower.includes('design') || lower.includes('ux')) return 'designer';

    // Default to developer
    return 'developer';
  }

  /**
   * Play a sound at a 3D position
   * @param volumeMultiplier - Optional multiplier for volume (default 1.0)
   */
  public playSoundAtPosition(soundId: string, position: THREE.Vector3, volumeMultiplier: number = 1.0): void {
    if (!this.enabled) return;

    const sound = this.sounds.get(soundId);
    if (!sound) {
      console.warn(`[AudioManager] Sound not found: ${soundId}`);
      return;
    }

    // Calculate distance-based volume
    const distance = this.listenerPosition.distanceTo(position);
    const maxDistance = 50;
    const baseVolume = Math.max(0, 1 - distance / maxDistance);
    const volume = Math.min(1, baseVolume * volumeMultiplier); // Apply multiplier, clamp to max 1

    if (volume <= 0) return; // Too far to hear

    // Play with spatial position
    const id = sound.play();
    sound.volume(volume, id);
    sound.pos(position.x, position.y, position.z, id);
  }

  /**
   * Play a UI sound (non-spatial)
   */
  public playUISound(soundId: string): void {
    if (!this.enabled) return;

    const sound = this.sounds.get(soundId);
    if (sound) {
      sound.play();
    }
  }

  /**
   * Play catch sound effect
   */
  public playCatchSound(position: THREE.Vector3): void {
    this.playSoundAtPosition('catch', position);
  }

  /**
   * Play net throw sound
   */
  public playNetThrowSound(): void {
    this.playUISound('net_throw');
  }

  /**
   * Play random exhaustion voice line (when sprint ends)
   */
  public playExhaustionSound(): void {
    if (!this.enabled) return;

    const exhaustClips = this.clipsByRole.get('player');

    if (!exhaustClips || exhaustClips.length === 0) {
      console.log('[Player] "Už nemůžu!"');
      return;
    }

    // Pick random exhaustion clip
    const clip = exhaustClips[Math.floor(Math.random() * exhaustClips.length)]!;

    // Check if sound exists
    if (!this.sounds.has(clip.id)) {
      console.log(`[Player] "${clip.text}"`);
      return;
    }

    // Play as UI sound (non-spatial, always audible)
    this.playUISound(clip.id);
  }

  /**
   * Play random night refusal voice line (when employee refuses to work at night)
   */
  public playNightRefusalSound(position: THREE.Vector3): void {
    if (!this.enabled) return;

    const nightClips = this.clipsByRole.get('night');

    if (!nightClips || nightClips.length === 0) {
      console.log('[Employee] "Je noc, nepracuji!"');
      return;
    }

    // Pick random night clip
    const clip = nightClips[Math.floor(Math.random() * nightClips.length)]!;

    // Check if sound exists
    if (!this.sounds.has(clip.id)) {
      console.log(`[Employee] "${clip.text}"`);
      return;
    }

    // Play at employee position with 2x volume for NPC audibility
    this.playSoundAtPosition(clip.id, position, 2.0);
  }

  /**
   * Play random player idle voice line (when searching for employees)
   */
  public playPlayerIdleSound(): void {
    if (!this.enabled) return;

    const idleClips = this.clipsByRole.get('player_idle');

    if (!idleClips || idleClips.length === 0) {
      console.log('[Player] "Tak kde jsou?"');
      return;
    }

    const clip = idleClips[Math.floor(Math.random() * idleClips.length)]!;

    if (!this.sounds.has(clip.id)) {
      console.log(`[Player] "${clip.text}"`);
      return;
    }

    this.playUISound(clip.id);
  }

  /**
   * Play random player approach voice line (when getting close to employee)
   */
  public playPlayerApproachSound(): void {
    if (!this.enabled) return;

    const approachClips = this.clipsByRole.get('player_approach');

    if (!approachClips || approachClips.length === 0) {
      console.log('[Player] "Pěkně do práce!"');
      return;
    }

    const clip = approachClips[Math.floor(Math.random() * approachClips.length)]!;

    if (!this.sounds.has(clip.id)) {
      console.log(`[Player] "${clip.text}"`);
      return;
    }

    this.playUISound(clip.id);
  }

  /**
   * Play random player catch success voice line
   */
  public playPlayerCatchSound(): void {
    if (!this.enabled) return;

    const catchClips = this.clipsByRole.get('player_catch');

    if (!catchClips || catchClips.length === 0) {
      console.log('[Player] "Výborně!"');
      return;
    }

    const clip = catchClips[Math.floor(Math.random() * catchClips.length)]!;

    if (!this.sounds.has(clip.id)) {
      console.log(`[Player] "${clip.text}"`);
      return;
    }

    this.playUISound(clip.id);
  }

  /**
   * Enable/disable audio
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    Howler.mute(!enabled);
  }

  /**
   * Check if audio is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set master volume (0-1)
   */
  public setVolume(volume: number): void {
    Howler.volume(Math.max(0, Math.min(1, volume)));
  }

  /**
   * Get list of voice clips that need to be generated
   */
  public static getVoiceClipsToGenerate(): VoiceClip[] {
    return [...VOICE_CLIPS];
  }

  // ============================================
  // MUSIC SYSTEM
  // ============================================

  /**
   * Start background music
   */
  public startMusic(): void {
    if (this.musicPlaying || !this.enabled) return;

    if (this.musicCalmTrack) {
      this.musicCalmTrack.play();
    }
    if (this.musicIntenseTrack) {
      this.musicIntenseTrack.play();
    }

    this.musicPlaying = true;
    console.log('[AudioManager] Music started');
  }

  /**
   * Stop background music
   */
  public stopMusic(): void {
    if (!this.musicPlaying) return;

    if (this.musicCalmTrack) {
      this.musicCalmTrack.stop();
    }
    if (this.musicIntenseTrack) {
      this.musicIntenseTrack.stop();
    }

    this.musicPlaying = false;
    console.log('[AudioManager] Music stopped');
  }

  /**
   * Update music intensity based on game state
   * Call this every frame with the number of nearby fleeing employees
   */
  public updateMusicIntensity(nearbyFleeingCount: number): void {
    if (!this.musicPlaying || !this.musicIntenseTrack) return;

    const { intensityThresholds, tracks, masterVolume } = MUSIC_CONFIG;

    // Calculate target intensity (0-1) based on fleeing employees
    const intensity = Math.min(
      nearbyFleeingCount / intensityThresholds.maxFleeingForIntense,
      1
    );

    // Set target volume for intense track
    this.targetIntenseVolume = intensity * tracks.intense.baseVolume * masterVolume;
  }

  /**
   * Smoothly interpolate music volumes (call every frame)
   */
  public updateMusicVolumes(deltaTime: number): void {
    if (!this.musicPlaying || !this.musicIntenseTrack) return;

    const { fadeDuration } = MUSIC_CONFIG;

    // Smoothly interpolate current volume towards target
    const lerpSpeed = deltaTime / fadeDuration;
    this.currentIntenseVolume += (this.targetIntenseVolume - this.currentIntenseVolume) * Math.min(lerpSpeed * 3, 1);

    // Apply volume to intense track
    this.musicIntenseTrack.volume(this.currentIntenseVolume);
  }

  // ============================================
  // FOOTSTEP SYSTEM
  // ============================================

  /**
   * Update footstep sounds based on player movement
   * Call this every frame with player movement state
   */
  public updateFootsteps(deltaTime: number, movementState: PlayerMovementState): void {
    if (!this.enabled) return;

    const { isMoving, isSprinting } = movementState;

    if (!isMoving) {
      // Reset timer when not moving
      this.footstepTimer = 0;
      return;
    }

    // Determine interval based on sprint state
    const interval = isSprinting
      ? FOOTSTEP_CONFIG.sprintInterval
      : FOOTSTEP_CONFIG.walkInterval;

    // Update timer
    this.footstepTimer += deltaTime;

    // Play footstep when interval elapsed
    if (this.footstepTimer >= interval) {
      this.footstepTimer = 0;
      this.playFootstep(isSprinting);
    }
  }

  /**
   * Play a random footstep sound
   */
  private playFootstep(isSprinting: boolean): void {
    const { sounds, volume, sprintVolumeMultiplier } = FOOTSTEP_CONFIG;

    if (sounds.length === 0) return;

    // Pick a random footstep (avoid repeating the same one)
    let index: number;
    do {
      index = Math.floor(Math.random() * sounds.length);
    } while (index === this.lastFootstepIndex && sounds.length > 1);

    this.lastFootstepIndex = index;

    const footstepConfig = sounds[index];
    if (!footstepConfig) return;

    const sound = this.sounds.get(footstepConfig.id);
    if (!sound) return;

    // Calculate volume with sprint multiplier
    const finalVolume = isSprinting
      ? volume * sprintVolumeMultiplier
      : volume;

    const id = sound.play();
    sound.volume(finalVolume, id);
  }

  // ============================================
  // AMBIENT SYSTEM
  // ============================================

  /**
   * Start ambient sounds
   */
  public startAmbient(): void {
    if (this.ambientPlaying || !this.enabled) return;

    for (const sound of this.ambientSounds.values()) {
      sound.play();
    }

    this.ambientPlaying = true;
    console.log('[AudioManager] Ambient sounds started');
  }

  /**
   * Stop ambient sounds
   */
  public stopAmbient(): void {
    if (!this.ambientPlaying) return;

    for (const sound of this.ambientSounds.values()) {
      sound.stop();
    }

    this.ambientPlaying = false;
    console.log('[AudioManager] Ambient sounds stopped');
  }

  /**
   * Set ambient volume (0-1)
   */
  public setAmbientVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    for (const [id, sound] of this.ambientSounds.entries()) {
      // Find original config to maintain relative volumes
      const configs = Object.values(AMBIENT_CONFIG.sounds);
      const config = configs.find(c => c.id === id);
      if (config) {
        sound.volume(config.volume * clampedVolume);
      }
    }
  }

  /**
   * Set music volume (0-1)
   */
  public setMusicVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const { tracks } = MUSIC_CONFIG;

    if (this.musicCalmTrack) {
      this.musicCalmTrack.volume(tracks.calm.baseVolume * clampedVolume);
    }
    // Note: intense track volume is managed by updateMusicIntensity
  }

  // ============================================
  // COMBINED UPDATE (call every frame)
  // ============================================

  /**
   * Main update method - call every frame
   * Handles music volume interpolation
   */
  public update(deltaTime: number): void {
    this.updateMusicVolumes(deltaTime);
  }
}

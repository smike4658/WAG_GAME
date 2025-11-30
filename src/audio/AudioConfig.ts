/**
 * Audio Configuration for WAG GAME
 * Defines all audio assets and settings for music, footsteps, and ambient sounds
 */

/**
 * Background music configuration
 * Uses layered approach for dynamic intensity
 */
export interface MusicTrack {
  id: string;
  file: string;
  baseVolume: number;
  loop: boolean;
}

export const MUSIC_CONFIG = {
  /** Fade duration in seconds for music transitions */
  fadeDuration: 2.0,

  /** Base volume for all music (0-1) - kept low so NPC voices are prominent */
  masterVolume: 0.15,

  /** Music tracks - calm layer always plays, intense layer fades in during chase */
  tracks: {
    calm: {
      id: 'music_calm',
      file: '/assets/audio/music/calm_loop.mp3',
      baseVolume: 0.6,
      loop: true,
    } as MusicTrack,
    intense: {
      id: 'music_intense',
      file: '/assets/audio/music/intense_loop.mp3',
      baseVolume: 0.8,
      loop: true,
    } as MusicTrack,
  },

  /** Intensity thresholds based on nearby fleeing employees */
  intensityThresholds: {
    /** Distance at which employee contributes to intensity */
    detectionRadius: 25,
    /** Number of nearby fleeing employees for max intensity */
    maxFleeingForIntense: 3,
  },
};

/**
 * Footstep sound configuration
 */
export interface FootstepSound {
  id: string;
  file: string;
}

export const FOOTSTEP_CONFIG = {
  /** Time between footstep sounds while walking (seconds) */
  walkInterval: 0.5,

  /** Time between footstep sounds while sprinting (seconds) */
  sprintInterval: 0.3,

  /** Volume for footstep sounds */
  volume: 0.4,

  /** Volume multiplier when sprinting */
  sprintVolumeMultiplier: 1.3,

  /** Footstep sound variants (randomly selected) */
  sounds: [
    { id: 'footstep_1', file: '/assets/audio/sfx/footstep_1.mp3' },
    { id: 'footstep_2', file: '/assets/audio/sfx/footstep_2.mp3' },
    { id: 'footstep_3', file: '/assets/audio/sfx/footstep_3.mp3' },
    { id: 'footstep_4', file: '/assets/audio/sfx/footstep_4.mp3' },
  ] as FootstepSound[],
};

/**
 * Ambient sound configuration
 * City atmosphere sounds that loop continuously
 */
export interface AmbientSound {
  id: string;
  file: string;
  volume: number;
  loop: boolean;
}

export const AMBIENT_CONFIG = {
  /** Master volume for ambient sounds - kept very low as background texture */
  masterVolume: 0.08,

  /** Ambient sound layers */
  sounds: {
    /** City background - distant traffic, general urban hum */
    cityBackground: {
      id: 'ambient_city',
      file: '/assets/audio/ambient/city_background.mp3',
      volume: 0.4,
      loop: true,
    } as AmbientSound,

    /** Birds chirping - adds life to the scene */
    birds: {
      id: 'ambient_birds',
      file: '/assets/audio/ambient/birds.mp3',
      volume: 0.2,
      loop: true,
    } as AmbientSound,

    /** Wind - subtle atmosphere */
    wind: {
      id: 'ambient_wind',
      file: '/assets/audio/ambient/wind.mp3',
      volume: 0.15,
      loop: true,
    } as AmbientSound,
  },
};

/**
 * Combined audio settings
 */
export const AUDIO_SETTINGS = {
  /** Global master volume (affects everything) */
  masterVolume: 0.7,

  /** Whether to auto-play music on game start */
  autoPlayMusic: true,

  /** Whether to auto-play ambient sounds on game start */
  autoPlayAmbient: true,
};

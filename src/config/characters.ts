/**
 * Character configuration for WAG GAME
 * Maps employee roles to their 3D models
 */

export type Gender = 'male' | 'female';

export interface CharacterModel {
  path: string;
  sketchfabId: string;
  name: string;
  animated: boolean;
  rigged: boolean;
  /** Custom model with named animations (Idle, Walk, Run, Flee) */
  hasNamedAnimations?: boolean;
  /** Manual scale override (bypasses auto-scaling) - use for models with incorrect bounding boxes */
  scaleOverride?: number;
}

export interface RoleConfig {
  id: string;
  displayName: string;
  displayNameCz: string;
  genders: Gender[];
  models: Partial<Record<Gender, CharacterModel>>;
}

export interface NPCPackConfig {
  id: string;
  name: string;
  path: string;
  sketchfabId: string;
  characterCount: number;
}

/**
 * Employee roles with their character models
 *
 * Role groupings based on team:
 * - Developer (blue): Generic developers
 * - Frontend Developer (cyan): React/Frontend devs
 * - Backend Developer (green): BE developers
 * - Fullstack Developer (teal): React/JAVA devs
 * - QA/Testing (orange): QA engineers, Test leads, Test managers
 * - Product Owner (red): Product owners
 * - Business Analyst (yellow): BA, IT BA
 * - UX Designer (pink): UX designers
 * - UI Designer (magenta): UI designers
 * - Solution Architect (purple): IT Solution Architects
 */
export const EMPLOYEE_ROLES: RoleConfig[] = [
  // Generic Developer - blue baseball cap accessory
  {
    id: 'developer',
    displayName: 'Developer',
    displayNameCz: 'Vývojář',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/developer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Developer (Baseball Cap)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/developer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Developer (Baseball Cap)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // Frontend/React Developer - cyan headphones accessory
  {
    id: 'frontend-developer',
    displayName: 'Frontend Developer',
    displayNameCz: 'Frontend Vývojář',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/frontend-developer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Frontend Developer (Headphones)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/female-frontend-developer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Female Frontend Developer (Headphones)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // Backend Developer - green backpack accessory
  {
    id: 'backend-developer',
    displayName: 'Backend Developer',
    displayNameCz: 'Backend Vývojář',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/backend-developer-new.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Backend Developer (Backpack)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/backend-developer-new.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Backend Developer (Backpack)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // Fullstack Developer - teal laptop bag accessory
  {
    id: 'fullstack-developer',
    displayName: 'Fullstack Developer',
    displayNameCz: 'Fullstack Vývojář',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/fullstack-developer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Fullstack Developer (Laptop Bag)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/fullstack-developer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Fullstack Developer (Laptop Bag)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // QA/Testing - orange clipboard accessory (covers QA Engineer, Test Lead, Test Manager)
  {
    id: 'qa-tester',
    displayName: 'QA Engineer',
    displayNameCz: 'QA Tester',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/qa-tester-new.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'QA Tester (Clipboard)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/female-qa-tester.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Female QA Tester (Clipboard)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // Product Owner - red briefcase accessory
  {
    id: 'product-owner',
    displayName: 'Product Owner',
    displayNameCz: 'Product Owner',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/product-owner-new.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Product Owner (Briefcase)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/product-owner-new.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Product Owner (Briefcase)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // Business Analyst - yellow folder accessory
  {
    id: 'business-analyst',
    displayName: 'Business Analyst',
    displayNameCz: 'Business Analytik',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/business-analyst-new.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Business Analyst (Folder)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/female-business-analyst.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Female Business Analyst (Folder)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // UX Designer - pink tablet accessory
  {
    id: 'ux-designer',
    displayName: 'UX Designer',
    displayNameCz: 'UX Designér',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/ux-designer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'UX Designer (Tablet)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/female-ux-designer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Female UX Designer (Tablet)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // UI Designer - magenta color palette accessory
  {
    id: 'ui-designer',
    displayName: 'UI Designer',
    displayNameCz: 'UI Designér',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/ui-designer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'UI Designer (Color Palette)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/ui-designer.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'UI Designer (Color Palette)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
  // Solution Architect - purple blueprints accessory
  {
    id: 'solution-architect',
    displayName: 'Solution Architect',
    displayNameCz: 'Solution Architekt',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/solution-architect.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Solution Architect (Blueprints)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
      female: {
        path: 'assets/models/solution-architect.glb',
        sketchfabId: 'custom-accessory-model',
        name: 'Solution Architect (Blueprints)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
        scaleOverride: 0.15,
      },
    },
  },
];

/**
 * NPC packs for random pedestrians (disabled - using fallback meshes)
 */
export const NPC_PACKS: NPCPackConfig[] = [
  // Disabled to simplify - using fallback meshes instead
];

/**
 * Helper: Get random gender for a role
 */
export function getRandomGender(role: RoleConfig): Gender {
  const availableGenders = role.genders;
  const randomGender = availableGenders[Math.floor(Math.random() * availableGenders.length)];
  return randomGender ?? 'male';
}

/**
 * Helper: Get model path for a specific role and gender
 */
export function getCharacterModelPath(roleId: string, gender: Gender): string | null {
  const role = EMPLOYEE_ROLES.find((r) => r.id === roleId);
  if (!role) return null;

  const model = role.models[gender];
  return model?.path ?? null;
}

/**
 * Helper: Get a random role configuration
 */
export function getRandomRole(): RoleConfig {
  const randomRole = EMPLOYEE_ROLES[Math.floor(Math.random() * EMPLOYEE_ROLES.length)];
  return randomRole ?? EMPLOYEE_ROLES[0]!;
}

/**
 * Helper: Get all model paths for preloading
 */
export function getAllCharacterModelPaths(): string[] {
  const paths: string[] = [];

  for (const role of EMPLOYEE_ROLES) {
    if (role.models.male) paths.push(role.models.male.path);
    if (role.models.female) paths.push(role.models.female.path);
  }

  for (const pack of NPC_PACKS) {
    paths.push(pack.path);
  }

  return paths;
}

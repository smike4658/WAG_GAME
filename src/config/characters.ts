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
 */
export const EMPLOYEE_ROLES: RoleConfig[] = [
  {
    id: 'frontend-developer',
    displayName: 'Frontend Developer',
    displayNameCz: 'Frontend Vývojář',
    genders: ['male', 'female'],
    models: {
      male: {
        path: 'assets/models/developer_npc.glb',
        sketchfabId: 'custom-blender-model',
        name: 'Developer NPC (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
      },
      female: {
        path: 'assets/models/developer_npc.glb',
        sketchfabId: 'custom-blender-model',
        name: 'Developer NPC (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
      },
    },
  },
  {
    id: 'backend-developer',
    displayName: 'Backend Developer',
    displayNameCz: 'Backend Vývojář',
    genders: ['male'],
    models: {
      male: {
        path: 'assets/models/backend-developer.glb',
        sketchfabId: 'stylized-variant',
        name: 'Backend Developer (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
      },
    },
  },
  {
    id: 'ui-ux-designer',
    displayName: 'UI/UX Designer',
    displayNameCz: 'UI/UX Designér',
    genders: ['male'],
    models: {
      male: {
        path: 'assets/models/ui-ux-designer.glb',
        sketchfabId: 'stylized-variant',
        name: 'UI/UX Designer (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
      },
    },
  },
  {
    id: 'qa-tester',
    displayName: 'QA Tester',
    displayNameCz: 'QA Tester',
    genders: ['male'],
    models: {
      male: {
        path: 'assets/models/qa-tester.glb',
        sketchfabId: 'stylized-variant',
        name: 'QA Tester (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
      },
    },
  },
  {
    id: 'business-analyst',
    displayName: 'Business Analyst',
    displayNameCz: 'Business Analytik',
    genders: ['male'],
    models: {
      male: {
        path: 'assets/models/business-analyst.glb',
        sketchfabId: 'stylized-variant',
        name: 'Business Analyst (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
      },
    },
  },
  {
    id: 'product-owner',
    displayName: 'Product Owner',
    displayNameCz: 'Product Owner',
    genders: ['male'],
    models: {
      male: {
        path: 'assets/models/product-owner.glb',
        sketchfabId: 'custom-blender-model',
        name: 'Product Owner (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
      },
    },
  },
  {
    id: 'devops',
    displayName: 'DevOps Engineer',
    displayNameCz: 'DevOps Inženýr',
    genders: ['male'],
    models: {
      male: {
        path: 'assets/models/devops.glb',
        sketchfabId: 'stylized-variant',
        name: 'DevOps Engineer (Animated)',
        animated: true,
        rigged: true,
        hasNamedAnimations: true,
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

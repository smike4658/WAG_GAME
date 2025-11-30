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
  // Ostatní role používají fallback mesh (bez externích modelů)
  {
    id: 'backend-developer',
    displayName: 'Backend Developer',
    displayNameCz: 'Backend Vývojář',
    genders: ['male', 'female'],
    models: {},  // Fallback mesh
  },
  {
    id: 'ui-ux-designer',
    displayName: 'UI/UX Designer',
    displayNameCz: 'UI/UX Designér',
    genders: ['male', 'female'],
    models: {},  // Fallback mesh
  },
  {
    id: 'qa-tester',
    displayName: 'QA Tester',
    displayNameCz: 'QA Tester',
    genders: ['male', 'female'],
    models: {},  // Fallback mesh
  },
  {
    id: 'business-analyst',
    displayName: 'Business Analyst',
    displayNameCz: 'Business Analytik',
    genders: ['male', 'female'],
    models: {},  // Fallback mesh
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
    models: {},  // Fallback mesh
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

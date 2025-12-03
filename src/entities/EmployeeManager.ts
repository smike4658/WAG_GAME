import * as THREE from 'three';
import { Employee, type EmployeeConfig } from './Employee';
import { CharacterLoader } from '../core/CharacterLoader';
import { LowpolyNPCLoader, getLowpolyNPCLoader } from '../core/LowpolyNPCLoader';
import { type Gender, EMPLOYEE_ROLES } from '../config/characters';
import { getCityCollider } from '../world/collision/CityCollider';

/**
 * Employee data from config
 */
export interface EmployeeData {
  name: string;
  role: string;
  roleId: string;
  gender?: Gender;  // If not specified, will be randomly selected
  color?: number;
}

/**
 * Manages all employees in the game
 * Handles spawning, updates, and catch tracking
 */
export class EmployeeManager {
  private readonly scene: THREE.Scene;
  private readonly employees: Map<string, Employee> = new Map();
  private readonly characterLoader: CharacterLoader;
  private readonly npcLoader: LowpolyNPCLoader;

  private caughtCount = 0;
  private totalCount = 0;

  // Callbacks
  private onCatch: ((employee: Employee, remaining: number) => void) | null = null;
  private onAllCaught: (() => void) | null = null;
  private onScream: ((employee: Employee) => void) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private onNightRefuse: ((employee: Employee) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.characterLoader = CharacterLoader.getInstance();
    this.npcLoader = getLowpolyNPCLoader();
  }

  /**
   * Initialize all character loaders (must be called before spawning)
   */
  public async initializeNPCLoader(
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    // Initialize CharacterLoader first (loads our custom models like developer_npc.glb)
    if (!this.characterLoader.isInitialized()) {
      onProgress?.(0, 'Loading character models...');
      await this.characterLoader.initialize((progress, status) => {
        // CharacterLoader uses 0-50% of progress
        onProgress?.(progress * 0.5, status);
      });
    }

    // Then initialize NPC loader for fallback models
    if (!this.npcLoader.isInitialized()) {
      await this.npcLoader.initialize((progress, status) => {
        // NPCLoader uses 50-100% of progress
        onProgress?.(50 + progress * 0.5, status);
      });
    }
  }

  /**
   * Set callback when an employee is caught
   */
  public setOnCatch(callback: (employee: Employee, remaining: number) => void): void {
    this.onCatch = callback;
  }

  /**
   * Set callback when all employees are caught
   */
  public setOnAllCaught(callback: () => void): void {
    this.onAllCaught = callback;
  }

  /**
   * Set callback when an employee screams
   */
  public setOnScream(callback: (employee: Employee) => void): void {
    this.onScream = callback;
  }

  /**
   * Set callback when an employee refuses to work at night
   */
  public setOnNightRefuse(callback: (employee: Employee) => void): void {
    this.onNightRefuse = callback;
  }

  /**
   * Find a valid spawn position that is within bounds and not inside a building
   */
  private findValidSpawnPosition(
    spawnCenter: THREE.Vector3,
    spawnRadius: number,
    baseAngle: number,
    maxAttempts: number = 10
  ): THREE.Vector3 {
    const collider = getCityCollider();
    const bounds = collider.getBounds();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Add some randomness to angle on retry
      const angle = baseAngle + (attempt * 0.3);
      const distance = spawnRadius * (0.5 + Math.random() * 0.5);

      const position = new THREE.Vector3(
        spawnCenter.x + Math.cos(angle) * distance,
        0,
        spawnCenter.z + Math.sin(angle) * distance
      );

      // Check if within map bounds
      if (!bounds.containsPoint(position)) {
        // Clamp to bounds with margin
        const margin = 5;
        position.x = Math.max(bounds.min.x + margin, Math.min(position.x, bounds.max.x - margin));
        position.z = Math.max(bounds.min.z + margin, Math.min(position.z, bounds.max.z - margin));
      }

      // Check collision with buildings (check at waist height ~1m)
      const checkPos = position.clone();
      checkPos.y = 1.0;
      const collision = collider.checkSphere(checkPos, 0.5);

      if (!collision) {
        // Valid position found
        return position;
      }

      // Try again with different angle/distance
      console.log(`[EmployeeManager] Spawn attempt ${attempt + 1} blocked by ${collision.type}, retrying...`);
    }

    // Fallback: return clamped position even if in collision
    console.warn('[EmployeeManager] Could not find collision-free spawn, using fallback');
    const fallback = new THREE.Vector3(
      Math.max(bounds.min.x + 10, Math.min(spawnCenter.x, bounds.max.x - 10)),
      0,
      Math.max(bounds.min.z + 10, Math.min(spawnCenter.z, bounds.max.z - 10))
    );
    return fallback;
  }

  /**
   * Spawn employees in the world
   */
  public spawnEmployees(
    employeeDataList: EmployeeData[],
    spawnCenter: THREE.Vector3,
    spawnRadius: number = 50
  ): void {
    this.totalCount = employeeDataList.length;
    this.caughtCount = 0;

    for (let i = 0; i < employeeDataList.length; i++) {
      const data = employeeDataList[i];
      if (!data) continue;

      const id = `employee_${i}_${data.name.replace(/\s+/g, '_')}`;

      // Calculate spawn position in a ring around center with validation
      const baseAngle = (i / employeeDataList.length) * Math.PI * 2;
      const position = this.findValidSpawnPosition(spawnCenter, spawnRadius, baseAngle);

      // Determine gender - use specified or random for the role
      const gender: Gender = data.gender ?? this.characterLoader.getRandomGenderForRole(data.roleId);

      // Get role display name
      const roleConfig = this.characterLoader.getRoleConfig(data.roleId);
      const roleDisplayName = roleConfig?.displayName ?? data.role;

      const employeeConfig: Partial<EmployeeConfig> & { name: string; role: string; roleId: string; gender: Gender } = {
        name: data.name,
        role: roleDisplayName,
        roleId: data.roleId,
        gender: gender,
      };

      if (data.color !== undefined) {
        employeeConfig.color = data.color;
      }

      // Get character model from CharacterLoader (or use fallback mesh)
      let characterModel: THREE.Group | undefined;
      let animations: THREE.AnimationClip[] | undefined;
      let scaleOverride: number | undefined;

      // Debug: Check CharacterLoader state
      console.log(`[EmployeeManager] CharacterLoader initialized: ${this.characterLoader.isInitialized()}, loaded count: ${this.characterLoader.getLoadedCount()}`);

      // Check if CharacterLoader has a model for this role
      console.log(`[EmployeeManager] Requesting model for ${data.roleId} / ${gender}`);
      const charLoaderModel = this.characterLoader.getCharacterModel(data.roleId, gender);
      console.log(`[EmployeeManager] Got model: ${charLoaderModel ? 'YES' : 'NO'}`);

      if (charLoaderModel) {
        characterModel = charLoaderModel;
        animations = this.characterLoader.getCharacterAnimations(data.roleId, gender);
        scaleOverride = this.characterLoader.getScaleOverride(data.roleId, gender);
        console.log(`[EmployeeManager] Using custom model for ${data.roleId} with ${animations?.length ?? 0} animations, scaleOverride: ${scaleOverride ?? 'auto'}`);
      } else {
        // No model - Employee will use fallback mesh (cylinder + sphere)
        console.log(`[EmployeeManager] Using fallback mesh for ${data.roleId} (no model found)`);
      }

      const employee = new Employee(
        id,
        position,
        employeeConfig,
        characterModel,
        animations,
        getCityCollider(),
        scaleOverride
      );

      // Set up callbacks
      employee.setOnCaught((emp) => this.handleEmployeeCaught(emp));
      employee.setOnScream((emp) => {
        if (this.onScream) {
          this.onScream(emp);
        }
      });
      employee.setOnNightRefuse((emp) => {
        if (this.onNightRefuse) {
          this.onNightRefuse(emp);
        }
      });

      this.employees.set(id, employee);
      this.scene.add(employee.getMesh());
    }

    console.log(`[EmployeeManager] Spawned ${this.employees.size} employees`);
  }

  /**
   * Handle employee being caught
   */
  private handleEmployeeCaught(employee: Employee): void {
    this.caughtCount++;
    const remaining = this.totalCount - this.caughtCount;

    console.log(
      `[EmployeeManager] ${employee.config.name} (${employee.config.role}) caught! ${remaining} remaining`
    );

    if (this.onCatch) {
      this.onCatch(employee, remaining);
    }

    if (remaining === 0 && this.onAllCaught) {
      this.onAllCaught();
    }
  }

  /**
   * Update all employees
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    for (const employee of this.employees.values()) {
      employee.update(deltaTime, playerPosition);
    }
  }

  /**
   * Get positions of all active (not caught) employees
   */
  public getActivePositions(): Map<string, THREE.Vector3> {
    const positions = new Map<string, THREE.Vector3>();

    for (const [id, employee] of this.employees) {
      if (employee.getState() !== 'caught') {
        positions.set(id, employee.getPosition());
      }
    }

    return positions;
  }

  /**
   * Catch an employee by ID
   */
  public catchEmployee(id: string): boolean {
    const employee = this.employees.get(id);
    if (employee && employee.getState() !== 'caught') {
      employee.catch();
      return true;
    }
    return false;
  }

  /**
   * Get employee by ID
   */
  public getEmployee(id: string): Employee | undefined {
    return this.employees.get(id);
  }

  /**
   * Get caught count
   */
  public getCaughtCount(): number {
    return this.caughtCount;
  }

  /**
   * Get total count
   */
  public getTotalCount(): number {
    return this.totalCount;
  }

  /**
   * Get remaining count
   */
  public getRemainingCount(): number {
    return this.totalCount - this.caughtCount;
  }

  /**
   * Get count of fleeing or panicking employees within a radius
   * Used for dynamic music intensity
   */
  public getFleeingCountNearby(playerPosition: THREE.Vector3, radius: number): number {
    let count = 0;

    for (const employee of this.employees.values()) {
      const state = employee.getState();
      if (state === 'fleeing' || state === 'panic') {
        const distance = employee.getPosition().distanceTo(playerPosition);
        if (distance <= radius) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Check if all employees are caught
   */
  public isAllCaught(): boolean {
    return this.caughtCount >= this.totalCount;
  }

  /**
   * Set night time state for all employees
   * During night, employees will sleep and refuse to work
   */
  public setAllNightTime(isNight: boolean): void {
    for (const employee of this.employees.values()) {
      employee.setNightTime(isNight);
    }
    console.log(`[EmployeeManager] Night time ${isNight ? 'started' : 'ended'} for all employees`);
  }

  /**
   * Enable/disable X-Ray vision for all employees
   */
  public setXRayVision(enabled: boolean): void {
    for (const employee of this.employees.values()) {
      if (employee.getState() !== 'caught') {
        employee.setXRayVision(enabled);
      }
    }
    console.log(`[EmployeeManager] X-Ray vision ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clean up all employees
   */
  public dispose(): void {
    for (const employee of this.employees.values()) {
      this.scene.remove(employee.getMesh());
      employee.dispose();
    }
    this.employees.clear();
  }
}

/**
 * Default employee roster for the game - WAG Team Members
 * 24 real team members to hunt down!
 * Uses roleId to reference character models
 */
export const DEFAULT_EMPLOYEES: EmployeeData[] = [
  // Developers (Blue) - 6 people
  { name: 'Tomáš', role: 'Developer', roleId: 'developer', gender: 'male' },
  { name: 'Michal', role: 'Developer', roleId: 'developer', gender: 'male' },
  { name: 'Michal K.', role: 'Developer', roleId: 'developer', gender: 'male' },
  { name: 'Jiří', role: 'Developer', roleId: 'developer', gender: 'male' },
  { name: 'Honza', role: 'Developer', roleId: 'developer', gender: 'male' },
  { name: 'Honza K.', role: 'Developer', roleId: 'developer', gender: 'male' },

  // Backend Developers (Green) - 3 people
  { name: 'Michael', role: 'BE Developer', roleId: 'backend-developer', gender: 'male' },
  { name: 'Teodor', role: 'BE Developer', roleId: 'backend-developer', gender: 'male' },
  { name: 'Petr', role: 'BE Developer', roleId: 'backend-developer', gender: 'male' },

  // Frontend/React Developers (Cyan) - 4 people
  { name: 'Lucia', role: 'React Developer', roleId: 'frontend-developer', gender: 'female' },
  { name: 'Lenka', role: 'React Developer', roleId: 'frontend-developer', gender: 'female' },
  { name: 'Jiří R.', role: 'React Developer', roleId: 'frontend-developer', gender: 'male' },

  // Fullstack Developer (Teal) - 1 person
  { name: 'Róbert', role: 'React / JAVA Developer', roleId: 'fullstack-developer', gender: 'male' },

  // QA/Testing (Orange) - 3 people
  { name: 'Michal T.', role: 'Test Manager', roleId: 'qa-tester', gender: 'male' },
  { name: 'Karolína', role: 'Test Lead', roleId: 'qa-tester', gender: 'female' },
  { name: 'Jakub', role: 'QA Engineer', roleId: 'qa-tester', gender: 'male' },

  // Product Owners (Red) - 2 people
  { name: 'Marek', role: 'Product Owner', roleId: 'product-owner', gender: 'male' },
  { name: 'Cyril', role: 'Product Owner', roleId: 'product-owner', gender: 'male' },

  // Business Analysts (Yellow) - 2 people
  { name: 'Miloš', role: 'IT Business Analyst', roleId: 'business-analyst', gender: 'male' },
  { name: 'Ivana', role: 'Business Analyst', roleId: 'business-analyst', gender: 'female' },

  // UX Designers (Pink) - 2 people
  { name: 'Honza D.', role: 'UX Designer', roleId: 'ux-designer', gender: 'male' },
  { name: 'Hana', role: 'UX Designer', roleId: 'ux-designer', gender: 'female' },

  // UI Designer (Magenta) - 1 person
  { name: 'Adam', role: 'UI Designer', roleId: 'ui-designer', gender: 'male' },

  // Solution Architect (Purple) - 1 person
  { name: 'Tomáš A.', role: 'IT Solution Architect', roleId: 'solution-architect', gender: 'male' },
];

/**
 * Generate random employees based on available roles
 */
export function generateRandomEmployees(count: number): EmployeeData[] {
  const czechFirstNamesMale = ['Karel', 'Tomáš', 'Martin', 'Jakub', 'Petr', 'David', 'Ondřej', 'Lukáš', 'Filip', 'Adam'];
  const czechFirstNamesFemale = ['Eva', 'Lucie', 'Jana', 'Marie', 'Tereza', 'Anna', 'Kateřina', 'Petra', 'Michaela', 'Veronika'];
  const czechLastNames = ['Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Němec', 'Marek', 'Poláček', 'Král'];

  const employees: EmployeeData[] = [];

  for (let i = 0; i < count; i++) {
    const role = EMPLOYEE_ROLES[i % EMPLOYEE_ROLES.length];
    if (!role) continue;

    const randomGender = role.genders[Math.floor(Math.random() * role.genders.length)];
    const gender: Gender = randomGender ?? 'male';
    const firstNames = gender === 'male' ? czechFirstNamesMale : czechFirstNamesFemale;
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = czechLastNames[Math.floor(Math.random() * czechLastNames.length)];

    employees.push({
      name: `${firstName} ${lastName}`,
      role: role.displayName,
      roleId: role.id,
      gender: gender,
    });
  }

  return employees;
}

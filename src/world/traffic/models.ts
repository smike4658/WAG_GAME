/**
 * Traffic models ported from traffic-simulation-de
 * https://github.com/movsim/traffic-simulation-de
 *
 * Original code by Martin Treiber (movsim.org)
 * TypeScript port for WAG GAME
 */

// Noise amplitude for acceleration (can be 0 for deterministic)
const QnoiseAccel = 0;

/**
 * Intelligent Driver Model (IDM)
 * Standard car-following model
 */
export class IDM {
  public v0: number;      // Desired velocity (m/s)
  public T: number;       // Safe time headway (s)
  public s0: number;      // Minimum gap (m)
  public a: number;       // Maximum acceleration (m/s²)
  public b: number;       // Comfortable deceleration (m/s²)
  public bmax: number;    // Maximum deceleration (m/s²)
  public alpha_v0: number;
  public speedlimit: number;
  public speedmax: number;
  private driverfactor: number;
  private QnoiseAccel: number;

  constructor(v0: number, T: number, s0: number, a: number, b: number) {
    this.QnoiseAccel = QnoiseAccel;
    this.driverfactor = 1;
    this.v0 = v0;
    this.T = T;
    this.s0 = s0;
    this.a = a;
    this.b = b;
    this.alpha_v0 = 1;
    this.speedlimit = 1000;
    this.speedmax = 1000;
    this.bmax = 18;
  }

  /**
   * Calculate acceleration with noise
   */
  calcAcc(s: number, v: number, vl: number, al: number): number {
    const accRnd = this.QnoiseAccel * (Math.random() - 0.5);
    return this.calcAccDet(s, v, vl, al) + accRnd;
  }

  /**
   * Deterministic acceleration calculation
   * @param s - gap to leader (m)
   * @param v - own velocity (m/s)
   * @param vl - leader velocity (m/s)
   * @param al - leader acceleration (m/s²) - not used in IDM but for interface consistency
   */
  calcAccDet(s: number, v: number, vl: number, _al: number): number {
    // Effective desired speed
    const v0eff = Math.min(this.v0, this.speedlimit, this.speedmax) * this.alpha_v0 * this.driverfactor;
    const aeff = this.a * this.driverfactor;

    // Desired gap (s*)
    const sstar = this.s0 + Math.max(0, v * this.T + (0.5 * v * (v - vl)) / Math.sqrt(this.a * this.b));

    // Free-flow acceleration
    let accFree: number;
    if (v < v0eff) {
      accFree = aeff * (1 - Math.pow(v / v0eff, 4));
    } else {
      accFree = aeff * (1 - v / v0eff);
    }

    // Interaction (car-following) acceleration
    const accInt = -aeff * Math.pow(sstar / Math.max(s, this.s0), 2);

    // Total acceleration, clamped to max deceleration
    return Math.max(-this.bmax, accFree + accInt);
  }

  /**
   * Create a copy of this model
   */
  copy(): IDM {
    const idmCopy = new IDM(this.v0, this.T, this.s0, this.a, this.b);
    idmCopy.bmax = this.bmax;
    idmCopy.alpha_v0 = this.alpha_v0;
    idmCopy.speedlimit = this.speedlimit;
    idmCopy.speedmax = this.speedmax;
    idmCopy.driverfactor = this.driverfactor;
    return idmCopy;
  }
}

/**
 * Adaptive Cruise Control (ACC) Model
 * Extension of IDM with smoother responses and collision avoidance
 * Based on traffic-simulation-de ACC implementation
 */
export class ACC {
  public v0: number;      // Desired velocity (m/s)
  public T: number;       // Safe time headway (s)
  public s0: number;      // Minimum gap (m)
  public a: number;       // Maximum acceleration (m/s²)
  public b: number;       // Comfortable deceleration (m/s²)
  public bmax: number;    // Maximum deceleration (m/s²)
  public cool: number;    // Coolness factor (0-1, how smooth the driving is)
  public alpha_v0: number;
  public speedlimit: number;
  public speedmax: number;
  private driverfactor: number;
  private QnoiseAccel: number;

  constructor(v0: number, T: number, s0: number, a: number, b: number) {
    this.QnoiseAccel = QnoiseAccel;
    this.driverfactor = 1;
    this.v0 = v0;
    this.T = T;
    this.s0 = s0;
    this.a = a;
    this.b = b;
    this.cool = 0.90;  // Smoothness factor
    this.alpha_v0 = 1;
    this.speedlimit = 1000;
    this.speedmax = 1000;
    this.bmax = 10;  // Lower max deceleration than IDM for smoother driving
  }

  /**
   * Calculate acceleration with noise
   */
  calcAcc(s: number, v: number, vl: number, al: number): number {
    const accRnd = this.QnoiseAccel * (Math.random() - 0.5);
    return this.calcAccDet(s, v, vl, al) + accRnd;
  }

  /**
   * ACC deterministic acceleration
   * Smoother than IDM with better collision avoidance
   */
  calcAccDet(s: number, v: number, vl: number, _al: number): number {
    const v0eff = Math.min(this.v0, this.speedlimit, this.speedmax) * this.alpha_v0 * this.driverfactor;
    const aeff = this.a * this.driverfactor;

    // Free-flow acceleration
    let accFree: number;
    if (v < v0eff) {
      accFree = aeff * (1 - Math.pow(v / v0eff, 4));
    } else {
      accFree = aeff * (1 - v / v0eff);
    }

    // If gap is critically small, emergency braking
    if (s < this.s0) {
      return -this.bmax;
    }

    // Desired gap
    const sstar = this.s0 + Math.max(0, v * this.T + (0.5 * v * (v - vl)) / Math.sqrt(this.a * this.b));

    // IDM-style interaction
    const accIDM = -aeff * Math.pow(sstar / s, 2);

    // Constant Acceleration Heuristic (CAH) - collision avoidance helper
    const dvp = Math.max(v - vl, 0);
    const accCAH = (v * dvp) / (2 * s);

    // Blend IDM and CAH based on coolness
    let accInt: number;
    if (accIDM >= accCAH) {
      accInt = accIDM;
    } else {
      accInt = (1 - this.cool) * accIDM + this.cool * (accCAH + this.b * Math.tanh((accIDM - accCAH) / this.b));
    }

    // Combine free-flow and interaction
    const acc = accFree + accInt;

    // Clamp to physical limits
    return Math.max(-this.bmax, Math.min(aeff, acc));
  }

  /**
   * Create a copy of this model
   */
  copy(): ACC {
    const accCopy = new ACC(this.v0, this.T, this.s0, this.a, this.b);
    accCopy.bmax = this.bmax;
    accCopy.cool = this.cool;
    accCopy.alpha_v0 = this.alpha_v0;
    accCopy.speedlimit = this.speedlimit;
    accCopy.speedmax = this.speedmax;
    accCopy.driverfactor = this.driverfactor;
    return accCopy;
  }
}

/**
 * Vehicle types with pre-configured model parameters
 * Based on typical urban traffic values
 */
export interface VehicleModelParams {
  v0: number;   // Desired speed (units/s)
  T: number;    // Time headway (s)
  s0: number;   // Minimum gap (units)
  a: number;    // Max acceleration (units/s²)
  b: number;    // Comfortable deceleration (units/s²)
}

/**
 * Default vehicle parameters for different types
 * Scaled for game units - SLOWER for better visual effect
 * Urban city speeds: ~20-30 km/h = ~5-8 m/s (slower for gameplay)
 */
export const VEHICLE_PARAMS: Record<string, VehicleModelParams> = {
  car: {
    v0: 5,     // ~5 units/s = ~18 km/h (slow city driving)
    T: 1.5,    // 1.5s headway
    s0: 2,     // 2 unit minimum gap
    a: 1.0,    // Gentle acceleration
    b: 2.0,    // Comfortable deceleration
  },
  taxi: {
    v0: 5,     // Same as car
    T: 1.4,
    s0: 2,
    a: 1.2,
    b: 2.5,
  },
  bus: {
    v0: 4,     // Buses are slower
    T: 2.0,    // Larger headway
    s0: 4,     // Larger minimum gap
    a: 0.8,    // Slower acceleration
    b: 1.5,
  },
  truck: {
    v0: 4,     // Trucks slow
    T: 2.2,
    s0: 5,
    a: 0.6,
    b: 1.2,
  },
  tram: {
    v0: 3,     // Trams are slowest
    T: 2.5,
    s0: 6,
    a: 0.5,
    b: 1.0,
  },
  ambulance: {
    v0: 8,     // Emergency vehicles faster
    T: 1.0,
    s0: 2,
    a: 2.0,
    b: 3.0,
  },
  police: {
    v0: 8,
    T: 1.0,
    s0: 2,
    a: 2.0,
    b: 3.0,
  },
};

/**
 * MOBIL Lane-Changing Model
 * Minimizing Overall Braking Induced by Lane changes
 * Based on traffic-simulation-de by Martin Treiber
 */
export class MOBIL {
  public bSafe: number;      // Safe deceleration at max speed (m/s²)
  public bSafeMax: number;   // Safe deceleration at speed zero (m/s²)
  public p: number;          // Politeness factor (0 = egoistic)
  public bThr: number;       // Lane-changing threshold (m/s²)
  public bBiasRight: number; // Bias to the right lane (m/s²)

  constructor(
    bSafe: number = 4,
    bSafeMax: number = 20,
    p: number = 0.1,
    bThr: number = 0.2,
    bBiasRight: number = 0.3
  ) {
    this.bSafe = bSafe;
    this.bSafeMax = bSafeMax;
    this.p = p;
    this.bThr = bThr;
    this.bBiasRight = bBiasRight;
  }

  /**
   * Decide whether to change lanes
   * @param vrel - Relative velocity v/v0
   * @param acc - Current acceleration
   * @param accNew - Prospective acceleration in new lane
   * @param accLagNew - Prospective acceleration of new follower
   * @param toRight - Whether changing to right lane
   * @returns true if lane change should be executed
   */
  realizeLaneChange(
    vrel: number,
    acc: number,
    accNew: number,
    accLagNew: number,
    toRight: boolean
  ): boolean {
    const signRight = toRight ? 1 : -1;

    // Safety criterion - adaptive bSafe based on relative velocity
    const bSafeActual = vrel * this.bSafe + (1 - vrel) * this.bSafeMax;

    // Forced lane change (strong bias)
    if (signRight * this.bBiasRight > 40) {
      return true;
    }

    // Safety check - don't cut off other vehicles
    if (accLagNew < Math.min(-bSafeActual, -Math.abs(this.bBiasRight))) {
      return false;
    }

    // Incentive criterion - is the lane change beneficial?
    const dacc = accNew - acc + this.p * accLagNew
      + this.bBiasRight * signRight - this.bThr;

    // Hard-prohibit lane change against strong bias
    if (this.bBiasRight * signRight < -9) {
      return false;
    }

    return dacc > 0;
  }

  /**
   * Create a copy of this model
   */
  copy(): MOBIL {
    return new MOBIL(
      this.bSafe,
      this.bSafeMax,
      this.p,
      this.bThr,
      this.bBiasRight
    );
  }
}

/**
 * MOBIL parameters for different vehicle types
 */
export interface MOBILParams {
  bSafe: number;
  bSafeMax: number;
  p: number;
  bThr: number;
  bBiasRight: number;
}

export const MOBIL_PARAMS: Record<string, MOBILParams> = {
  car: {
    bSafe: 4,
    bSafeMax: 20,
    p: 0.1,       // Slightly polite
    bThr: 0.3,    // Low threshold = more lane changes
    bBiasRight: 0.2,
  },
  taxi: {
    bSafe: 3,
    bSafeMax: 18,
    p: 0.05,      // Less polite (taxi drivers!)
    bThr: 0.2,
    bBiasRight: 0.1,
  },
  bus: {
    bSafe: 6,
    bSafeMax: 15,
    p: 0.3,       // More polite (professional)
    bThr: 0.5,    // Higher threshold = fewer lane changes
    bBiasRight: 0.5,
  },
  truck: {
    bSafe: 5,
    bSafeMax: 12,
    p: 0.2,
    bThr: 0.6,    // Trucks change lanes less often
    bBiasRight: 0.8,
  },
  ambulance: {
    bSafe: 2,
    bSafeMax: 25,
    p: 0,         // Emergency - not polite
    bThr: 0.1,    // Low threshold
    bBiasRight: -5, // Strong bias to left (fast lane)
  },
  police: {
    bSafe: 2,
    bSafeMax: 25,
    p: 0,
    bThr: 0.1,
    bBiasRight: -5,
  },
};

/**
 * Create a MOBIL model for a vehicle type
 */
export function createMOBILModel(vehicleType: string): MOBIL {
  const typeLower = vehicleType.toLowerCase();

  let params = MOBIL_PARAMS['car']!;

  for (const [key, p] of Object.entries(MOBIL_PARAMS)) {
    if (typeLower.includes(key)) {
      params = p;
      break;
    }
  }

  return new MOBIL(params.bSafe, params.bSafeMax, params.p, params.bThr, params.bBiasRight);
}

/**
 * Create an ACC model for a vehicle type
 */
export function createVehicleModel(vehicleType: string): ACC {
  const typeLower = vehicleType.toLowerCase();

  // Find matching params
  let params = VEHICLE_PARAMS['car']!; // Default to car

  for (const [key, p] of Object.entries(VEHICLE_PARAMS)) {
    if (typeLower.includes(key)) {
      params = p;
      break;
    }
  }

  return new ACC(params.v0, params.T, params.s0, params.a, params.b);
}

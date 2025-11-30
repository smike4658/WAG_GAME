# WAG GAME - Implementation Plan v2

**Date:** 2025-11-28
**Status:** Ready for implementation
**Previous Plan:** [2025-11-27-wag-game-design.md](./2025-11-27-wag-game-design.md)

---

## Problem Statement

The original implementation had issues with city generation from OpenStreetMap data. This plan starts fresh with a **procedural city approach** using proven libraries, while keeping all game logic from the original design.

---

## Key Changes from Original Plan

| Aspect | Original Plan | New Plan |
|--------|---------------|----------|
| **City Source** | OpenStreetMap (Ostrava) | Procedural generation (gen-city) |
| **3D Assets** | Sketchfab individual models | Complete asset pack (Sketchfab Urban City) |
| **Player Controller** | Custom implementation | charactercontroller (npm) |
| **Audio** | Custom spatial audio | Howler.js (npm) |
| **Timer** | Custom implementation | EasyTimer.js (npm) |
| **Traffic** | Custom waypoints | Waypoints + simplified IDM |
| **Pathfinding** | Custom | PathFinding.js (npm) |

---

## Technology Stack

### NPM Dependencies

```json
{
  "dependencies": {
    "three": "^0.181.0",
    "@dimforge/rapier3d-compat": "^0.19.0",
    "gsap": "^3.12.0",
    "gen-city": "^1.0.0",
    "charactercontroller": "^1.0.0",
    "pathfinding": "^0.4.18",
    "howler": "^2.2.4",
    "easytimer.js": "^4.5.0"
  }
}
```

### 3D Assets

**Primary Asset Pack:** [Free Low Poly Simple Urban City 3D Asset Pack](https://sketchfab.com/3d-models/310c806355814c3794f5e3022b38db85)

| Category | Count | Details |
|----------|-------|---------|
| **Vehicles** | 35 | Cars, trucks, buses, emergency vehicles |
| **Street Props** | 35 | Signs, bus stops, trees, trash, traffic lights |
| **Road Paths** | 15 | Railways, crossroads, etc. |
| **Buildings** | 9 | City houses, cottage |

**Format:** FBX (convert to GLTF for Three.js)

---

## Game Design (Unchanged)

### Core Concept

- **Title:** WAG GAME
- **Genre:** 3D Chase/Collection Game
- **Platform:** Web Browser
- **Play Time:** ~5 minutes per session

### Controls

| Input | Action |
|-------|--------|
| WASD | Movement |
| Space | Jump |
| Mouse | Look around |
| Left Click | Throw net |

### Win/Lose Conditions

- **Win:** Catch all employees within 5 minutes
- **Partial Victory:** Time runs out with some caught

---

## Characters

### Player: Jirka (Head of Team)

- Wavy brown hair, navy blue blazer
- Holding glowing net launcher
- Animations: Idle, Walk, Run, Jump, Throw, Celebrate

### Employees (20 NPCs)

| Role | Visual | Flee Pattern |
|------|--------|--------------|
| Developer | Hoodie + headphones | Zigzag |
| DevOps | T-shirt + beard | Straight sprint |
| Product Owner | Business casual | Hide behind objects |
| Analyst | Formal shirt + glasses | Calculated routes |
| Tester | Detective look | Check surroundings |
| UX Designer | Colorful outfit + beret | Creative paths |

### Czech Voice Lines (ElevenLabs TTS)

| Role | Phrases |
|------|---------|
| Developer | "Ne! Mam jeste bug!" / "Nechci do prace!" |
| DevOps | "Server pada!" / "Pomoc!" |
| Product Owner | "Mam meeting!" / "Backlog!" |
| Analyst | "Data nejsou ready!" / "Pockej!" |
| Tester | "Nasel jsem bug!" / "Utikam!" |
| UX Designer | "Muj design!" / "Ne ne ne!" |

---

## Gameplay Mechanics

### Net Launcher

| Property | Value |
|----------|-------|
| Range | 20 meters |
| Travel Speed | Medium |
| Cooldown | 1 second |
| Visual | Expanding net projectile |

### Employee Behavior (State Machine)

| State | Trigger | Action |
|-------|---------|--------|
| Idle | Default | Walk around, chat |
| Alert | Player < 15m | Stop, look nervously |
| Flee | Player < 10m | Run away, scream |
| Caught | Net collision | Poof effect, disappear |

### Traffic System

- **Cars:** Waypoint-based movement with simplified IDM
- **Traffic Lights:** Timer-based state machine (green/yellow/red)
- **Pedestrians:** PathFinding.js A* on walkable grid

---

## Project Structure

```
WAG_GAME/
├── src/
│   ├── main.ts                    # Entry point
│   ├── config/
│   │   ├── employees.ts           # Employee names/roles
│   │   └── gameSettings.ts        # Game configuration
│   ├── core/
│   │   ├── Game.ts                # Main game loop
│   │   ├── AssetLoader.ts         # GLTF loading
│   │   └── InputManager.ts        # Input handling
│   ├── player/
│   │   ├── PlayerController.ts    # charactercontroller wrapper
│   │   └── NetLauncher.ts         # Catch mechanic (raycaster)
│   ├── entities/
│   │   ├── Employee.ts            # NPC with state machine
│   │   ├── EmployeeManager.ts     # Spawn and manage 20 NPCs
│   │   ├── Pedestrian.ts          # Ambient walkers
│   │   └── Vehicle.ts             # Traffic car
│   ├── world/
│   │   ├── CityGenerator.ts       # gen-city integration
│   │   ├── CityRenderer.ts        # Place 3D models on city data
│   │   ├── TrafficManager.ts      # Vehicle spawning and routing
│   │   └── TrafficLight.ts        # Signal state machine
│   ├── ai/
│   │   ├── FleeAI.ts              # Steering behaviors
│   │   ├── PathGrid.ts            # 2D grid for pathfinding
│   │   └── StateMachine.ts        # Generic state machine
│   ├── ui/
│   │   ├── HUD.ts                 # Timer, progress display
│   │   ├── MiniMap.ts             # Orthographic camera overlay
│   │   └── Screens.ts             # Title, Win, Partial screens
│   ├── audio/
│   │   ├── AudioManager.ts        # Howler.js wrapper
│   │   └── VoiceClips.ts          # Czech voice line mapping
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── public/
│   └── assets/
│       ├── models/                # GLTF/GLB files
│       │   ├── city/              # Urban City Pack
│       │   ├── characters/        # Player + employees
│       │   └── props/             # Net, effects
│       └── audio/                 # Voice clips, SFX
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Implementation Phases

### Phase 1: Project Setup & City Generation
**Estimated tasks: 8**

1. [ ] Clean up existing src/ (remove old OSM code)
2. [ ] Install new dependencies (gen-city, charactercontroller, pathfinding, howler, easytimer.js)
3. [ ] Download Sketchfab Urban City Pack (model ID: 310c806355814c3794f5e3022b38db85)
4. [ ] Convert FBX assets to GLTF format
5. [ ] Create CityGenerator.ts with gen-city integration
6. [ ] Create CityRenderer.ts to place 3D models
7. [ ] Generate basic city layout (roads + building positions)
8. [ ] Test city rendering in browser

### Phase 2: Player Controller & Movement
**Estimated tasks: 6**

1. [ ] Integrate charactercontroller npm package
2. [ ] Create PlayerController.ts wrapper
3. [ ] Configure WASD + Space (jump) + Mouse look
4. [ ] Add player collision with buildings
5. [ ] Create simple player mesh (placeholder or model)
6. [ ] Test movement in generated city

### Phase 3: Net Launcher (Catch Mechanic)
**Estimated tasks: 5**

1. [ ] Create NetLauncher.ts with Three.js Raycaster
2. [ ] Implement cooldown timer (1 second)
3. [ ] Add net projectile visual (expanding mesh)
4. [ ] Detect collision with NPC entities
5. [ ] Add catch feedback (particle effect, sound)

### Phase 4: Employees (NPCs)
**Estimated tasks: 8**

1. [ ] Create Employee.ts with state machine (idle/alert/flee/caught)
2. [ ] Create EmployeeManager.ts for spawning 20 NPCs
3. [ ] Implement FleeAI.ts (steering behaviors)
4. [ ] Add detection radius (15m alert, 10m flee)
5. [ ] Create employee visual variations (6 roles)
6. [ ] Implement flee patterns per role
7. [ ] Add "caught" animation and removal
8. [ ] Test NPC behavior in city

### Phase 5: Audio System
**Estimated tasks: 6**

1. [ ] Create AudioManager.ts with Howler.js
2. [ ] Generate Czech voice clips (ElevenLabs MCP)
3. [ ] Map voice clips to employee roles (VoiceClips.ts)
4. [ ] Implement spatial 3D audio (position-based)
5. [ ] Add scream trigger on flee state
6. [ ] Add ambient city sounds (optional)

### Phase 6: Traffic & Pedestrians
**Estimated tasks: 7**

1. [ ] Create TrafficManager.ts for vehicle spawning
2. [ ] Define road waypoints from gen-city output
3. [ ] Implement Vehicle.ts with waypoint following
4. [ ] Create TrafficLight.ts state machine
5. [ ] Add vehicle stopping at red lights
6. [ ] Create PathGrid.ts for pedestrian walkable areas
7. [ ] Implement Pedestrian.ts with PathFinding.js

### Phase 7: UI & HUD
**Estimated tasks: 6**

1. [ ] Create HUD.ts with EasyTimer.js countdown (5 min)
2. [ ] Add employee progress display (X/20 caught)
3. [ ] Create MiniMap.ts (orthographic camera overlay)
4. [ ] Create Title screen with controls info
5. [ ] Create Win screen (team photo)
6. [ ] Create Partial Victory screen

### Phase 8: Polish & Testing
**Estimated tasks: 5**

1. [ ] Add particle effects (net, catch poof)
2. [ ] Fine-tune NPC flee speeds and patterns
3. [ ] Optimize performance (LOD, culling)
4. [ ] Cross-browser testing
5. [ ] Final gameplay balancing

---

## Libraries Reference

### gen-city (City Layout)

```typescript
import { City } from 'gen-city';

const city = new City({ width: 500, height: 500 });

await city.generate({
  streetMinLength: 15,
  probabilityIntersection: 0.1,
});

// Get data for rendering
const roads = city.getAllPaths();      // Road segments
const buildings = city.getAllBuildings(); // Building positions
```

### charactercontroller (Player)

```typescript
import CharacterController from 'charactercontroller';

const controller = new CharacterController({
  // Input mappings: WASD, Space, Shift
  jumpForce: 10,
  movementSpeed: 5,
});
```

### PathFinding.js (Pedestrians)

```typescript
import PF from 'pathfinding';

const grid = new PF.Grid(100, 100);
// Mark buildings as unwalkable
grid.setWalkableAt(x, y, false);

const finder = new PF.AStarFinder({ allowDiagonal: true });
const path = finder.findPath(startX, startY, endX, endY, grid.clone());
```

### Howler.js (Audio)

```typescript
import { Howl, Howler } from 'howler';

const scream = new Howl({
  src: ['/assets/audio/scream.mp3'],
  volume: 0.8,
});

// 3D spatial audio
scream.pos(npc.position.x, npc.position.y, npc.position.z);
scream.play();
```

### EasyTimer.js (Game Timer)

```typescript
import { Timer } from 'easytimer.js';

const timer = new Timer();
timer.start({ countdown: true, startValues: { minutes: 5 } });

timer.on('secondsUpdated', () => {
  updateHUD(timer.getTimeValues().toString());
});

timer.on('targetAchieved', () => {
  endGame();
});
```

---

## Asset Download Commands

### Sketchfab Urban City Pack

```bash
# Using Sketchfab MCP server
mcp__sketchfab__sketchfab-download(
  modelId: "310c806355814c3794f5e3022b38db85",
  format: "gltf",
  outputPath: "./public/assets/models/city"
)
```

### ElevenLabs Voice Generation

```bash
# Using ElevenLabs MCP server
mcp__elevenlabs__text_to_speech(
  text: "Nechci do prace!",
  language: "cs",
  output_directory: "./public/assets/audio/voices"
)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| gen-city output doesn't match 3D assets | Create mapping layer in CityRenderer.ts |
| charactercontroller conflicts with Rapier | Use Rapier only for NPC physics, not player |
| Asset pack missing needed models | Supplement with Kenney CC0 assets |
| Performance issues with many NPCs | Implement LOD and view frustum culling |

---

## Success Criteria

- [ ] Player can walk around procedurally generated city
- [ ] 20 employees spawn and flee when approached
- [ ] Net launcher catches employees on hit
- [ ] Czech voice lines play with spatial audio
- [ ] Timer counts down from 5 minutes
- [ ] Win/Partial Victory screens display correctly
- [ ] Game runs at 60 FPS in Chrome

---

## References

- [gen-city GitHub](https://github.com/neki-dev/gen-city)
- [charactercontroller GitHub](https://github.com/malted/charactercontroller)
- [PathFinding.js GitHub](https://github.com/qiao/PathFinding.js)
- [Howler.js Documentation](https://howlerjs.com/)
- [EasyTimer.js Documentation](https://albert-gonzalez.github.io/easytimer.js/)
- [Sketchfab Urban City Pack](https://sketchfab.com/3d-models/310c806355814c3794f5e3022b38db85)
- [Original Design Document](./2025-11-27-wag-game-design.md)

---

*Plan created during implementation planning session with Claude Code*

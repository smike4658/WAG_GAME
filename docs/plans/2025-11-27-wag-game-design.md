# WAG GAME - Design Document

**Date:** 2025-11-27
**Purpose:** 3D browser game for "vibe coding" presentation to colleagues
**Location:** Real Ostrava - Masarykovo náměstí

---

## Executive Summary

A 3D browser game where **Jirka** (Head of Team) must recruit employees scattered throughout a low-poly recreation of **Masarykovo náměstí in Ostrava**. Players navigate familiar streets, chase fleeing colleagues who scream in Czech, and catch them with a net launcher.

---

## Presentation Highlights (Tech Pipeline)

### "Vibe Coding" Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP-POWERED PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Overpass    │───▶│  GeoJSON    │───▶│  Three.js   │         │
│  │ API (OSM)   │    │  Buildings  │    │  Low-Poly   │         │
│  │             │    │  Roads      │    │  3D Scene   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                                      ▲                 │
│        ▼                                      │                 │
│  REAL OSTRAVA DATA                    RENDERED IN BROWSER       │
│  (Masarykovo nám.)                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Sketchfab   │───▶│  GLB/GLTF   │───▶│  In-Game    │         │
│  │ MCP Server  │    │  Models     │    │  Assets     │         │
│  │             │    │  (low-poly) │    │             │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                                                        │
│        ▼                                                        │
│  PROFESSIONAL 3D ASSETS                                         │
│  (cars, trees, characters)                                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ ElevenLabs  │───▶│  Czech TTS  │───▶│  Spatial    │         │
│  │ MCP Server  │    │  Audio      │    │  3D Audio   │         │
│  │             │    │  Clips      │    │             │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                                                        │
│        ▼                                                        │
│  AI-GENERATED CZECH VOICES                                      │
│  ("Nechci do práce!", "Pomoc!")                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### MCP Servers Configured

| MCP Server | Purpose | API Key |
|------------|---------|---------|
| **Sketchfab** | Search & download 3D models | `4237e1db...` |
| **ElevenLabs** | Generate Czech voice clips | `sk_1571...` |

### Key Presentation Points

1. **Real-World Data → Game World**
   - OpenStreetMap data for actual Ostrava streets
   - Buildings extruded from real footprints
   - Landmarks recognizable (Cathedral, Old Town Hall)

2. **AI-Powered Asset Pipeline**
   - Claude + MCP servers = automated asset sourcing
   - Sketchfab for professional 3D models
   - ElevenLabs for Czech voice synthesis

3. **Modern Web Stack**
   - Vite + TypeScript (fast development)
   - Three.js (3D rendering)
   - Rapier.js (WebAssembly physics)
   - Runs entirely in browser

---

## Game Design

### Core Concept

**Title:** WAG GAME
**Genre:** 3D Chase/Collection Game
**Platform:** Web Browser
**Play Time:** ~5 minutes per session

### Story

*"Help Jirka recruit the ultimate team before the deadline!"*

Jirka, the Head of Team, must catch employees who are scattered around Ostrava's main square. They don't want to go to work and will run away screaming in Czech!

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
- **Display:** Team photo celebration / "Team needs more members!"

---

## Location: Masarykovo náměstí, Ostrava

### GPS Coordinates

**Center:** `49.8357°N, 18.2927°E`
**Bounding Box:** `49.832, 18.287` to `49.839, 18.298` (~500m × 500m)

### Landmarks to Include

| Landmark | GPS | Game Feature |
|----------|-----|--------------|
| **Cathedral of Divine Savior** | 49.8358, 18.2890 | Tallest building, navigation aid |
| **Old Town Hall** | SE corner | Central historic building |
| **Church of St. Wenceslas** | 49.8358, 18.2948 | Eastern marker |
| **Masaryk Statue** | Square center | **Player spawn point** |
| **Stodolní Street** | 49.8355, 18.2837 | Western zone |

### Overpass API Query

```
[out:json][bbox:49.832,18.287,49.839,18.298];
(
  way["building"];
  way["highway"];
  way["landuse"];
  node["amenity"];
  relation["building"];
);
out geom;
```

### Zone Layout

```
┌─────────────────────────────────────────┐
│                                         │
│   CATHEDRAL        MAIN SQUARE          │
│   (Divine Savior)  (Masarykovo nám.)    │
│                    [PLAYER SPAWN]       │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│   STODOLNÍ ST.     OLD TOWN            │
│   (Party zone)     (Historic)           │
│                                         │
└─────────────────────────────────────────┘
```

---

## Visual Style

### Art Direction

- **Style:** Low-poly with warm colors (reference: sunset lighting)
- **Palette:** Golden hour atmosphere, saturated building colors
- **Lighting:** Soft shadows, ambient occlusion
- **Assets:** Sketchfab low-poly models + OSM-derived geometry

### Building Height Strategy

| OSM Tag | Height |
|---------|--------|
| `building:levels=N` | N × 3.5m |
| `height=X` | Exact value |
| `building=cathedral` | 50m (landmark) |
| `building=church` | 30m |
| `building=house` | 8-12m |
| No tag | Random 6-15m |

---

## Characters

### Player: Jirka (Head of Team)

**Based on real photo:**
- Wavy brown hair (distinctive silhouette)
- Clean-shaven, friendly expression
- Navy blue blazer / business casual
- Holding glowing net launcher

**Animations:**
- Idle, Walk, Run, Jump, Throw, Celebrate

### Employees (Configurable)

**Archetypes (6 roles):**

| Role | Visual | Distinct Feature | Flee Pattern |
|------|--------|------------------|--------------|
| Developer | Hoodie | Headphones, coffee | Zigzag |
| DevOps | T-shirt + beard | Terminal icon | Straight sprint |
| Product Owner | Business casual | Clipboard | Hide behind objects |
| Analyst | Formal shirt | Big glasses | Calculated routes |
| Tester | Detective look | Magnifying glass | Check surroundings |
| UX Designer | Colorful outfit | Beret | Creative paths |

**Configuration File:** `src/config/employees.ts`
- Names: TBD (to be updated with real colleague names)
- Count: TBD (to be updated with actual team size)

### Czech Voice Lines (ElevenLabs TTS)

| Role | Example Phrases |
|------|-----------------|
| Developer | "Ne! Mám ještě bug!" / "Nechci do práce!" |
| DevOps | "Server padá!" / "Pomoc!" |
| Product Owner | "Mám meeting!" / "Backlog!" |
| Analyst | "Data nejsou ready!" / "Počkej!" |
| Tester | "Našel jsem bug!" / "Utíkám!" |
| UX Designer | "Můj design!" / "Ne ne ne!" |

---

## Gameplay Mechanics

### Net Launcher

| Property | Value |
|----------|-------|
| Range | 20 meters |
| Travel Speed | Medium |
| Cooldown | 1 second |
| Visual | Expanding net projectile |

### Employee Behavior

| State | Trigger | Action |
|-------|---------|--------|
| Idle | Default | Walk around, chat |
| Alert | Player < 15m | Stop, look nervously |
| Flee | Player < 10m | Run away, scream |
| Caught | Net collision | Poof effect, disappear |

### Ambient City

- **Pedestrians:** Generic walkers (non-catchable, add life)
- **Traffic:** Simple path-following cars
- **Traffic Lights:** Visual decoration, cars pause at waypoints

---

## User Interface

### HUD Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────┐                                    ┌────────┐  │
│  │  04:32  │                                    │ MINIMAP│  │
│  │   ⏱️    │                                    │   ◉ ◉  │  │
│  └─────────┘                                    └────────┘  │
│                                                             │
│                      [ GAME VIEW ]                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   👤👤👤👤👤 👤👤👤👤👤 👤👤👤👤👤 👤👤👤👤👤   │  │
│  │   ✓ ✓ ○ ○ ○  ○ ○ ○ ○ ○  ○ ○ ○ ○ ○  ○ ○ ○ ○ ○    │  │
│  │              "X/Y Employees Recruited"                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Screens

1. **Title Screen:** Game title + "Help Jirka recruit the team!" + Controls
2. **Win Screen:** Team photo with all employees + "TEAM COMPLETE!"
3. **Partial Victory:** Caught shown in color, missing grayed out

---

## Technical Architecture

### Project Structure

```
WAG_GAME/
├── src/
│   ├── main.ts
│   ├── config/
│   │   ├── employees.ts      # ← UPDATE NAMES HERE
│   │   └── gameSettings.ts
│   ├── core/
│   │   ├── Game.ts
│   │   ├── AssetLoader.ts
│   │   └── InputManager.ts
│   ├── entities/
│   │   ├── Player.ts
│   │   ├── Employee.ts
│   │   ├── Pedestrian.ts
│   │   └── Vehicle.ts
│   ├── world/
│   │   ├── OstravaLoader.ts  # Overpass API → 3D
│   │   ├── BuildingExtruder.ts
│   │   └── TrafficSystem.ts
│   ├── weapons/
│   │   └── NetLauncher.ts
│   ├── ui/
│   │   ├── HUD.ts
│   │   ├── ProgressBar.ts
│   │   ├── MiniMap.ts
│   │   └── Screens.ts
│   ├── audio/
│   │   ├── AudioManager.ts
│   │   └── CzechVoices.ts
│   └── types/
│       └── index.ts
├── public/
│   └── assets/
│       ├── models/           # Sketchfab GLBs
│       └── audio/            # ElevenLabs clips
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Dependencies

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@dimforge/rapier3d-compat": "^0.12.0",
    "gsap": "^3.12.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/three": "^0.160.0"
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Vite + TypeScript project setup
- [ ] Three.js scene, camera, renderer
- [ ] Basic lighting and skybox
- [ ] First-person camera controls

### Phase 2: Ostrava World
- [ ] Overpass API data fetch
- [ ] GeoJSON → 3D building extrusion
- [ ] Road surface generation
- [ ] Landmark identification and styling
- [ ] Sketchfab asset integration

### Phase 3: Player
- [ ] Jirka character model
- [ ] Physics-based movement (Rapier.js)
- [ ] Jump mechanics
- [ ] Net launcher implementation

### Phase 4: Employees
- [ ] Configurable employee system
- [ ] Spawn placement
- [ ] Flee AI behavior
- [ ] Detection and alert states

### Phase 5: Audio
- [ ] Generate Czech phrases (ElevenLabs)
- [ ] Spatial 3D audio
- [ ] Catch sound effects

### Phase 5b: Ambient Sounds (Can Add Later)
- [ ] City background atmosphere loop
- [ ] Car engine sounds (moving vehicles)
- [ ] Tram bells (very Ostrava!)
- [ ] Distant crowd chatter
- [ ] Footsteps (player & NPCs)
- [ ] Wind / birds ambient layer

### Phase 6: Traffic
- [ ] Path-following cars
- [ ] Ambient pedestrians
- [ ] Traffic light visuals

### Phase 7: UI & Polish
- [ ] HUD (timer, progress, minimap)
- [ ] Title/Win/Partial screens
- [ ] Particle effects
- [ ] Final testing

### Phase 8 (Future Enhancement)
- [ ] SUMO traffic simulation integration
- [ ] More realistic vehicle behavior
- [ ] Pedestrian pathfinding

---

## Future Enhancements

### SUMO Integration (Optional)

If time permits, integrate [SUMO](https://eclipse.dev/sumo/) for professional traffic simulation:

```
┌──────────────┐    WebSocket    ┌──────────────┐
│  SUMO Server │◄──────────────►│  Three.js    │
│   (Python)   │                 │   Client     │
└──────────────┘                 └──────────────┘
```

Use [sumo-web3d](https://github.com/sidewalklabs/sumo-web3d) for ready integration.

---

## Resources

### APIs & Tools

- [Overpass Turbo](https://overpass-turbo.eu/) - OSM query testing
- [Sketchfab](https://sketchfab.com/) - 3D model marketplace
- [ElevenLabs](https://elevenlabs.io/) - AI voice synthesis
- [Three.js](https://threejs.org/) - 3D library
- [Rapier](https://rapier.rs/) - Physics engine

### References

- [sumo-web3d](https://github.com/sidewalklabs/sumo-web3d)
- [Three.js-City](https://github.com/mauriciopoppe/Three.js-City)
- [threex.proceduralcity](https://github.com/jeromeetienne/threex.proceduralcity)

---

*Document created during brainstorming session with Claude Code*

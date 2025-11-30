# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WAG GAME is a 3D browser game for a "vibe coding" presentation. The player (Jirka, Head of Team) must catch employees scattered throughout a low-poly recreation of Masarykovo namesti in Ostrava. Employees flee and scream in Czech when the player approaches.

**Target Platform:** Web Browser (Vite + TypeScript + Three.js)

## Development Commands

### Main Game (not yet implemented)
```bash
# Install dependencies
npm install

# Development server with hot reload
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

### Sketchfab MCP Server (sketchfab-mcp-server/)
```bash
cd sketchfab-mcp-server

# Build TypeScript
npm run build

# Run the MCP server
npm start

# Development mode with tsx
npm run dev

# Run tests
npm run test

# Lint
npm run lint
```

## Architecture

### MCP-Powered Asset Pipeline

The project uses MCP (Model Context Protocol) servers for AI-assisted asset sourcing:

```
OpenStreetMap (Overpass API) -> GeoJSON -> Three.js Low-Poly Scene
Sketchfab MCP Server -> GLB/GLTF Models -> In-Game Assets
ElevenLabs MCP Server -> Czech TTS Audio -> Spatial 3D Audio
Gemini MCP Server -> Imagen 4 -> Reference Images -> Tripo3D -> 3D Props (300 FREE/month!)
```

### Planned Project Structure

```
src/
  main.ts                    # Entry point
  config/
    employees.ts             # Employee names/roles (update with real colleague names)
    gameSettings.ts          # Game configuration
  core/
    Game.ts                  # Main game loop
    AssetLoader.ts           # Asset loading orchestration
    InputManager.ts          # WASD, mouse, space controls
  entities/
    Player.ts                # Jirka character with net launcher
    Employee.ts              # NPCs with flee AI
    Pedestrian.ts            # Ambient walkers (non-catchable)
    Vehicle.ts               # Traffic cars
  world/
    OstravaLoader.ts         # Overpass API -> 3D conversion
    BuildingExtruder.ts      # GeoJSON building footprints -> 3D
    TrafficSystem.ts         # Simple path-following traffic
  weapons/
    NetLauncher.ts           # Catch mechanic (LMB, 20m range, 1s cooldown)
  ui/
    HUD.ts                   # Timer, progress, minimap
  audio/
    AudioManager.ts          # Spatial 3D audio system
    CzechVoices.ts           # ElevenLabs voice clips
```

### Key Technologies

- **Three.js** - 3D rendering
- **Rapier.js** (@dimforge/rapier3d-compat) - WebAssembly physics engine
- **GSAP** - Animation
- **Vite** - Build tool
- **TypeScript** - Strict mode enabled

### Game Location

Real-world data from OpenStreetMap:
- **Center:** 49.8357N, 18.2927E (Masarykovo namesti, Ostrava)
- **Bounding Box:** 49.832,18.287 to 49.839,18.298 (~500m x 500m)
- **Player Spawn:** Masaryk Statue (square center)

### Building Height Strategy

When extruding buildings from OSM data:
| OSM Tag | Height |
|---------|--------|
| `building:levels=N` | N * 3.5m |
| `height=X` | Exact value |
| `building=cathedral` | 50m |
| `building=church` | 30m |
| `building=house` | 8-12m |
| No tag | Random 6-15m |

## Type Safety

- Never use `any` type - always create proper interfaces
- TypeScript strict mode is enabled

## Git Workflow

**IMPORTANT:** After completing any implementation task, ALWAYS commit and push changes to the repository.

### After Completing Implementation

1. Stage all changes: `git add .`
2. Create a descriptive commit message summarizing what was implemented
3. Push to origin: `git push`

### Commit Message Format

```
<type>: <short description>

<optional longer description>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

### When to Commit

- After completing a feature or fix
- After significant refactoring
- Before switching to a different task
- When user explicitly asks

**Do NOT commit:**
- Work in progress with broken builds
- Temporary debug code
- Sensitive data (check .gitignore)

## MCP Server Configuration

The Sketchfab MCP server requires an API key:
```bash
# Via command line
node build/index.js --api-key YOUR_API_KEY

# Or via environment variable
export SKETCHFAB_API_KEY=YOUR_API_KEY
```

Available MCP tools:
- `sketchfab-search` - Search for 3D models
- `sketchfab-model-details` - Get model information
- `sketchfab-download` - Download models (gltf, glb, usdz, source formats)

## Browser Testing with Puppeteer MCP

**IMPORTANT:** After implementing new features, ALWAYS use the Puppeteer MCP server to verify the implementation works correctly in the browser.

### When to Use Puppeteer Testing

Use Puppeteer MCP server to test:
- New UI components and HUD elements
- Game rendering and Three.js scene setup
- User interactions (mouse, keyboard)
- Visual regressions after changes
- Performance in the browser environment

### Testing Workflow

1. Start the dev server: `npm run dev`
2. Use Puppeteer MCP tools to:
   - Navigate to `http://localhost:5173`
   - Take screenshots of the game state
   - Interact with game elements
   - Verify visual output matches expectations

### Available Puppeteer MCP Tools

- `puppeteer_navigate` - Navigate to a URL
- `puppeteer_screenshot` - Capture screenshots for visual verification
- `puppeteer_click` - Click on elements
- `puppeteer_fill` - Fill input fields
- `puppeteer_evaluate` - Execute JavaScript in browser context
- `puppeteer_select` - Select from dropdowns

### Example Testing Sequence

```
1. Navigate to localhost:5173
2. Wait for Three.js scene to load
3. Take screenshot to verify rendering
4. Simulate keyboard input (WASD)
5. Take screenshot to verify player movement
6. Check console for errors
```

## Character Asset Workflow

### Creating Animated Characters with Blender MCP

Use the `blender-character` skill for detailed guidance. Quick reference:

#### Required Animation Names (case-insensitive)
| Animation | Required | Description |
|-----------|----------|-------------|
| `Idle` | YES | Standing still |
| `Walk` | YES | Walking cycle |
| `Run` | Recommended | Running cycle |
| `Flee` | Recommended | Panicked running |

#### Commands
- `/wag:model-create <name>` - Create new character with Blender MCP
- `/wag:model-validate <path>` - Validate GLB meets requirements
- `/wag:assets <type>` - Download assets from Sketchfab

#### Configuration
Add characters to `src/config/characters.ts`:
```typescript
{
  id: 'role-id',
  displayName: 'Role Name',
  displayNameCz: 'Czech Name',
  genders: ['male', 'female'],
  models: {
    male: {
      path: 'assets/models/character.glb',
      sketchfabId: 'custom-blender-model',
      name: 'Character Name',
      animated: true,
      rigged: true,
      hasNamedAnimations: true,
    },
  },
},
```

### Technical Notes

#### SkeletonUtils.clone() - IMPORTANT
The `CharacterLoader` uses `SkeletonUtils.clone()` instead of regular `clone()` for skinned meshes. This is critical because:
- Regular `clone()` shares skeletons between instances
- Shared skeletons cause all instances to animate identically
- `SkeletonUtils.clone()` creates independent skeletons

If you encounter animation issues with multiple character instances, this is likely the cause.

#### Animation System Flow
```
CharacterLoader.getCharacterModel()     → SkeletonUtils.clone(gltf.scene)
CharacterLoader.getCharacterAnimations() → Returns AnimationClip[]
Employee constructor                     → Creates AnimationMixer
Employee.setupAnimations()               → Maps clips to actions by name
Employee.update()                        → mixer.update(deltaTime)
Employee.playAnimation()                 → Crossfades between animations
```

#### Root Motion Warning
Avoid translation keyframes on the Root bone. The game moves characters via code (`mesh.position`), so root motion in animations would conflict.

### Validation Checklist

Before integrating a new character:
- [ ] Has Idle animation
- [ ] Has Walk animation
- [ ] Animation names match conventions
- [ ] GLB file under 500KB
- [ ] Polygon count within budget (500-2000 for NPCs)
- [ ] Config added to characters.ts
- [ ] `hasNamedAnimations: true` in config
- [ ] Tested in-game with multiple instances

## Static Prop Asset Workflow

### Creating Props with AI Pipeline

Use the `imagen-to-3d` skill for intelligent pipeline selection. Quick reference:

#### Commands
- `/wag:prop-create <description>` - Create static prop using AI pipeline

#### Pipeline Decision Matrix (FREE-FIRST)

| Prop Type | Recommended Pipeline | Cost |
|-----------|---------------------|------|
| Complex visual (vehicles, furniture) | Sketchfab download | FREE |
| Custom AI-generated | Imagen → Tripo3D | 300 FREE/month |
| Architectural (walls, platforms) | Direct Blender code | FREE |
| Nature (trees, rocks) | Polyhaven or Sketchfab | FREE |
| Simple geometric (poles, signs) | Direct Blender code | FREE |
| Textures only | Imagen | Low cost |

#### Imagen → Tripo3D Flow
```
1. mcp__gemini__imagen-generate (concept image)
2. Tripo3D web UI or MCP (image to 3D) - 300 FREE credits/month!
3. Download GLB from Tripo3D
4. Import to Blender for post-processing
5. Scale, materials, origin adjustment
6. Export GLB to assets/models/props/
```

Get free Tripo3D API key: https://www.tripo3d.ai/

#### Prompt Tips for Imagen
- Add "isometric view" or "front view" for cleaner 3D conversion
- Add "white background" for better model extraction
- Include "low-poly" to match WAG GAME aesthetic
- Specify "3D game asset" style

### Gemini MCP Server Configuration

Located at `gemini-mcp-server/`. Provides:
- `imagen-generate` - Generate images via Imagen 4
- `gemini-image-generate` - Generate/edit via Gemini (Nano Banana)
- `gemini-analyze-image` - Analyze images with Gemini vision

Environment variables:
- `GEMINI_API_KEY` - Google AI API key (required)
- `GEMINI_OUTPUT_DIR` - Output directory for generated images

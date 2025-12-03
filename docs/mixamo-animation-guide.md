# Mixamo Animation Guide for WAG GAME Characters

This guide explains how to add walk/run/idle animations to the Low Poly People characters using Mixamo.

## Exported Characters

The following FBX files are ready for Mixamo upload:

| File | Character | Use For |
|------|-----------|---------|
| `casual_female_g_for_mixamo.fbx` | Female office worker | Frontend Dev, React Dev |
| `casual_female_k_for_mixamo.fbx` | Female with hair accessory | UI/UX Designer |
| `casual_male_g_for_mixamo.fbx` | Male office worker (shirt) | Developer, BE Dev |
| `casual_male_k_for_mixamo.fbx` | Male casual (jacket) | Product Owner, Architect |
| `doctor_male_for_mixamo.fbx` | Male with formal look | Business Analyst |
| `elder_female_for_mixamo.fbx` | Mature female | Test Manager |

Location: `assets/models/exports/`

## Step-by-Step Mixamo Workflow

### Step 1: Upload Character

1. Go to [mixamo.com](https://www.mixamo.com/) and sign in (free Adobe account)
2. Click **"Upload Character"** button
3. Select one of the FBX files from `assets/models/exports/`
4. Wait for auto-rigging (Mixamo will detect the skeleton)

### Step 2: Verify Auto-Rig

Mixamo will show a preview with markers:
- **Chin** - on the character's chin
- **Wrists** - on both wrists
- **Elbows** - on both elbows
- **Knees** - on both knees
- **Groin** - at the pelvis center

If markers are misplaced, drag them to correct positions. Click **"Next"** when ready.

### Step 3: Download Required Animations

For each character, download these 4 animations:

#### 1. Idle Animation
- Search: `"Standing Idle"` or `"Breathing Idle"`
- Settings:
  - **In Place**: ON (checkbox)
  - **Overdrive**: 0
- Download as: `FBX Binary (.fbx)` with **"Without Skin"** option

#### 2. Walk Animation
- Search: `"Walking"` or `"Casual Walk"`
- Settings:
  - **In Place**: ON (important!)
  - **Overdrive**: 0
- Download as: `FBX Binary (.fbx)` with **"Without Skin"**

#### 3. Run Animation
- Search: `"Running"` or `"Jogging"`
- Settings:
  - **In Place**: ON
  - **Overdrive**: 0
- Download as: `FBX Binary (.fbx)` with **"Without Skin"**

#### 4. Flee Animation (panicked run)
- Search: `"Scared Run"` or `"Sprint"` or `"Panic Run"`
- Settings:
  - **In Place**: ON
  - **Overdrive**: 0-30 (increase for faster animation)
- Download as: `FBX Binary (.fbx)` with **"Without Skin"**

### Step 4: Organize Downloads

Create folder structure:
```
assets/models/mixamo_animations/
  casual_male_g/
    idle.fbx
    walk.fbx
    run.fbx
    flee.fbx
  casual_female_g/
    idle.fbx
    walk.fbx
    run.fbx
    flee.fbx
  ... (repeat for each character)
```

## Processing in Blender

After downloading all animations, use the Blender script below to combine mesh + animations into final GLB files.

### Blender Script Location
`assets/models/scripts/combine_mixamo_animations.py`

### What the Script Does
1. Imports the original mesh with textures
2. Imports each animation FBX (skeleton only)
3. Retargets animations to the mesh's armature
4. Renames animations to: `Idle`, `Walk`, `Run`, `Flee`
5. Exports final GLB with embedded animations

## Animation Naming Requirements

WAG GAME expects these exact animation names (case-insensitive):

| Animation | Required | Purpose |
|-----------|----------|---------|
| `Idle` | YES | Standing still |
| `Walk` | YES | Normal movement |
| `Run` | Recommended | Fast movement |
| `Flee` | Recommended | Panicked escape |

## Color Variants

After creating the base animated characters, we'll create color variants by modifying the texture/material for each role:

| Role Category | Base Character | Color Accent |
|---------------|----------------|--------------|
| Developer | casual_male_g | Blue |
| Frontend/React Dev | casual_female_g | Cyan |
| Backend Dev | casual_male_g | Green |
| QA/Testing | casual_female_g | Orange |
| Product Owner | casual_male_k | Red |
| Business Analyst | doctor_male | Yellow |
| UX Designer | casual_female_k | Pink |
| UI Designer | casual_female_k | Magenta |
| Solution Architect | casual_male_k | Purple |

## Troubleshooting

### Character is T-posing in game
- Animation names don't match (check case)
- Animation not found in GLB file
- `hasNamedAnimations: true` missing in config

### Character floats or sinks
- Root motion in animation (should use "In Place" option)
- Scale mismatch between model and game

### Animation plays wrong
- Multiple animations with same name
- Wrong animation clip selected

## Next Steps

1. Complete Mixamo uploads for all 6 characters
2. Download all required animations
3. Run Blender processing script
4. Test in game with one character
5. Create color variants
6. Update `characters.ts` with new models

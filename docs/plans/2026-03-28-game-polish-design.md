# WAG GAME - Polish & Juice Design

## Goal
Make the game feel complete, satisfying, and fun for a vibe coding presentation demo. Every action should have immediate feedback. The player should always know what to do and feel urgency.

## 1. Impact Feel ("Juice")

### 1.1 Catch Employee (main reward moment)
- Screen shake: 200ms, 5px intensity
- Slow-motion: 300ms at timeScale 0.3
- Gold/green particle burst from caught employee position
- White flash overlay: 50ms, 20% opacity
- Floating "+1" text rises and fades from catch position
- Crosshair pulse: scale up + green color, 300ms

### 1.2 Net Throw (weapon fire)
- Light screen shake: 100ms, 2px
- Camera recoil: slight backward nudge (0.05 units, lerp back)
- Crosshair spread animation (already exists, verify it works)

### 1.3 Sprint
- FOV zoom: 75 -> 85 degrees (lerp over 200ms)
- Edge vignette blur intensifies while sprinting
- Chromatic aberration on exhaustion (brief pulse)

### 1.4 Powerup Pickup
- Screen flash in powerup color: 200ms
- FOV kick: +5 degrees and back over 300ms

## 2. Pacing & Drive

### 2.1 Direction Indicator
- Edge-of-screen arrow pointing to nearest uncaught employee
- Distance in meters next to arrow
- Pulse rate increases with proximity (heartbeat feel)
- Hides when target is visible in viewport

### 2.2 Countdown Timer
- 3:00 countdown instead of counting up
- Last 30s: timer turns red, pulses, tick-tock sound
- Last 10s: large centered timer overlay
- At 0:00: "TIME'S UP" screen showing stats (not hard fail)
- Leaderboard still ranks by completion time (unchanged)

### 2.3 Fast Start
- 3-2-1 countdown overlay (skippable) replaces instruction screen
- First employee spawned ~20m from player (guaranteed easy first catch)
- No click-to-start barrier

### 2.4 Combo System
- 2 catches within 10s: "COMBO x2!" floating text + 5s bonus time
- 3 catches within 10s: "COMBO x3!" + 10s bonus + screen flash
- Combo counter visible in HUD when active
- Encourages hunting employee clusters

## 3. Visual Polish

### 3.1 Post-Processing
- Vignette: permanent subtle darkening at edges
- Bloom: on emissive materials (powerup circles, traffic lights, night windows)
- Fog: density varies by time of day (morning thick, afternoon clear, night blue tint)

### 3.2 Atmosphere Particles
- Floating dust/pollen particles in air (~200 count)
- Slow random drift, subtle opacity
- Adds life to static scene

### 3.3 UI Polish
- Level title splash on game start ("CARTOON DISTRICT", fade out 2s)
- End-game score panel: time, combos, employees caught, S/A/B/C rating
- Minimap: fleeing employees pulse red, idle pulse white

### 3.4 Employee Visual Feedback
- Catch "poof" effect: scale to 0 + opacity to 0 over 300ms (instead of instant disappear)
- Fleeing dust trail: small particles behind running employees
- Name labels already exist - verify visibility and readability

## Implementation Priority

**Phase 1 - Juice (highest impact per effort):**
1. Screen shake system
2. Catch effects (slow-mo, particles, flash, floating text)
3. FOV sprint zoom
4. Net throw recoil

**Phase 2 - Pacing:**
5. Direction indicator arrow
6. Countdown timer (convert existing)
7. 3-2-1 start countdown
8. Combo system

**Phase 3 - Visual:**
9. Post-processing (vignette, bloom, fog)
10. Atmosphere particles
11. Catch poof + dust trails
12. UI polish (level title, score panel)

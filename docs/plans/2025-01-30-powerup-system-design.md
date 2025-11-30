# Powerup System Design: "Kávová loterie"

## Overview

Random powerup system where players collect rotating coffee cups for random effects (70% advantage, 30% disadvantage). Adds chaos and fun to the gameplay.

## Effects (7 total, 10 seconds duration)

### Advantages (70% combined chance)
| Effect | Czech Name | Description | Weight |
|--------|-----------|-------------|--------|
| Speed Boost | Turbo káva | Movement speed +50% | 17.5% |
| Size Up | Grande káva | Player 2x bigger, higher camera | 17.5% |
| Super Net | Espresso focus | Net radius +100% | 17.5% |
| X-Ray Vision | Rentgen | NPCs visible through buildings (outline) | 17.5% |

### Disadvantages (30% combined chance)
| Effect | Czech Name | Description | Weight |
|--------|-----------|-------------|--------|
| Size Down | Decaf | Player 0.5x smaller, shorter reach | 10% |
| Drunk | Opilost | Camera sways side to side | 10% |
| Blur | Rozmazání | Gaussian blur on screen edges | 10% |

## Spawn System

### Locations
- 3 fixed spawn points on the map
- Layout: 1 center + 2 edges of the square

### Timing
- Powerup stays at location for **10 seconds**
- If not collected → disappears and spawns at different location
- After collection → **5 second pause** → spawns at random location
- Only 1 active powerup at a time

## Visual Design

### Pickup Object
- Rotating coffee cup (low-poly style)
- Glowing effect
- Steam particle effect above cup
- Light circle on ground at spawn points

### HUD Indicator
- Active effect icon in corner
- Countdown bar (10s → 0s)
- Color coding: gold = advantage, red = disadvantage

### Effect Visuals
| Effect | Visual Feedback |
|--------|----------------|
| Speed Boost | Speed lines on screen edges, slight zoom-out |
| Size Up | Camera higher, larger shadow |
| Super Net | Crosshair enlarged, golden outline |
| X-Ray | Neon outlines on NPCs through walls |
| Size Down | Camera lower, smaller FOV |
| Drunk | Camera tilts L/R with sway motion |
| Blur | Gaussian blur on screen edges |

## Audio

- Pickup: Coffee slurp sound
- Advantage: Positive "ding!"
- Disadvantage: Negative "womp womp"
- Effect end: "poof" + icon blink

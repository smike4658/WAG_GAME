# WAG GAME - Vibe Coding Framework

> Dokumentace pro prezentaci: Jak využíváme AI-powered development s Claude Code

---

## Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE + MCP SERVERY                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│   │  Sketchfab   │    │  ElevenLabs  │    │   Blender    │        │
│   │     MCP      │    │     MCP      │    │     MCP      │        │
│   ├──────────────┤    ├──────────────┤    ├──────────────┤        │
│   │ 3D modely    │    │ České hlasy  │    │ Animované    │        │
│   │ GLB/GLTF     │    │ TTS -> MP3   │    │ postavy      │        │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘        │
│          │                   │                   │                 │
│          └───────────────────┼───────────────────┘                 │
│                              ▼                                     │
│   ┌──────────────────────────────────────────────────────┐        │
│   │              assets/models/ + audio/                  │        │
│   └──────────────────────────────────────────────────────┘        │
│                              │                                     │
│                              ▼                                     │
│   ┌──────────────────────────────────────────────────────┐        │
│   │      Vite + TypeScript + Three.js + Rapier.js        │        │
│   │                     (3D Web Game)                     │        │
│   └──────────────────────────────────────────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MCP Servery (Model Context Protocol)

MCP rozšiřuje Claude o přímý přístup k externím službám.

| Server | Účel | Příklad použití |
|--------|------|-----------------|
| **Sketchfab** | Stahování 3D modelů | `sketchfab-search "low poly car"` |
| **ElevenLabs** | Generování českých hlasů | `text_to_speech "Nechci do práce!"` |
| **Blender** | Tvorba animovaných postav | Rig + Walk/Run/Idle animace |
| **Puppeteer** | Testování v prohlížeči | Screenshot, interakce |
| **Filesystem** | Práce se soubory | Čtení, zápis, navigace |

### Jak to funguje

```
Uživatel: "Stáhni low-poly auto pro hru"
    │
    ▼
Claude Code volá MCP tool: sketchfab-search
    │
    ▼
Sketchfab API vrací výsledky
    │
    ▼
Claude Code volá: sketchfab-download
    │
    ▼
GLB soubor uložen do assets/models/
```

---

## Custom Skills

Skills jsou znovupoužitelné workflows uložené v `.claude/skills/`.

```
.claude/skills/
├── sketchfab-assets/    -> Stahování 3D assetů
├── elevenlabs-voices/   -> Generování českých hlasů
├── blender-character/   -> Tvorba animovaných postav
├── imagen-to-3d/        -> AI obrázek -> 3D model
├── procedural-city/     -> Generování města (gen-city)
└── puppeteer-testing/   -> Browser testing
```

### Příklad: blender-character skill

```markdown
Skill definuje:
1. Jaké animace jsou povinné (Idle, Walk)
2. Jaké jsou volitelné (Run, Flee)
3. Jak pojmenovat soubory
4. Jak validovat výstup
5. Jak integrovat do hry
```

---

## Specializovaní Agenti

Agenti jsou Claude instance s konkrétní expertízou.

| Agent | Model | Odpovědnost |
|-------|-------|-------------|
| **wag-game-developer** | Opus | Three.js, game loop, fyzika, AI |
| **asset-manager** | Opus | Sketchfab + ElevenLabs pipeline |
| **city-generator** | Opus | Procedurální město + 3D modely |

### Definice agenta (příklad)

```yaml
# .claude/agents/wag-game-developer.md
name: wag-game-developer
description: Main development agent for WAG GAME
model: opus

Responsibilities:
- Three.js scenes, cameras, renderers
- Player movement (WASD + mouse)
- Net launcher mechanic
- Employee AI (state machine)
- Game state management
```

---

## Slash Commands

Rychlý přístup k častým operacím.

```bash
# Stav projektu
/wag:status

# Asset management
/wag:assets car              # Stáhni auto z Sketchfab
/wag:voices developer        # Generuj hlasy pro developera

# 3D tvorba
/wag:model-create npc        # Vytvoř animovanou postavu v Blenderu
/wag:model-validate file.glb # Validuj GLB soubor
/wag:prop-create bench       # AI pipeline: Imagen -> Tripo3D -> GLB

# Mapa
/wag:map fetch               # Stáhni OSM data
/wag:map process             # Zpracuj na 3D
```

### Jak slash command funguje

```
/wag:assets car
    │
    ▼
Načte se .claude/commands/wag/assets.md
    │
    ▼
Claude dostane instrukce + kontext
    │
    ▼
Spustí se odpovídající skill
    │
    ▼
MCP tools provedou akci
```

---

## CLAUDE.md - Projektový kontext

Soubor `CLAUDE.md` v rootu projektu = "paměť" pro Claude.

```markdown
# CLAUDE.md

## Project Overview
WAG GAME je 3D browser game...

## Development Commands
npm run dev, npm run build...

## Architecture
Tech stack, struktura složek...

## Type Safety
NEVER use `any` type...

## Git Workflow
Po každé změně commitni a pushni...
```

**Klíčové:** Claude automaticky čte CLAUDE.md při každé interakci.

---

## Asset Pipeline

### 3D Modely (Sketchfab)

```
Požadavek: "Potřebuji low-poly auto"
    │
    ├─> sketchfab-search "low poly car cartoon"
    │       └─> Vrací seznam modelů s ID, polygon count, licencí
    │
    ├─> sketchfab-model-details [model-id]
    │       └─> Detaily: formáty, autor, licence
    │
    └─> sketchfab-download [model-id] --format glb
            └─> Uloží do assets/models/vehicles/
```

### České hlasy (ElevenLabs)

```
Požadavek: "Generuj křik pro developera"
    │
    ├─> search_voices (hledá české hlasy)
    │
    └─> text_to_speech
            text: "Nechci do práce!"
            language: "cs"
            model: "eleven_multilingual_v2"
                │
                └─> Uloží MP3 do assets/audio/voices/developer/
```

### AI-Generated Props (Imagen -> Tripo3D)

```
Požadavek: "Vytvoř lavičku do parku"
    │
    ├─> Imagen 4: generuje referenční obrázek
    │       prompt: "low poly park bench, isometric view, white background"
    │
    ├─> Tripo3D: konvertuje obrázek na 3D model (300 FREE/měsíc!)
    │
    └─> Blender MCP: post-processing (scale, materiály)
            │
            └─> Export GLB do assets/models/props/
```

---

## Klíčové Principy Vibe Codingu

| Princip | Popis |
|---------|-------|
| **MCP = AI jako nástroj** | Claude přímo volá externí služby (Sketchfab, ElevenLabs, Blender) |
| **Skills = Recepty** | Dokumentované, opakovatelné workflows |
| **Agents = Specializace** | Každý agent má svou doménu a expertízu |
| **Slash Commands = UX** | Rychlý přístup k častým úkonům |
| **CLAUDE.md = Kontext** | Projekt sám sebe dokumentuje pro AI |
| **Deklarativní přístup** | Popíšeš CO chceš, ne JAK to udělat |

---

## Tech Stack

| Komponenta | Technologie | Účel |
|------------|-------------|------|
| Build | Vite 7.x | Fast HMR, ES modules |
| Jazyk | TypeScript 5.x | Type safety |
| 3D Engine | Three.js 0.181+ | WebGL rendering |
| Fyzika | Rapier.js | WASM physics |
| Město | gen-city | Procedurální layout |
| Audio | Howler.js | Spatial 3D audio |
| Animace | GSAP | Tweening |

---

## Struktura projektu

```
WAG_GAME/
├── src/
│   ├── main.ts              # Entry point
│   ├── config/              # Nastavení hry
│   ├── core/                # Game loop, loading
│   ├── entities/            # Employee, Player
│   ├── world/               # City, Traffic
│   └── ui/                  # HUD, minimap
│
├── assets/
│   ├── models/              # GLB soubory
│   └── audio/               # MP3 hlasy
│
├── docs/
│   └── plans/               # Design dokumenty
│
└── .claude/
    ├── agents/              # Specializovaní agenti
    ├── skills/              # Znovupoužitelné workflows
    ├── commands/            # Slash commands
    ├── CLAUDE.md            # Globální kontext
    └── PROJECT_CONTEXT.md   # Detailní specifikace
```

---

## Shrnutí pro prezentaci

**Vibe Coding = AI-first development workflow**

1. **Deklarativní zadání** - "Potřebuji low-poly auto s českým klaxonem"
2. **AI orchestrace** - Claude vybírá nástroje a koordinuje
3. **MCP integrace** - Přímé volání Sketchfab, ElevenLabs, Blender
4. **Automatizace** - Skills a commands zrychlují opakované úkony
5. **Kontext** - CLAUDE.md = projekt se sám dokumentuje

**Výsledek:** Od nápadu k funkční 3D hře s minimem manuální práce.

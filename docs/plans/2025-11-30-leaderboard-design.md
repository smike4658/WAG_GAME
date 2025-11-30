# Leaderboard System Design

**Datum:** 2025-11-30
**Status:** Schváleno

## Přehled

Implementace leaderboard systému pro WAG GAME. Hráč po úspěšném dokončení hry (chycení všech zaměstnanců) může uložit svůj čas do globálního leaderboardu.

## Rozhodnutí

| Aspekt | Rozhodnutí |
|--------|------------|
| Backend | Supabase (PostgreSQL) |
| UI | Samostatná obrazovka přístupná z hlavního menu |
| Po výhře | Volitelné uložení s inputem pro jméno |
| Levely | Pouze Cartoon mapa |
| Duplicity | Jeden nejlepší čas na jméno, s informací o přepsání |

## Datový model

### Supabase tabulka

```sql
CREATE TABLE leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name VARCHAR(20) NOT NULL UNIQUE,
  time_ms INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_time ON leaderboard(time_ms ASC);
```

### Row Level Security

```sql
CREATE POLICY "Public read" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Public insert" ON leaderboard FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON leaderboard FOR UPDATE USING (true);
```

## Nové soubory

```
src/
  services/
    LeaderboardService.ts    -- Supabase API komunikace
  ui/
    LeaderboardScreen.ts     -- Samostatná obrazovka s tabulkou
    VictoryScreen.ts         -- Refaktorovaná victory obrazovka
    components/
      GameTimer.ts           -- HUD stopky
```

## UI Design

### GameTimer (HUD)

- Pozice: pravý horní roh (pod TimeIndicator)
- Formát: `MM:SS.ss`
- Startuje při pointer lock
- Pauzuje při escape
- Stopne při chycení posledního zaměstnance

### LeaderboardScreen

```
┌────────────────────────────────────────────────┐
│                 🏆 LEADERBOARD                 │
│              Cartoon City - Top 10             │
├────────────────────────────────────────────────┤
│  #   JMÉNO              ČAS         DATUM      │
│  ─────────────────────────────────────────     │
│  🥇  Pepa              01:23.45    28.11.2025  │
│  🥈  Honza             01:45.67    27.11.2025  │
│  🥉  Marie             02:01.12    26.11.2025  │
│  4.  Kuba              02:15.89    25.11.2025  │
│  ...                                           │
├────────────────────────────────────────────────┤
│              [ ← Zpět do menu ]                │
└────────────────────────────────────────────────┘
```

### VictoryScreen

```
┌────────────────────────────────────────────────┐
│              🎉 VICTORY! 🎉                    │
│      Všichni zaměstnanci byli chyceni!         │
│          ┌─────────────────────┐               │
│          │    ⏱️ 01:34.52      │               │
│          └─────────────────────┘               │
│    ┌─────────────────────────────────────┐     │
│    │  Uložit do leaderboardu?            │     │
│    │  Jméno: [________________]          │     │
│    │  [ 💾 Uložit ]    [ ❌ Přeskočit ]  │     │
│    └─────────────────────────────────────┘     │
└────────────────────────────────────────────────┘
```

### Stavy po uložení

1. **Nový rekord:** "Uloženo! Jsi na X. místě!"
2. **Zlepšení:** "Zlepšil jsi svůj rekord! Předchozí: X → Nový: Y"
3. **Horší čas:** "Tvůj nejlepší čas je stále X (neuloženo)"

## LeaderboardService API

```typescript
interface LeaderboardEntry {
  id: string;
  player_name: string;
  time_ms: number;
  created_at: string;
  updated_at: string;
}

interface SubmitResult {
  success: boolean;
  isNewRecord: boolean;
  isImprovement: boolean;
  previousTime?: number;
  previousRank?: number;
  currentRank: number;
}

class LeaderboardService {
  getTopScores(): Promise<LeaderboardEntry[]>
  submitScore(name: string, timeMs: number): Promise<SubmitResult>
  getPlayerScore(name: string): Promise<LeaderboardEntry | null>
  getRankForTime(timeMs: number): Promise<number>
}
```

## Integrace do Game.ts

```
startGame()
  └→ gameTimer.reset()

pointerlockchange (locked)
  └→ gameTimer.start()

pointerlockchange (unlocked, not victory)
  └→ gameTimer.pause()

onAllCaught()
  └→ gameTimer.stop()
  └→ showVictoryScreen(gameTimer.getElapsedMs())
```

## Environment proměnné

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

## Úpravy existujících souborů

- `LevelSelector.ts` - přidat tlačítko "🏆 Leaderboard"
- `HUD.ts` - přidat GameTimer komponentu
- `main.ts` - integrace GameTimer a VictoryScreen

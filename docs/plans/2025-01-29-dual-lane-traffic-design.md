# Dual-Lane Traffic System Design

## Problémy k řešení

1. **Deadlock v protisměru** - dvě auta jedoucí proti sobě se vzájemně zablokují
2. **Auta levitují** - jsou umístěna nad úrovní silnice
3. **Chybí kolize** - auta lze procházet (pro budoucí kolizi s hráčem)

## Řešení

### 1. Dual-Lane Waypoints (Pravostranný provoz)

**Problém:** Současný `RoadExtractor` vytváří jeden waypoint na střed dlaždice a spojuje obousměrně. Auta jedou po stejné linii v opačných směrech.

**Řešení:** Modifikovat `RoadExtractor.extractFromTiles()` - generovat dva paralelní waypoints s offsetem pro každý směr:

```
Současný stav:          Nový stav:

    ←→                     ← (offset -2.5, směr západ)
    [WP]                   [WP_westbound]

                           → (offset +2.5, směr východ)
                           [WP_eastbound]
```

**Implementace:**
- Pro každou dlaždici vytvořit 2 waypoints (offset ±2.5 jednotek od středu)
- Spojit waypoints pouze ve směru jízdy (jednosměrně)
- Na křižovatkách vytvořit propojení pro všechny povolené manévry

### 2. Křižovatky s plným odbočováním

**Řešení:** Dynamická priorita - pravidlo pravé ruky

- Při detekci křížící se trajektorie v `findLeader()`:
  - Auto zprava má přednost
  - Ostatní zpomalí/zastaví

**Implementace:**
- Rozšířit `SimulatedVehicle` o `intendedDirection` (rovně/vlevo/vpravo)
- V `findLeader()` detekovat auta na křížících se trajektoriích
- Aplikovat pravidlo pravé ruky pro určení priority

### 3. Raycast pro správnou výšku

**Řešení:** Při spawnu vozidla provést raycast dolů a usadit na povrch silnice.

**Implementace:**
- V `spawnVehicleAt()` přidat raycast z pozice waypoint dolů
- Nastavit Y pozici vozidla na hit point + malý offset (0.1)
- Fallback na původní pozici pokud raycast mine

### 4. Box3 kolize pro detekci

**Řešení:** Jednoduchý Box3 overlap test pro detekci kolizí.

**Implementace:**
- Přidat `collisionBox: THREE.Box3` do `SimulatedVehicle`
- Aktualizovat bounding box každý frame
- Přidat metodu `checkCollision(other: SimulatedVehicle): boolean`
- Vystavit API pro kontrolu kolize s hráčem

---

## Soubory k modifikaci

### RoadExtractor.ts
- `extractFromTiles()` - generovat dual-lane waypoints
- Přidat helper metody pro výpočet offsetů a směrů

### RoadNetwork.ts
- Přidat `direction` property do `Waypoint` interface
- Přidat metodu `createDualLaneConnection()`

### AdvancedTrafficSystem.ts
- `spawnVehicleAt()` - přidat raycast pro výšku
- `findLeader()` - přidat detekci křížících se trajektorií a pravidlo pravé ruky
- `updateVehicle()` - aktualizovat collision box
- Přidat `checkCollisionWithPlayer(playerPosition: Vector3): Vehicle | null`

---

## Pořadí implementace

1. **RoadNetwork** - rozšířit Waypoint o směr
2. **RoadExtractor** - dual-lane generování
3. **AdvancedTrafficSystem** - raycast při spawnu
4. **AdvancedTrafficSystem** - pravidlo pravé ruky
5. **AdvancedTrafficSystem** - Box3 kolize

---

## Testování

Po implementaci spustit hru a ověřit:
- [ ] Auta v protisměru se míjejí bez zastavení
- [ ] Auta na křižovatkách respektují pravidlo pravé ruky
- [ ] Auta jsou usazena na silnici (nelevitují)
- [ ] Kolizní boxy jsou správně aktualizovány

# MapaPID v2 – technická specifikace

## Cíl
Nová implementace MapaPID vzniká od čistého datového jádra. Starý projekt zůstává v `backup/2026-10-01/` jako archiv a zdroj ověřených dat, pravidel a vizuálních požadavků.

## Zásady
1. Jeden fyzický vůz = jedna stabilní interní identita.
2. UI nikdy nerozhoduje, který realtime zdroj je pravdivější; dostává už sloučený model.
3. JSON Vehicle Positions je hlavní zdroj provozních údajů, pokud vůz v aktuálním snapshotu existuje.
4. GTFS-RT VehiclePosition je fallback polohy pouze při absenci téhož fyzického vozu v JSON.
5. Fallback zůstává viditelný tak dlouho, dokud jej GTFS-RT publikuje.
6. GTFS-RT fallback neznamená automaticky „Na konečné“. Bez důkazu UI použije „Poslední známá poloha“.
7. Otevřená karta, follow a focus-only jsou navázané na stabilní fyzické ID, ne na ID konkrétního zdroje.
8. Žádná interpolace polohy mezi realtime reporty.
9. Oběh vozidla se nesmí vydávat za potvrzený, pokud jde jen o heuristiku.
10. Mobile-first; desktop je samostatný layout, ne jen zvětšený mobil.

## Jednotný model vozidla
```js
{
  id,
  operator,
  traction,
  fleetNumber,
  line,
  order,
  tripId,
  headsign,
  position: {
    lat,
    lon,
    bearing,
    observedAt,
    source // json | gtfsrt
  },
  status: {
    freshness, // live | stale | retained
    atTerminal // true | false | null
  },
  realtime: {
    golemioId,
    gtfsRtVehicleId
  },
  vehicle: null,
  raw: {
    json,
    gtfsrt
  }
}
```

## Stabilní identita
Priorita:
1. kanonický dopravce + trakce + evidenční číslo,
2. GTFS-RT `vehicle.id`, pokud fyzické evidenční číslo není dostupné,
3. zdrojové realtime `vehicle.id` doplněné typem/linkou.

Číslo vlaku nesmí být považováno za fyzickou identitu soupravy.

## Realtime pipeline
```text
Golemio JSON ──> normalizeGolemio ─┐
                                   ├─> mergeVehicles ─> enrich vehicle DB ─> application state
GTFS-RT ───────> normalizeGtfsRt ──┘
```

### Merge pravidla
- stejné stabilní ID se zobrazí maximálně jednou,
- JSON má při současné přítomnosti prioritu pro polohu i provozní údaje,
- GTFS-RT může doplnit `gtfsRtVehicleId` nebo chybějící vazbu na trip,
- pokud JSON vůz nemá, použije se GTFS-RT jako `retained`,
- zmizením VehiclePosition z aktuálního GTFS-RT snapshotu fallback zaniká.

## Stav konečné
`atTerminal` je tri-state:
- `true`: máme konkrétní důkaz,
- `false`: máme konkrétní důkaz, že vozidlo není na konečné,
- `null`: nevíme.

UI nesmí z `null` dělat „Na konečné“.

## Fáze vývoje
### Fáze 0 – datové jádro
- specifikace,
- identity,
- normalizace JSON,
- normalizace GTFS-RT,
- merge,
- fixtures a automatické testy.

### Fáze 1 – debug mapa
- čistá mapa,
- markery z jednotného stavu,
- kliknutí na marker,
- debug panel s ID/source/timestamp/trip/operator/vehicle DB match.

### Fáze 2 – filtry a seznam
- linka,
- pořadí,
- jedno i více ev. čísel,
- dopravce,
- druh dopravy,
- typ vozu,
- bez skrytého limitu výsledků.

### Fáze 3 – karta vozidla
- kompaktní / střední / plná úroveň,
- další zastávka, plán a odhad/skutečnost,
- model, nátěr, reklama, výbava, dopravce,
- JŘ, follow, focus-only.

### Fáze 4 – responzivní UX
- mobilní swipeable bottom sheets,
- tabletový layout,
- široký desktop s levým panelem a pravou kartou.

### Fáze 5 – oběhy
- potvrzené GTFS-RT vazby,
- samostatně označené odhady z GTFS,
- žádné automatické tvrzení z pouhého pořadí tripů v souboru.

## Povinné testovací scénáře
- DPP tramvaj s JSON + GTFS-RT zároveň,
- stejný vůz zmizí z JSON, GTFS-RT zůstává,
- návrat téhož vozu do JSON,
- pouze JSON,
- pouze GTFS-RT,
- neznámý dopravce,
- vozidlo bez evidenčního čísla,
- metro,
- vlak,
- konflikt timestampů: starší JSON vs novější GTFS-RT nesmí obrátit prioritu zdrojů.

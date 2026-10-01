# MapaPID v2

Aktuální stav: **Fáze 1 – debug mapa**.

## Co už funguje
- jednotná normalizace Golemio JSON,
- normalizace GTFS-RT VehiclePositions,
- stabilní identita fyzického vozidla,
- deterministický merge JSON > GTFS-RT fallback,
- tri-state terminál (`true` / `false` / `null`),
- Leaflet debug mapa,
- diagnostický panel po kliknutí na marker,
- automatický refresh každých 30 s,
- regresní testy datového jádra.

## Co debug mapa zobrazuje
Marker používá linku, případně evidenční číslo. GTFS-RT fallback je zobrazen jako retained/dashed marker.

Po kliknutí se zobrazí:
- stabilní `id`,
- dopravce,
- trakce,
- evidenční číslo,
- linka a pořadí,
- trip ID a cíl,
- poloha, timestamp a zdroj,
- `freshness` a `atTerminal`,
- Golemio ID a GTFS-RT vehicle ID,
- extra realtime údaje,
- informace, zda jsou přítomná raw JSON / GTFS-RT data.

## Lokální spuštění
Aplikace používá ES moduly, proto ji neotvírej přes `file://`. Z kořene repozitáře spusť libovolný statický HTTP server, například:

```bash
python -m http.server 8000
```

Pak otevři:

```text
http://localhost:8000/v2/
```

Veřejný API klíč není potřeba. `config.js` ukazuje na existující Cloudflare Worker proxy.

## Kontroly
Z adresáře `v2/`:

```bash
npm run check
npm test
```

CI provádí stejné kontroly automaticky při pushi do větve `mapapid-v2`.

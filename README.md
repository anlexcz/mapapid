# MapaPID
Mobile-first vlastní mapa vozidel Pražské integrované dopravy.

## Cíl
- realtime vozidla na mapě
- kombinovatelné filtry: dopravce, typ vozidla, linka, pořadí, evidenční číslo
- napojení realtime tripu na statický GTFS
- rekonstrukce plánovaného oběhu přes GTFS `block_id`
- později odhad budoucí polohy vozu

## Data
Statický GTFS: PID_GTFS.zip. GitHub Action jej denně stáhne a vytvoří `data/gtfs-index.json`.
Realtime: Golemio Vehicle Positions přes bezpečný server-side proxy. API token nesmí být ve frontendu ani v tomto repozitáři.

## Stav
První MVP: UI, mapa, filtry a GTFS oběhy jsou připravené. Realtime začne fungovat po nastavení proxy URL v `config.js`.

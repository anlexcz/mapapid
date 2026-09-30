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

## Evidence nátěrů vozů
Pole `livery` obsahuje celý popis aktuálního nátěru podle Seznamu autobusů, včetně barev a provedení. Popis nezkracujeme na obecné označení jako `PID`: například `schéma PID, červeno-bílo-modrá` a `schéma PID, šedá s červenými svislými pruhy` jsou různé varianty. Z přehledu nátěrů vybíráme aktuálně platný záznam, nikoli historický. Mapa zobrazuje celý uložený popis. Reklama se eviduje samostatně v `advertisement`; nezjištěný nátěr má hodnotu `null`.

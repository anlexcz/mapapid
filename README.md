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

## Vozy DPP – Klíčov
Soubor `data/vehicles/dpp-klicov.json` je snímek evidence ze Seznamu autobusů, ověřený přes [sa-proxy.kojban.cz](https://sa-proxy.kojban.cz/typy/dopravni-podnik-hl-m-prahy/provozovna-garaz-klicov) dne 30. 9. 2026. Obsahuje 293 vozů s jednoznačným současným evidenčním číslem a aktuální provozovnou Klíčov: 273 autobusů, 4 elektrobusy (trakce `bus`) a 16 trolejbusů (trakce `trolleybus`). Vynechává dva vozy aktuálně vedené v Kačerově a Řepích a dalších sedm vozů bez jednoznačného současného evidenčního čísla: šest historických či muzejních vozů se dvěma současně zvýrazněnými čísly a jeden autobus bez současného evidenčního čísla.

Záznamy se párují výhradně podle dopravce, trakce a evidenčního čísla. `data/operators.json` převádí realtime název `DP PRAHA` a alias `DPP` na zdrojový název `Dopravní podnik hl. m. Prahy`. Nezjištěná výbava má hodnotu `null`; klimatizace se potvrzuje pouze při výslovně uvedené celovozové klimatizaci pro cestující. Bezbariérovost se neodvozuje z názvu modelu. Současně platné popisy nátěru se spojují pomocí ` & `; výslovná celovozová reklama nebo reklamní polep se ukládá také do `advertisement`. Historické nátěry se nepřebírají.

## Vozy DPP – Řepy
Soubor `data/vehicles/dpp-repy.json` je snímek evidence ze Seznamu autobusů, ověřený přes [sa-proxy.kojban.cz](https://sa-proxy.kojban.cz/typy/dopravni-podnik-hl-m-prahy/provozovna-garaz-repy) dne 30. 9. 2026. Obsahuje 306 vozů s jednoznačným současným evidenčním číslem a aktuální provozovnou Řepy: 268 autobusů a 38 trolejbusů. Jeden autobus ze seznamu Řep je vynechán, protože je aktuálně vedený v Klíčově. Pro výbavu, nátěry, reklamy a párování platí stejná pravidla jako u Klíčova; katalogy se nepřekrývají podle ID ani podle kombinace dopravce, trakce a evidenčního čísla.

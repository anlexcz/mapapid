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
Soubor `data/vehicles/dpp-klicov.json` je snímek evidence ze Seznamu autobusů, ověřený přes [sa-proxy.kojban.cz](https://sa-proxy.kojban.cz/typy/dopravni-podnik-hl-m-prahy/provozovna-garaz-klicov) dne 30. 9. 2026. Obsahuje 294 vozů s jednoznačným současným evidenčním číslem a aktuální provozovnou Klíčov: 274 autobusů, 4 elektrobusy (trakce `bus`) a 16 trolejbusů (trakce `trolleybus`). Vynechává vůz aktuálně vedený v Řepích a dalších sedm vozů bez jednoznačného současného evidenčního čísla: šest historických či muzejních vozů se dvěma současně zvýrazněnými čísly a jeden autobus bez současného evidenčního čísla.

Záznamy se párují výhradně podle dopravce, trakce a evidenčního čísla. `data/operators.json` převádí realtime název `DP PRAHA` a alias `DPP` na zdrojový název `Dopravní podnik hl. m. Prahy`. Nezjištěná výbava má hodnotu `null`; klimatizace se potvrzuje pouze při výslovně uvedené celovozové klimatizaci pro cestující. Bezbariérovost se neodvozuje z názvu modelu. Současně platné popisy nátěru se spojují pomocí ` & `; výslovná celovozová reklama nebo reklamní polep se ukládá také do `advertisement`. Historické nátěry se nepřebírají.

## Vozy DPP – Řepy
Soubor `data/vehicles/dpp-repy.json` je snímek evidence ze Seznamu autobusů, ověřený přes [sa-proxy.kojban.cz](https://sa-proxy.kojban.cz/typy/dopravni-podnik-hl-m-prahy/provozovna-garaz-repy) dne 30. 9. 2026. Obsahuje 307 vozů s jednoznačným současným evidenčním číslem a aktuální provozovnou Řepy: 269 autobusů a 38 trolejbusů. Vůz 2055 je zahrnut podle aktuální provozovny z detailu; zkrácený seznam nesprávně zvýrazňuje jeho skončenou zápůjčku do Klíčova. Pro výbavu, nátěry, reklamy a párování platí stejná pravidla jako u Klíčova; katalogy se nepřekrývají podle ID ani podle kombinace dopravce, trakce a evidenčního čísla.

## Vozy DPP – Kačerov (autobusy)
Soubor `data/vehicles/dpp-kacerov.json` je snímek autobusové evidence ze Seznamu autobusů, ověřený přes [sa-proxy.kojban.cz](https://sa-proxy.kojban.cz/typy/dopravni-podnik-hl-m-prahy/provozovna-garaz-kacerov) dne 30. 9. 2026. Obsahuje 278 autobusů s jednoznačným současným evidenčním číslem a aktuální provozovnou Kačerov; jiné trakce nejsou součástí tohoto souboru. Detaily všech vozů jsou ověřené. Pro výbavu, celé aktuální nátěry, samostatnou reklamu a párování platí stejná pravidla jako u ostatních garáží. Katalog se nepřekrývá s Klíčovem ani Řepy podle ID nebo kombinace dopravce, trakce a evidenčního čísla.

## Vozy DPP – Hostivař
Soubor `data/vehicles/dpp-hostivar.json` je snímek evidence ze Seznamu autobusů, ověřený přes [sa-proxy.kojban.cz](https://sa-proxy.kojban.cz/typy/dopravni-podnik-hl-m-prahy/provozovna-garaz-hostivar) dne 30. 9. 2026. Obsahuje 201 vozů s jednoznačným současným evidenčním číslem a aktuální provozovnou Hostivař: 199 autobusů a 2 elektrobusy (trakce `bus`). Devět dalších vozů se dvěma současně zvýrazněnými čísly je vynecháno, aby jejich historická čísla nekolidovala s aktuálními vozy. Detaily všech zahrnutých vozů jsou ověřené. Pro potvrzenou výbavu, celé aktuální nátěry, samostatnou reklamu a párování platí stejná pravidla jako u ostatních garáží; nezjištěné hodnoty zůstávají `null`. Katalog se nepřekrývá s ostatními soubory podle ID ani podle kombinace dopravce, trakce a evidenčního čísla.

## Vozy DPP – Vršovice
Soubor `data/vehicles/dpp-vrsovice.json` je snímek evidence ze Seznamu autobusů, ověřený přes [sa-proxy.kojban.cz](https://sa-proxy.kojban.cz/typy/dopravni-podnik-hl-m-prahy/provozovna-garaz-vrsovice) dne 30. 9. 2026. Obsahuje 150 vozů: 125 autobusů a 25 elektrobusů (trakce `bus`). Detaily všech zahrnutých vozů jsou ověřené. Vůz 2042 z tohoto přehledu je aktuálně vedený v Klíčově a zůstává v jeho souboru. Vůz 2044 patří Vršovicím podle aktuálního záznamu v detailu; jeho zápůjčka do Klíčova skončila v září 2025. Při rozporu se zkráceným přehledem rozhoduje aktuálně platný záznam provozovny v detailu, nikoli poslední zvýrazněná historická položka.

## Pokrytí garáží DPP
Katalog pokrývá všech pět současných garáží uvedených ve zdroji: Klíčov (294 vozů), Řepy (307), Kačerov (278), Hostivař (201) a Vršovice (150), celkem 1 230 vozů DPP. Kontrola všech pěti přehledů potvrzuje pokrytí každého vozu s jednoznačným současným evidenčním číslem. Šestnáct dalších vozů s více současně zvýrazněnými čísly nebo bez evidenčního čísla se do párování nezahrnuje. Při závěrečné kontrole byly podle detailů doplněny také 2055 do Řep a 5093 do Klíčova. Ve všech souborech platí stejná pravidla pro celé aktuální nátěry, samostatnou reklamu a neznámou výbavu (`null`). Katalogy nemají duplicitní ID ani klíče dopravce, trakce a evidenčního čísla. Jde o statický snímek evidence, nikoli automatickou synchronizaci.

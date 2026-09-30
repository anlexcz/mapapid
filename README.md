# MapaPID
Mobile-first vlastní mapa vozidel Pražské integrované dopravy.

## Cíl
- realtime vozidla na mapě
- kombinovatelné filtry: dopravce, typ vozidla, linka, pořadí, evidenční číslo
- napojení realtime tripu na statický GTFS
- rekonstrukce plánovaného oběhu z pořadí tripů v PID GTFS; `block_id` se pro tento účel nepovažuje za spolehlivý
- zobrazovat pouze skutečně reportované realtime polohy; polohu vozidla mezi reporty neinterpolovat

## Data
Statický GTFS: PID_GTFS.zip. GitHub Action jej denně stáhne a vytvoří `data/gtfs-index.json`.
Realtime: Golemio Vehicle Positions přes bezpečný server-side proxy. API token nesmí být ve frontendu ani v tomto repozitáři.

## Stav
Aplikace běží na GitHub Pages a používá realtime Golemio přes Cloudflare Worker proxy. Statický PID GTFS se předzpracovává do indexu a route chunků. UI je mobile-first, ale podporuje i desktop.

## Základní pravidla realtime a GTFS
- Realtime Golemio je autorita pro aktuální polohu, linku, trip a stav vozidla. Vozidla se mezi reportovanými souřadnicemi neanimují ani neinterpolují.
- Realtime `gtfs.trip_id` se páruje přímo na aktuální statický PID GTFS trip. Fuzzy matching není běžná cesta.
- `sequence_id` z realtime se v UI používá jako provozní pořadí. U vlaků má tento údaj význam čísla vlaku a v seznamech se zobrazuje na místě, kde ostatní trakce používají evidenční číslo.
- U metra bez evidenčního čísla se jako identita zobrazuje linka A/B/C.
- PID GTFS `stop_times` zachovává zdrojové pořadí tripů. Build ukládá `source_order`, `trip_operation_type`, globální `sequence` a pozici tripu. To je základ pro budoucí rekonstrukci skutečného oběhu; `block_id` se pro PID nepovažuje za dostatečný.
- `trip_operation_type`: 1 běžný spoj, 7 výjezd, 8 zátah, 9 přejezd v rámci linky, 10 přejezd na jinou linku. Hodnoty slouží jako pomocná informace/boundary check.
- Vozidlo jedoucí k poslední zastávce ještě není „na konečné“. Stav konečné lze vyhlásit až po skutečném dosažení poslední zastávky (`last_stop`), nikoli pouze proto, že `next_stop` je poslední zastávka.
- Stará poloha: do 5 minut normální marker; 5–10 minut utlumený/stale marker a informace o poslední známé poloze; po 10 minutách skrýt. Robustní uchování vozu, pokud úplně zmizí z realtime feedu, je samostatná věc k dořešení.
- Pokud je spolehlivě znám konec výkonu/zátah, cílem je vozidlo po dokončení odstranit; nesmí se ale odstraňovat aktivní vůz jen na základě domněnky.

## Databáze vozidel
Vlastní katalog vozidel je oddělený od realtime. Frontend načítá manifest `data/vehicles/index.json` a jednotlivé soubory v `data/vehicles/`; není natvrdo vázaný na jednoho dopravce. Základní párovací klíč je přesně **dopravce + trakce + aktuální evidenční číslo**. Fallback, který by dovolil spárovat stejnou trakci a ev. číslo jiného dopravce, se nepoužívá.

U vozu ukládáme jen data užitečná pro mapu: `sa_id`, zdrojového dopravce, aktuální ev. číslo, trakci, výrobce, přesný model, případně odlišného `current_operator`, provozovnu, bezbariérovost, klimatizaci, USB, aktuální nátěr a aktuální reklamu. Historická ev. čísla a jiná nepotřebná data se do katalogu nehromadí.

Dopravce u vozidla zůstává ve tvaru ze Seznamu autobusů. Normalizace názvů a zkratek je centrálně v `data/operators.json`, aby se např. zdrojový název mohl v UI zobrazit jako DPP. Provozovna je samostatný údaj a zapisuje se pouze názvem místa, např. `Klíčov`, `Řepy`, `Kobylisy`, bez slov „garáž“ nebo „vozovna“.

`sa_id` je stabilní vazba na profil vozidla a zároveň se používá pro odkaz z evidenčního čísla na `seznam-autobusu.cz/vuz/<sa_id>` v novém okně. Seznam autobusů / sa-proxy slouží jako zdroj pro periodicky budovaný katalog, nikoli jako live dependency při každém kliknutí v mapě.

Výbava se neodhaduje bez podkladu: neznámá hodnota je `null`. Bezbariérovost se automaticky neodvozuje jen z názvu modelu. Klimatizace znamená výslovně potvrzenou klimatizaci prostoru pro cestující.

## Pravidla UI mapy
- Výchozí marker zobrazuje linku; v nastavení lze jako hlavní údaj zvolit evidenční číslo. Volba ovlivňuje i pořadí údajů v seznamu vozidel.
- Seznam „Vozidla“ a „Filtry“ jsou dvě samostatné akce/panely. Vozidla bez aktivního filtru zobrazují jen vozy v aktuálním výřezu a až od definované úrovně zoomu, aby se nevykreslovaly zbytečně tisíce položek.
- Seznam vozidel je kompaktní jednořádkový: linka, /pořadí, ev. číslo, směr/konečná a dopravce. Neznámé údaje se nepíšou.
- Kliknutí na řádek vybere vozidlo a vystředí ho do **viditelné části mapy**, tedy s ohledem na otevřený spodní panel.
- Kliknutí mimo vybraný vůz do mapy výběr ruší. Karta má vlastní křížek.
- Funkce „Skrýt ostatní“ ponechá jen vybraný vůz; po vypnutí/zavření se ostatní vrátí.
- Karta vozidla má tři úrovně: kompaktní → několik okolních zastávek → 50 % výšky obrazovky s plným scrollovatelným JŘ. Swipe nahoru/dolů přechází po úrovních. Tap na hlavičku kompaktní karty otevře střední stav.
- Střední stav nemá mít vlastní scroll; několik zastávek se musí vejít. Scroll je určen až pro plný JŘ.
- Přechody mezi úrovněmi jsou krátké a jemné. Stav se řídí třídami `level-0/1/2`; nepoužívat křehkou ruční animaci měřením a přepisováním výšky přes timeouty.
- Hlavička karty: červený chip linky, menší `/pořadí` zarovnané k dolní hraně chipu, výraznější směr/konečná a zpoždění vpravo. Druhý řádek: větší ev. číslo (odkaz na SA), ikony výbavy a vpravo výrazný přesný typ. Třetí řádek: vlevo aktuální nátěr/reklama, vpravo dopravce.
- Řádek následující zastávky zobrazuje název, čas dle JŘ a při rozdílu i odhadovaný čas podle aktuálního zpoždění; interní sekvenční číslo zastávky se uživateli nezobrazuje.
- Spodní akce jsou kompaktní: JŘ, sledování a skrýt/zobrazit ostatní. Oběh není v hlavní spodní liště.
- Stáří polohy se píše stručně, např. `před 37 s` nebo `před 2 min`.
- Pro UI se používá jednotná sada Material Icons namísto směsi emoji a různých Unicode symbolů.
- Křížek, swipy a tapy nesmějí blokovat refresh timer ani hlavní JS smyčku. Při dalších změnách karty je stabilita těchto handlerů priorita.

## Vizuální směr
Technický, kompaktní a informačně hustý vzhled; žádné zbytečně velké karty, whitespace nebo „AI dashboard“ estetika. Ostré/lehce zaoblené prvky, červený akcent `#FF3636`. Mobil je primární, desktop má využít prostor bez zakrytí mapy.

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

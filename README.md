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
Realtime: Golemio JSON Vehicle Positions a společný GTFS-RT `pid_feed.pb` přes bezpečný server-side Cloudflare Worker proxy. API token nesmí být ve frontendu ani v tomto repozitáři. JSON Vehicle Positions je primární bohatý zdroj; GTFS-RT VehiclePosition doplňuje skutečné poslední polohy vozidel, která už JSON snapshot nevrací, typicky při čekání na konečné.

## Stav
Aplikace běží na GitHub Pages a používá realtime Golemio přes Cloudflare Worker proxy. Statický PID GTFS se předzpracovává do indexu a route chunků. UI je mobile-first, ale podporuje i desktop.

## Základní pravidla realtime a GTFS
- Poloha vozidla smí pocházet pouze ze skutečně reportované souřadnice. Vozidla se mezi reporty neanimují ani neinterpolují.
- Primární realtime zdroj je Golemio JSON `/v2/vehiclepositions`; Worker u nefiltrovaného dotazu nastavuje `limit=10000`, protože výchozí limit Golemio je 100 záznamů.
- Společný GTFS-RT `pid_feed.pb` obsahuje Vehicle Positions i Trip Updates. `vehicle.id` je společný klíč fyzického vozidla mezi oběma částmi feedu; u DPP má např. tvar `service-0-8488`.
- GTFS-RT VehiclePosition je záložní zdroj polohy. Pokud fyzické vozidlo chybí v aktuálním JSON snapshotu, ale `pid_feed.pb` stále obsahuje jeho VehiclePosition, mapa použije tuto poslední skutečně reportovanou GPS souřadnici a její původní timestamp. Tím lze zobrazit i vůz čekající na konečné dlouho po poslední zprávě.
- Ověřený případ 1. 10. 2026: vůz DPP 8488 na lince 95 ve Vozovně Kobylisy nebyl kolem 00:55 v JSON Vehicle Positions, ale `pid_feed.pb` jej stále obsahoval na tripu `95_2832_260829` se souřadnicí 50.1326713562, 14.4537000656 a timestampem poslední zprávy 00:30:55; veřejná PID mapa zobrazovala stejný vůz na konečné s plánovaným odjezdem v 01:01.
- Trip Updates slouží pro vazbu vozidla na aktuální a následující tripy; samy nikdy nevytvářejí polohu. Jeden `vehicle.id` může mít současně více Trip Updates, což umožňuje znát následující spoj stejného fyzického vozu.
- Při sloučení zdrojů nesmí vzniknout dvě kopie stejného fyzického vozidla. JSON má přednost; GTFS-RT fallback se přidává pouze tehdy, pokud odpovídající fyzický vůz v JSON snapshotu není.
- Realtime `gtfs.trip_id` se páruje přímo na aktuální statický PID GTFS trip. Fuzzy matching není běžná cesta.
- `sequence_id` z realtime se v UI používá jako provozní pořadí. U vlaků má tento údaj význam čísla vlaku a v seznamech se zobrazuje na místě, kde ostatní trakce používají evidenční číslo.
- U metra bez evidenčního čísla se jako identita zobrazuje linka A/B/C.
- PID GTFS `stop_times` zachovává zdrojové pořadí tripů. Build ukládá `source_order`, `trip_operation_type`, globální `sequence` a pozici tripu. To je základ pro budoucí rekonstrukci skutečného oběhu; `block_id` se pro PID nepovažuje za dostatečný.
- `trip_operation_type`: 1 běžný spoj, 7 výjezd, 8 zátah, 9 přejezd v rámci linky, 10 přejezd na jinou linku. Hodnoty slouží jako pomocná informace/boundary check.
- Běžný JSON marker se podle stáří zobrazuje do 5 minut normálně, 5–10 minut jako stale a po 10 minutách se skrývá. Toto pravidlo se nevztahuje na GTFS-RT fallback na konečné: jeho smyslem je právě zachovat starší skutečně reportovanou polohu, dokud ji společný feed stále publikuje.
- Pokud je spolehlivě znám konec výkonu/zátah a společný feed už vozidlo nepublikuje, má být vozidlo odstraněno; aktivní vůz se nesmí odstraňovat jen na základě domněnky.

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

## Vozy STENBUS
Soubor `data/vehicles/stenbus.json` obsahuje 35 současných autobusů s jednoznačným evidenčním číslem a provozovnou Bystrá (linky PID). Zdroj: [STENBUS v Seznamu autobusů přes sa-proxy](https://sa-proxy.kojban.cz/seznam?iddopravce=77&prov=1&trakce=autobus&vcetneSluzebnich=1), detaily všech zahrnutých vozů ověřeny 30. 9. 2026. Ze 51 záznamů přehledu není zahrnuto 16 vozů vedených pro ostatní výkony, historické výkony nebo bez současného čísla. Provozovna se ukládá jako `Bystrá`.

## Vozy ABOUT ME
Soubor `data/vehicles/about-me.json` obsahuje 41 autobusů s aktuálním číslem řady 19xx. Zdroj: [ABOUT ME v Seznamu autobusů přes sa-proxy](https://sa-proxy.kojban.cz/seznam?iddopravce=209&prov=1&trakce=autobus&vcetneSluzebnich=1), detaily všech zahrnutých vozů ověřeny 30. 9. 2026. Z přehledu 45 vozů jsou vynechány čtyři vozy pro výkony mimo PID: jeden bez současného čísla a tři s čísly 18154–18156. Zdroj u zahrnutých vozů neuvádí provozovnu, proto je `depot: null`. Výslovné reklamní polepy zádě (`celolep zádi`) jsou spolu s celovozovými reklamami zaznamenány také v `advertisement`.

## Vozy MARTIN UHER bus
Soubor `data/vehicles/martin-uher-bus.json` obsahuje 21 vozů současného provozovatele MARTIN UHER bus: 11 běžných autobusů pronajatých od společnosti MARTIN UHER a 10 vodíkových autobusů Solaris Urbino 12 IV hydrogen s přidělenými čísly 1150–1159. Zdroj: [MARTIN UHER bus v Seznamu autobusů přes sa-proxy](https://sa-proxy.kojban.cz/dopravce/martin-uher-bus), detaily všech vozů ověřeny 30. 9. 2026.

**Vodíkové vozy jsou ve zdroji stále vedené se stavem „dosud nezařazen“ (`nzr`).** Jsou zahrnuty kvůli jednoznačné současné identitě a přiděleným číslům; jejich přítomnost v katalogu nepotvrzuje provoz. Běžný filtr provozních vozů je vynechává, proto byl zkontrolován i nefiltrovaný přehled elektrobusů. Trakce všech 21 vozů je `bus`; provozovna není uvedena a zůstává `null`.

## Vozy MARTIN UHER
Soubor `data/vehicles/martin-uher.json` obsahuje 37 současných autobusů PID s jednoznačným evidenčním číslem a aktuálním provozovatelem MARTIN UHER. Zdroj: [MARTIN UHER v Seznamu autobusů přes sa-proxy](https://sa-proxy.kojban.cz/seznam?iddopravce=64&prov=1&trakce=autobus&vcetneSluzebnich=1), detaily všech zahrnutých vozů ověřeny 30. 9. 2026. Jedenáct aktuálně pronajatých autobusů je evidováno pouze v katalogu MARTIN UHER bus podle současného provozovatele. Historické, služební a nečíslované vozy se do párování nezařazují. Provozovna není ve zdroji uvedena a zůstává `null`. Obě společnosti mají samostatné záznamy a aliasy v `data/operators.json`.

## Pokrytí dalších dopravců
Tyto čtyři katalogy přidávají 134 vozů s ověřeným detailem; manifest nyní načítá 10 souborů a celkem 1 380 vozů včetně DPP a Lameru. Neznámá výbava zůstává `null`, klimatizace se potvrzuje pouze pro prostor cestujících a nátěry se přebírají celé. Kontrola načítání a párování potvrzuje jedinečnost ID i klíče dopravce + trakce + evidenční číslo v celém manifestu. Aliasům dopravců odpovídají názvy ze zdroje a plné názvy společností; živé ověření názvů z realtime feedu nebylo v tomto kroku dostupné. Jde o snímek zdrojové evidence, nikoli úplné pokrytí všech dopravců PID nebo automatickou synchronizaci.

## Vozy ČSAD POLKOST
Soubor `data/vehicles/csad-polkost.json` obsahuje 93 autobusů s jednoznačným současným evidenčním číslem v rozsahu 1570–1688. Zdroj: [provozní přehled ČSAD POLKOST v Seznamu autobusů přes sa-proxy](https://sa-proxy.kojban.cz/seznam?iddopravce=459&prov=1&trakce=autobus&vcetneSluzebnich=1), detaily všech zahrnutých vozů ověřeny 30. 9. 2026. Přehled obsahuje 94 záznamů; jediný vynechaný vůz (SA ID 31922) je výcvikový autobus autoškoly bez současného evidenčního čísla. Přehledy elektrobusů a trolejbusů pro tohoto dopravce jsou prázdné.

Používají se současná čísla 15xx a 16xx, nikoli historická čísla 18xx či římské označení generace. Vůz 1676 zůstává v katalogu ČSAD POLKOST: jeho pronájem dopravci Autodoprava Lamer skončil podle detailu v březnu 2026. Zdroj u všech zahrnutých vozů neuvádí provozovnu, proto je `depot: null`; sídlo firmy se za provozovnu nedosazuje.

Celé aktuální nátěry se přebírají z detailů. U 89 vozů je výslovně potvrzena celovozová klimatizace pro cestující a u 15 USB. Bezbariérovost není ve zdrojových údajích výbavy výslovně potvrzena, proto zůstává `null` stejně jako jiná nezjištěná výbava. Centrální slovník obsahuje zdrojový název ČSAD POLKOST a plný firemní název s aliasy. Kontrola skutečných funkcí načítání a párování proti všem souborům manifestu prošla bez duplicit ID nebo klíče dopravce + trakce + evidenční číslo; jde o kontrolu katalogu a aliasů, nikoli živý test realtime feedu. Manifest po doplnění načítá 11 souborů s celkem 1 473 vozy.

## Vozy AD STŘEDNÍ ČECHY
Soubor `data/vehicles/ad-stredni-cechy.json` obsahuje všech 19 vozů současného provozního přehledu s jednoznačným aktuálním evidenčním číslem. Zdroj: [AD STŘEDNÍ ČECHY v Seznamu autobusů přes sa-proxy](https://sa-proxy.kojban.cz/seznam?iddopravce=16822&prov=1&trakce=autobus&vcetneSluzebnich=1), detaily všech vozů ověřeny 30. 9. 2026. Jde o samostatného dopravce, odlišného od ČSAD Střední Čechy; [oficiální přehled PID](https://pid.cz/dopravci-a-partneri/ad-stredni-cechy/) uvádí linky 375 a 377.

Patnáct vozů je u zdroje vedeno bez provozovny (`depot: null`). Čtyři vozy pronajaté od ČSAD Střední Čechy (8255, 8257, 8258, 8297) mají v detailech uvedenou aktuální provozovnu Brandýs nad Labem. Evidují se podle současného provozovatele AD STŘEDNÍ ČECHY a při následném zpracování ČSAD Střední Čechy se nesmějí zahrnout podruhé. Jeden vůz je veden v dílnách a zůstává součástí katalogu. U 10 vozů je výslovně potvrzena klimatizace prostoru cestujících; ostatní nezjištěná výbava je `null`. Celé aktuální nátěry i výslovné reklamní polepy zádě se přebírají z detailů.

## Vozy AKV bus – Velvary (PID)
Soubor `data/vehicles/akv-bus.json` obsahuje 24 autobusů provozovny Velvary s jednoznačnými současnými čísly PID řady 73xx. Zdroj: [aktuální přehled provozovny Velvary přes sa-proxy](https://sa-proxy.kojban.cz/seznam?onlyCurrentDepot=1&depotId=5516&prov=1&trakce=autobus&iddopravce=235&vcetneSluzebnich=1), detaily všech vozů ověřeny 30. 9. 2026. Kontrola všech 115 záznamů nefiltrovaného provozního autobusového přehledu dopravce (dvě stránky) potvrdila, že množina všech současných čísel 73xx přesně odpovídá těmto 24 vozům. V ostatních záznamech přehledu nebyla nalezena další zmínka o PID. Přehledy současných elektrobusů a trolejbusů jsou prázdné. Ostatní provozovny a vozy mimo PID se do tohoto souboru nezahrnují; nejde o katalog celé celostátní flotily AKV.

Provozovna všech zahrnutých vozů je ověřena v detailu a ukládá se jako `Velvary`. Všech 24 vozů má výslovně potvrzenou celovozovou klimatizaci prostoru cestujících. USB a bezbariérovost nejsou ve zdrojových údajích výbavy potvrzené, proto mají hodnotu `null`. Nátěry jsou uložené celé. Slovník dopravců obsahuje název AKV bus, plný firemní název a regionální alias `AKV BUS (Střední Čechy)`; [oficiální přehled dopravce v PID](https://pid.cz/dopravci-a-partneri/akv-bus/) slouží jako kontrola provozního rozsahu.

## Pokrytí po abecedním doplnění AD a AKV
Tyto dva katalogy přidávají 43 vozů. Manifest načítá 13 souborů s celkem 1 516 vozy. Kontrola funkcí načítání a párování v aktuálním kódu aplikace ověřila všechny záznamy a nakonfigurované aliasy bez duplicit ID nebo klíčů dopravce + trakce + evidenční číslo. Živé ověření názvů z realtime feedu nebylo součástí tohoto kroku. Další nezpracovaný autobusový dopravce podle abecedy je ARRIVA autobusy.

## Vozy ARRIVA autobusy – čísla PID
Soubor `data/vehicles/arriva-autobusy.json` obsahuje 94 vozů společnosti ARRIVA autobusy se současnými evidenčními čísly řad 75xx a 76xx: 89 autobusů a 5 elektrobusů (všechny mají trakci `bus`). Detaily všech vozů byly ověřeny 1. 10. 2026 přes [sa-proxy](https://sa-proxy.kojban.cz/dopravce/arriva-autobusy). Jde o samostatnou společnost; ARRIVA CITY a ARRIVA STŘEDNÍ ČECHY se s ní v párování neslučují. Centrální slovník obsahuje její zdrojový název, plný firemní název a regionální alias `ARRIVA AUTOBUSY (Čáslav)`.

Provozní přehled [Čáslavi](https://sa-proxy.kojban.cz/seznam?onlyCurrentDepot=1&depotId=822&prov=1&trakce=autobus&iddopravce=253&vcetneSluzebnich=1) obsahuje 88 autobusů, z nichž 87 má jednoznačné současné evidenční číslo, a samostatný přehled obsahuje 5 elektrobusů. Nečíslovaný Irisbus Arway (SA ID 88006) se do párování nezařazuje. Všech 92 číslovaných čáslavských vozů má provozovnu ověřenou v detailu a uloženou jako `Čáslav`.

Kontrola celostátního provozního přehledu dopravce zahrnula 584 různých záznamů: 559 autobusů na šesti stránkách a 25 elektrobusů; přehled trolejbusů byl prázdný. Množina všech současně platných čísel 75xx/76xx obsahuje ještě vozy **7590 (SA ID 61711) a 7598 (SA ID 79132)**, vedené od roku 2025 v provozovně **Trutnov**. Jejich detaily potvrzují současného dopravce ARRIVA autobusy i obě čísla, proto jsou také v katalogu s `depot: "Trutnov"`. **Jejich evidence nepotvrzuje současné nasazení v PID.** Nejsou započteny do čáslavské flotily a nepřebírají historické provozovny Praha nebo Svoboda nad Úpou. Ostatní vozy celostátní flotily se do tohoto souboru nezahrnují.

Celé současné nátěry se přebírají z aktivních záznamů v detailech, nezjištěné údaje zůstávají `null`. U 91 vozů je potvrzena celovozová klimatizace prostoru pro cestující a u 42 USB. Bezbariérovost není ve zdrojových údajích výbavy výslovně potvrzena a neodvozuje se z modelu. Historická evidenční čísla ani římské označení generace se nepoužívají.

Kontrola načítání a párování v aktuálních funkcích aplikace ověřila všechny katalogy, všechna jejich ID a nakonfigurované aliasy bez duplicit. Ověřeno je i to, že číslo vozu ARRIVA autobusy se nespáruje pod ARRIVA CITY nebo ARRIVA STŘEDNÍ ČECHY. Jde o ověření katalogu a funkcí párování, nikoli živý test realtime feedu. Manifest nyní načítá 14 souborů s celkem 1 610 vozidlovými identitami. Další nezpracovaná autobusová společnost podle abecedy je ARRIVA CITY.

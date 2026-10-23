# Pikkujouluvisa

Kahoot-tyylinen, selaimessa pelattava reaaliaikainen tietovisa pikkujouluihin.

- **Juontaja** avaa `/host` omalla tietokoneellaan, luo pelihuoneen ja näyttää liittymiskoodin ja
  QR-koodin projektorilta.
- **Pelaajat** liittyvät omilla puhelimillaan osoitteessa `/join` – ilman sovelluksen asentamista
  ja ilman käyttäjätunnuksia.
- Vastaukset tarkistetaan ja pisteet lasketaan **aina palvelimella**. Oikea vastaus ei koskaan
  lähetä pelaajan selaimeen ennen kuin kysymys on päättynyt.
- Tulos- ja tulostaulunäkymät päivittyvät automaattisesti kaikilla laitteilla.

---

## 1. Vaatimukset

| Vaatimus | Versio |
| --- | --- |
| Node.js | 20.19+ tai 22.12+ (testattu Node 22.23) |
| npm | 10+ |
| Supabase-projekti | ilmainen taso riittää |

Teknologiat: Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 ·
Supabase Postgres · Zod 4 · lucide-react · qrcode.react · Vitest 5.

---

## 2. Riippuvuuksien asennus

```bash
npm install
```

---

## 3. Supabase-projektin luonti

1. Luo projekti osoitteessa <https://supabase.com/dashboard>.
2. Valitse projektista **Project Settings → API**.
3. Kopioi talteen:
   - **Project URL** (esim. `https://abcdefghijkl.supabase.co`)
   - **Publishable key** (`sb_publishable_…`) – julkinen
   - **Secret key** (`sb_secret_…`) – **salainen, vain palvelimelle**
4. Valitse **Project Settings → Data API** ja varmista, että **Exposed schemas** sisältää
   `public` (oletus).

> Jos projektissa on käytössä vanhan malliset `anon` / `service_role` -JWT-avaimet, ne toimivat
> sellaisenaan samoissa ympäristömuuttujissa.

---

## 4. SQL-migraatioiden suoritus

Migraatiot ovat hakemistossa `supabase/migrations/`:

| Tiedosto | Sisältö |
| --- | --- |
| `20260101000000_init.sql` | Taulut `rooms`, `players`, `answers`, indeksit, rajoitteet, RLS ja oikeuksien poisto |
| `20260101000100_functions.sql` | Atomiset RPC-funktiot pelin ohjaukseen, vastausten tallennukseen ja tilannekuvaan |
| `20260102000000_player_token_index.sql` | Pelaajan token-haun yhdistelmäindeksi `(room_id, token_hash)` ja päällekkäisen indeksin poisto |

Tiedostonimen etuliite on migraation versio (aikaleima), jota Supabase CLI käyttää
järjestyksen ja migraatiohistorian tunnistamiseen.

**Aja tiedostot tässä järjestyksessä.** Sovellus ei oleta, että taulut ovat valmiina.

### Vaihtoehto A – Supabasen GitHub-integraatio (automaattinen)

1. Työnnä repositorio GitHubiin (`git push -u origin main`).
2. Avaa Supabase-dashboardissa **Project Settings → Integrations → GitHub Integration**
   ja valtuuta GitHub.
3. Valitse repositorio ja aseta **Working directory** -kenttään `.`
   (koska `supabase/`-kansio on repositorion juuressa).
4. Ota käyttöön **Deploy to production** ja valitse tuotantohaaraksi `main`.
5. Integraatio soveltaa `supabase/config.toml`-asetukset ja ajaa sen jälkeen kaikki
   vielä soveltamattomat migraatiot.

### Vaihtoehto B – SQL-editori (nopein käsin tehtynä)

1. Avaa Supabase-dashboardissa **SQL Editor**.
2. Liitä koko `supabase/migrations/20260101000000_init.sql` sisältö ja paina **Run**.
3. Liitä koko `supabase/migrations/20260101000100_functions.sql` sisältö ja paina **Run**.

### Vaihtoehto C – Supabase CLI

```bash
supabase link --project-ref <projektitunnus>
supabase db push
```

Migraatiot voi ajaa uudelleen turvallisesti: taulut luodaan `if not exists` -ehdolla ja funktiot
`create or replace` -lauseella.

### Mitä migraatiot tekevät tietoturvan kannalta

- RLS on päällä kaikissa tauluissa eikä **yhdellekään** roolille ole kirjoitettu politiikkaa:
  `anon` ja `authenticated` eivät voi lukea eivätkä kirjoittaa mitään suoraan.
- Tauluilta ja RPC-funktioilta on peruttu oikeudet (`revoke all … from anon, authenticated`) ja
  EXECUTE on myönnetty vain `service_role`-roolille.
- Tokenit tallennetaan vain SHA-256-tiivisteenä (`host_token_hash`, `players.token_hash`).
- `answers`-taulussa on `UNIQUE (player_id, question_index)`, mikä estää kaksi vastausta samaan
  kysymykseen myös kilpailevissa pyynnöissä.

---

## 5. Reaaliaikaisuus

Tässä toteutuksessa reaaliaikaisuus hoidetaan **palvelinvälitteisellä tilakyselyllä**:
selain hakee `GET /api/rooms/[roomId]/state` noin sekunnin välein (juontaja 900 ms, pelaaja
1 100 ms) ja heti, kun välilehti palaa näkyviin tai verkkoyhteys palautuu.

Kyselyä **ei koskaan pysäytetä**: jos välilehti on piilossa, väliä pidennetään 4 sekuntiin ja
pelin päätyttyä 5 sekuntiin. Tämä on tärkeää juontajalle – muuten uusien pelaajien liittyminen
näkyisi vasta, kun hän palaa selainvälilehdelle (esim. vaihdettuaan musiikkisovellukseen).

Miksi näin eikä suoralla Supabase Realtime -tilauksella:

- Realtime-kanava ei ole käyttöoikeusjärjestelmä. Jotta selain voisi tilata taulukohtaisia
  muutoksia, `anon`-roolille pitäisi avata lukuoikeus tauluihin – ja `rooms`-taulussa on
  juontajan token-tiiviste ja `answers`-taulussa kaikki vastaukset.
- Palvelinvälitteinen tila on ainoa tapa taata, että oikea vastaus ei vuoda selaimeen ennen
  tulosvaihetta ja että jokainen vastaus näkyy vain omalle pelaajalleen.
- Ratkaisu on myös riippumaton siitä, onko Realtime päällä projektissa.

**Sinun ei siis tarvitse tehdä Supabase Realtime -asetuksia lainkaan.** Jos haluat myöhemmin
push-pohjaisen päivityksen, se on turvallista toteuttaa vain palvelimen kautta (esim. server-sent
events), ei suorana taulutilauksena selaimesta.

---

## 6. Ympäristömuuttujien asetus

Kopioi `.env.example` ja täytä arvot:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<projektitunnus>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_SERVICE_ROLE_KEY=sb_secret_…
# NEXT_PUBLIC_APP_URL=https://visa.example.com   # valinnainen
```

| Muuttuja | Pakollinen | Käyttötarkoitus |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | kyllä | Supabase-projektin URL |
| `SUPABASE_SERVICE_ROLE_KEY` | kyllä | Palvelinpuolen salainen avain. Käytetään **vain** route handlereissa. Ohittaa RLS:n. |
| `HOST_PASSCODE` | ei | Jos asetettu, uuden pelin luominen vaatii tämän tunnuslauseen. Tarkoitettu julkisiin asennuksiin. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ei | Julkinen avain. Selain ei keskustele Supabasen kanssa suoraan, joten tätä ei tarvita ajonaikaisesti. |
| `NEXT_PUBLIC_APP_URL` | ei | Julkinen osoite, jota QR-koodi käyttää. Ilman tätä käytetään selaimen nykyistä osoitetta. |

### Uuden pelin luonnin suojaaminen

Huoneen luonti on oletuksena avointa: pelaajat ja juontaja pääsevät aloittamaan ilman
kirjautumista. Jos sovellus on julkisessa osoitteessa, kuka tahansa löytäjä voi luoda huoneita.

Aseta silloin palvelimelle tunnuslause:

```dotenv
HOST_PASSCODE=pikkujoulu-2026
```

Tämän jälkeen:

- `POST /api/rooms` vaatii saman tunnuslauseen ja palauttaa muuten `401`.
- Juontajan sivu kysyy tunnuslausetta automaattisesti (`GET /api/rooms` kertoo, tarvitaanko sitä)
  ja muistaa sen selaimessa seuraavaa kertaa varten.
- Pelaajien liittyminen ei muutu mitenkään.
- Vertailu tehdään vakioaikaisesti tiivisteitä vertaamalla, eikä tunnuslausetta koskaan
  palauteta virheilmoituksissa.

Tunnuslause kannattaa vaihtaa pikkujoulujen jälkeen, jos sovellus jää julkiseksi.

Tiedostot voi sijoittaa myös hakemistoon `config/.env` – `next.config.ts` lataa sen erikseen.
Kaikki `.env*`-tiedostot ja `config/.env*` on lisätty `.gitignore`-tiedostoon.

> **Turvallisuus:** `SUPABASE_SERVICE_ROLE_KEY` ei koskaan käytä `NEXT_PUBLIC_`-etuliitettä eikä
> sitä koskaan tulosteta lokiin. Palvelinmoduulit on suojattu `server-only`-importilla, joten
> käännös epäonnistuu, jos jokin selaimessa ajettava moduuli yrittää ladata vastausavaimen.

---

## 7. Kehityspalvelimen käynnistys

```bash
npm run dev
```

Sovellus avautuu osoitteessa <http://localhost:3000>.

Puhelimilla testaaminen samassa verkossa:

```bash
npm run dev -- --hostname 0.0.0.0
```

Avaa tällöin juontajan sivu tietokoneen lähiverkko-osoitteella (esim.
`http://192.168.1.20:3000/host`), jotta QR-koodiin muodostuu puhelimilla toimiva osoite.
Vaihtoehtoisesti aseta `NEXT_PUBLIC_APP_URL` osoitteeseen, jolla puhelimet tavoittavat palvelimen.

---

## 8. Testien suoritus

```bash
npm run test        # yksikkö- ja integraatiotestit (Vitest)
npm run test:watch  # testit vahtitilassa
npm run lint        # ESLint
npm run typecheck   # TypeScript strict -tarkistus
npm run check       # lint + typecheck + testit
```

Testit eivät tarvitse Supabase-yhteyttä: tietokantaintegraatiot ajetaan PGlitellä
(PostgreSQL WebAssemblyssä) samoilla migraatiotiedostoilla kuin tuotannossa.

### Selaintason testit (Playwright)

```bash
npx playwright install chromium   # kerran: lataa selaimen
npm run build                     # testit ajetaan tuotantokäännöksestä
npm run test:e2e                  # kriittiset käyttäjäpolut
npm run test:e2e:ui               # sama, Playwrightin UI-tilassa
```

Selaintason testit tarvitsevat **oikean Supabase-projektin** (samat ympäristömuuttujat kuin
sovellus lukee `.env.local`-tiedostosta), koska ne käyttävät oikeaa tietokantaa, oikeita
istuntotokeneita ja palvelinpuolen pisteytystä. Playwright käynnistää `next start` -palvelimen
automaattisesti porttiin 3210 (`E2E_PORT`-ympäristömuuttujalla voi vaihtaa portin).

Testit luovat omat pelihuoneensa ja poistavat ne lopuksi. Jokainen pelaaja saa oman
selainkontekstin, joten ne vastaavat oikeita puhelimia (erilliset `localStorage`-tallennukset).

Testikattavuus:

| Tiedosto | Mitä testataan |
| --- | --- |
| `src/lib/questions/questions.test.ts` | Kysymys-JSONin skeema, tunnisteiden uniikkius, neljä erillistä vaihtoehtoa, aikarajat, pisteet, oikean vastauksen puuttuminen julkisesta muodosta |
| `src/lib/game/scoring.test.ts` | Pisteytys: väärä vastaus 0, oikea 500–1000, nopeusjärjestys, maksimiraja, myöhäinen vastaus 0 |
| `src/lib/game/stateMachine.test.ts` | Tilakoneen sallitut ja kielletyt siirtymät |
| `src/lib/game/leaderboard.test.ts` | Tulostaulun deterministinen järjestys ja jaetut sijoitukset |
| `src/lib/game/answerValidation.test.ts` | Vastauksen hyväksymisen säännöt (aika, toinen vastaus, väärä indeksi) |
| `src/lib/polling.test.ts` | Kyselyvälin valinta: näkyvä ja piilotettu välilehti, päättynyt peli |
| `src/lib/time.test.ts` | Kellokorjaus, jäljellä oleva aika, etenemispalkki |
| `src/test/database.test.ts` | Migraatiot, RLS, oikeudet, rajoitteet, tilakoneen siirtymät tietokannassa |
| `src/test/gameFlow.test.ts` | Koko peli alusta loppuun: kaksi pelaajaa, pisteytys, myöhästyneet vastaukset, kaksinkertaisen pisteytyksen esto, tulostaulu, pelin päättäminen |
| `src/test/interrupt.test.ts` | Kysymyksen keskeyttäminen kesken määräajan, myöhäisten vastausten hylkäys, juontajan token, idempotenssi, pelin päättäminen kesken sarjan |
| `e2e/host-lobby.spec.ts` | Juontaja luo pelin: PIN-koodi, QR-koodin renderöityminen ja liittymislinkin toimivuus |
| `e2e/join-flow.spec.ts` | Kaksi pelaajaa liittyy (QR-linkki ja käsin syötetty koodi), juontaja näkee heidät, virhetilanteet |
| `e2e/question-flow.spec.ts` | Kysymys, vastaus, toisen vastauksen esto, oikean vastauksen paljastuminen vasta tulosvaiheessa, tulostaulu, seuraava kysymys |
| `e2e/game-end.spec.ts` | Viimeisen kysymyksen jälkeen peli päättyy, voittaja ja konfetti, pelaajan lopullinen sijoitus |
| `e2e/interrupt.spec.ts` | Kysymyksen keskeyttäminen kesken määräajan (mitataan, että tulosvaihe saavutetaan ennen aikarajaa) ja pelin päättäminen etuajassa |

---

## 9. Tuotantojulkaisu

### Oma palvelin tai Docker

```bash
npm run build
npm run start
```

### Vercel

Vercel tunnistaa Next.js-projektin automaattisesti, eikä `vercel.json`-tiedostoa tarvita.
Repositorion kytkeminen riittää – mutta **ympäristömuuttujat on pakko asettaa**, muuten
sovellus kyllä käynnistyy mutta jokainen API-kutsu epäonnistuu.

1. **Yhdistä repositorio.** vercel.com → *Add New… → Project* → *Import Git Repository* →
   valitse `tietovisa`. Framework Preset = *Next.js*, Root Directory = `.`,
   Build Command = `npm run build` (oletus), Output Directory = oletus.
2. **Aseta ympäristömuuttujat** (*Environment Variables*) ennen ensimmäistä julkaisua.
   Valitse kaikki kolme ympäristöä (Production, Preview, Development), jos haluat
   esijulkaisujen toimivan.
3. **Julkaise.** Ensimmäinen julkaisu antaa osoitteen `https://<projekti>.vercel.app`.
4. **Jatko julkaisut ovat automaattisia:** jokainen `git push` main-haaraan julkaisee uuden
   version, ja Supabasen GitHub-integraatio ajaa samalla uudet migraatiot.

| Muuttuja | Pakollinen | Milloin luetaan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | kyllä | buildissa ja ajonaikaisesti |
| `SUPABASE_SERVICE_ROLE_KEY` | kyllä | ajonaikaisesti (merkitse *Sensitive*) |
| `HOST_PASSCODE` | ei – suositus julkisessa osoitteessa | ajonaikaisesti |
| `NEXT_PUBLIC_APP_URL` | ei | **buildissa**: `NEXT_PUBLIC_`-arvot upotetaan koodiin |

Huomioitavaa:

- Jos `NEXT_PUBLIC_APP_URL` jätetään asettamatta, QR-koodi muodostetaan selaimen nykyisestä
  osoitteesta. Vercelissä se on aina oikein, myös esijulkaisuissa. Aseta muuttuja vain, jos
  haluat pakottaa tietyn verkkotunnuksen.
- `NEXT_PUBLIC_`-muuttujan muuttaminen vaatii uuden julkaisun. Pelkän palvelinpuolen muuttujan
  (`SUPABASE_SERVICE_ROLE_KEY`, `HOST_PASSCODE`) muutos riittää käynnistykseen.
- Vercel käyttää oletuksena Node.js 24.x, mikä kelpaa: Next.js 16 vaatii vähintään 20.9.
- Supabasen puolella ei tarvita lisäasetuksia. Sovellus ei käytä Supabase Authia eikä selain
  keskustele Supabasen kanssa, joten verkkotunnusten sallintaa ei tarvita.

### Vercelissä eri tavalla käyttäytyvät asiat

- **Nopeusrajoitus on instanssikohtainen.** Rajoitin on muistissa ja Vercel ajaa useita
  instansseja, joten tehollinen raja on löysempi kuin yhdellä palvelimella.
  `HOST_PASSCODE` on siksi suositeltu julkisessa osoitteessa. Jaettu rajoitin vaatisi erillisen
  varaston (esim. Redis).
- **Kysely tuottaa paljon funktiokutsuja.** Pelaaja kysyy tilaa noin kerran sekunnissa, joten
  kahden tunnin peli 30 pelaajalla on noin 200 000 pyyntöä. Yhdelle pikkujouluille tämä on
  hyvin ok, mutta tarkista oman tilisi rajat. Tarvittaessa kyselyväliä voi kasvattaa
  (`src/hooks/useRoomState.ts`).
- **Kylmäkäynnistys** voi hidastaa ensimmäistä pyyntöä noin sekunnin verran.
- **Playwright-testit eivät aja Vercelissä.** Julkaisu ajaa vain `npm run build`, joka tarkistaa
  TypeScriptin mutta ei ESLintia. Jos haluat portinvartijan, lisää GitHub Action, joka ajaa
  `npm run check`.

### Supabasen Vercel-integraatio

Vercelin Marketplace-tarjonnassa on valmis Supabase-integraatio. Se **ei ole pakollinen** tälle
sovellukselle, mutta se tekee seuraavat asiat:

1. **Synkronoi ympäristömuuttujat automaattisesti.** Supabase-projektin arvot tulevat Vercelin
   ympäristömuuttujiksi ilman käsin kopiointia, ja ne pysyvät ajan tasalla, jos avaimet
   vaihdetaan.
2. **Preview branches.** Jokaiselle esijulkaisulle voidaan luoda oma Supabase-haara: erillinen
   instanssi, joka on oletuksena **tyhjä ilman dataa** ja jonka skeema rakennetaan repositorion
   `supabase/migrations`-tiedostoista. Näin esijulkaisu ei voi koskea oikeaan pelidataan.
3. **Verkkotunnusten automaattinen sallinta** Supabasessa. Tälle sovellukselle tarpeeton, koska
   sovellus ei käytä Supabase Authia.
4. **Laskutus Vercelin kautta**, jos Supabase-projekti luodaan Vercelin kautta.

Integraatio asentaa muuttujat **eri nimillä** kuin tässä repossa on totuttu:

```text
POSTGRES_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, POSTGRES_USER,
POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_DATABASE,
SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
SUPABASE_SECRET_KEY
```

Tämä sovellus lukee **molemmat nimeämiskäytännöt** (`resolveSupabaseEnv` tiedostossa
`src/lib/env.ts`), joten integraatiota voi käyttää sellaisenaan. Ilman tätä tukea sovellus olisi
kaatunut, koska integraatio ei aseta lainkaan muuttujaa `SUPABASE_SERVICE_ROLE_KEY`.

**Mitä integraatio ei tee:** se ei aja migraatioita tuotantoprojektiisi. Se hoituu erikseen
Supabasen GitHub-integraatiolla (kohta 4).

**Milloin siitä on hyötyä:** jos haluat esijulkaisujen käyttävän omaa tyhjää tietokantaa tai
haluat avainten synkronoituvan automaattisesti. **Milloin se on tarpeeton:** yhden illan
pikkujoulusovellukselle, jossa kaikki työ tehdään `main`-haaraan, käsin asetetut kaksi muuttujaa
riittävät ja ovat yksinkertaisempia.

> Jos asennat integraation, poista käsin asettamasi päällekkäiset muuttujat. Integraation
> hallitsemia muuttujia ei voi muokata käsin, joten päällekkäisyys tekee vaikeaksi tietää,
> kumpi arvo on voimassa.

### Julkaisun jälkeen

- Aja migraatiot tuotannon Supabase-projektiin (kohta 4). GitHub-integraatio hoitaa tämän
  automaattisesti noin minuutissa pushista.
- Testaa peli vähintään kahdella eri selaimella ja puhelimella.

---

## 10. Näin peli pelataan

### Juontaja

1. Avaa `/host`.
2. Paina **Luo uusi peli**. Sovellus arpoo kuusinumeroisen liittymiskoodin.
3. Näytä projektorilta liittymiskoodi ja QR-koodi.
4. Kun pelaajat ovat liittyneet, paina **Aloita peli**.
5. Kysymys etenee: **Näytä oikea vastaus** → **Näytä tilanne** → **Seuraava kysymys**.
   Kysymyksen päätyttyä siirtymä tulosvaiheeseen tapahtuu myös automaattisesti.
   Kesken kysymyksen voit painaa **Lopeta kysymys nyt**, ja tulostaululla **Päätä peli tässä**,
   jos haluat lopettaa aiemmin (ks. *Keskeyttäminen ja tauko*).
6. Viimeisen kysymyksen jälkeen paina **Näytä lopullinen tulostaulu**.

Näppäimistö: **Ctrl + Enter** (tai **Cmd + Enter**) suorittaa näkyvissä olevan ensisijaisen
painikkeen. Tavallinen Enter tai välilyönti ei käynnistä peliä vahingossa.

### Pelaaja

1. Skannaa QR-koodi tai avaa `/join` ja syötä kuusinumeroinen koodi.
2. Valitse nimimerkki (2–24 merkkiä, uniikki samassa pelissä).
3. Vastaa kysymyksiin napauttamalla suurta värillistä painiketta.
4. Näet oman pistemäärän ja sijoituksesi kysymyksen jälkeen.

Pelaaja voi päivittää sivun kesken pelin – istunto säilyy samassa selaimessa.

### Keskeyttäminen ja tauko

Peliä voi hallita kesken kaiken:

| Tilanne | Mitä tapahtuu |
| --- | --- |
| Tauko kysymysten välissä | Odotushuone, tulosnäkymä ja tulostaulu odottavat juontajaa rajattomasti. Pelkkä "ei klikkaa" riittää tauoksi. |
| Kysymys kesken, tarvitaan tauko | Paina **Lopeta kysymys nyt**. Kysymys päättyy heti, jo annetut vastaukset pisteytetään ja tämän jälkeen saapuvat vastaukset hylätään myöhäisinä. |
| Peli halutaan lopettaa aiemmin | Tulostaululla paina **Päätä peli tässä**. Lopullinen tulostaulu lasketaan tähän mennessä kertyneistä pisteistä. |
| Koko selain suljetaan | Pelin tila on tietokannassa ja juontajan istunto selaimessa. Avaa `/host` ja paina **Avaa pelihuone** – peli jatkuu täsmälleen siitä mihin jäi. Myös pelaajien puhelimet palautuvat automaattisesti. |
| Kysymys jäi kesken selaimen sulkeutuessa | Kysymyksen määräaika kuluu loppuun palvelimella; vastaamatta jääneet saavat 0 pistettä. Juontajan palatessa tulosvaihe siirtyy automaattisesti eteenpäin. |

Määräaikaa ei voi pidentää eikä peliä voi "jäädyttää" kesken kysymyksen – kysymys joko
päättyy itsestään tai juontaja päättää sen. Tämä on tarkoituksellista: palvelin on ajan
auktoriteetti, joten kukaan ei voi saada lisäaikaa.

---

## 11. Arkkitehtuuri

```
src/
├─ app/
│  ├─ page.tsx                     Aloitussivu
│  ├─ host/page.tsx                Juontajan aloitus: luo tai jatka peliä
│  ├─ host/[roomId]/page.tsx       Juontajan pelihuone
│  ├─ join/page.tsx                Liittyminen (PIN + nimimerkki)
│  ├─ play/[playerId]/page.tsx     Pelaajan pelinäkymä
│  └─ api/rooms/…                  Palvelinpuolen route handlerit
├─ components/                     Käyttöliittymäkomponentit
├─ hooks/                          useRoomState, useCountdown, useNow, useStoredValue
├─ lib/
│  ├─ game/                        Tilakone, pisteytys, tulostaulu, vastauksen validointi
│  ├─ questions/                   Kysymysten validointi (server-only, sisältää vastausavaimen)
│  ├─ supabase/                    Palvelinpuolen Supabase-client ja virheiden muunnos
│  ├─ api/                         Pyyntöskeemat, virhevastaukset, selainpuolen client
│  ├─ rooms.ts                     Huoneen elinkaari ja pelin ohjaus (RPC-kutsut)
│  ├─ roomState.ts                 Roolikohtaisen julkisen tilan rakentaminen
│  ├─ tokens.ts                    Tokenit, hashit ja PIN-koodit
│  └─ rateLimit.ts                 Nopeusrajoitus
├─ data/questions.json             Kysymykset (32 kpl)
├─ test/                           PGlite-integraatiotestien apurit
└─ (juuri) e2e/                    Playwright-selaintestit ja niiden apurit
```

### API-rajapinta

| Metodi | Reitti | Rooli | Kuvaus |
| --- | --- | --- | --- |
| `POST` | `/api/rooms` | – | Luo huone, palauttaa PIN-koodin ja juontajan tokenin |
| `POST` | `/api/rooms/join` | – | Liittää pelaajan PIN-koodilla, palauttaa pelaajan tokenin |
| `GET` | `/api/rooms/[roomId]/state` | juontaja / pelaaja | Roolikohtainen julkinen tila (otsikot `x-host-token` / `x-player-token`) |
| `POST` | `/api/rooms/[roomId]/start` | juontaja | `lobby → question` |
| `POST` | `/api/rooms/[roomId]/reveal` | juontaja | `question → question_result` (vain määräajan jälkeen) |
| `POST` | `/api/rooms/[roomId]/leaderboard` | juontaja | `question_result → leaderboard` |
| `POST` | `/api/rooms/[roomId]/next` | juontaja | `leaderboard → question` tai `leaderboard → finished` |
| `POST` | `/api/rooms/[roomId]/end-question` | juontaja | Keskeyttää käynnissä olevan kysymyksen heti |
| `POST` | `/api/rooms/[roomId]/finish` | juontaja | `leaderboard → finished` kesken kysymyssarjan |
| `POST` | `/api/rooms/[roomId]/answer` | pelaaja | Vastauksen vastaanotto ja palvelinpuolen pisteytys |

### Tilakone

```
lobby → question → question_result → leaderboard → question …
                                                ↘ finished
```

Jokainen siirtymä tarkistetaan sekä TypeScriptissä (`src/lib/game/stateMachine.ts`) että
tietokannan RPC-funktiossa, joka lukitsee huonerivin `SELECT … FOR UPDATE` -lauseella. Kaksi
nopeaa komentoa eivät voi hypätä kysymyksen yli eivätkä palkita pelaajaa kahdesti.

### Pisteytys

```
points = round(maxPoints × (1 − 0,5 × elapsedMs / timeLimitMs))
```

- Väärä vastaus: 0 pistettä.
- Välitön oikea vastaus: lähes 1000 pistettä.
- Aikarajan lopussa oikea vastaus: noin 500 pistettä.
- Aikarajan jälkeen saapunut vastaus hylätään kokonaan.

`elapsedMs` lasketaan palvelimen vastaanottohetkestä ja palvelimen asettamasta kysymyksen
aloitusajasta. Selaimen kelloa tai ilmoittamaa vastausaikaa ei käytetä.

### Tasapisteet

1. kokonaispisteet
2. oikeiden vastausten määrä
3. liittymisjärjestys ja lopuksi pelaajan tunniste (täysin deterministinen)

Täsmälleen samat pisteet ja oikeat vastaukset saaneet pelaajat saavat jaetun sijoituksen.

---

## 12. Tietoturva

| Vaatimus | Toteutus |
| --- | --- |
| Palvelinavain vain palvelimella | `SUPABASE_SERVICE_ROLE_KEY` ilman `NEXT_PUBLIC_`-etuliitettä; `server-only` estää käännösvaiheessa väärän importin |
| RLS käytössä | Kaikissa tauluissa, ei yhtään politiikkaa `anon`/`authenticated`-roolille |
| Ei suoria kirjoitusoikeuksia | `revoke all` tauluilta ja funktioilta; EXECUTE vain `service_role`-roolille |
| Istunnot | 256-bittinen satunnaistoken, tietokannassa vain SHA-256-tiiviste |
| Tokenit selaimessa | `localStorage` + pyyntöotsikot; ei koskaan URL-osoitteessa |
| Juontajan komennot | Token tarkistetaan sekä route handlerissa että RPC-funktiossa |
| Pelaajan vastaukset | Token + huonejäsenyys + kysymysindeksi + määräaika tarkistetaan palvelimella |
| Oikea vastaus | Lähetetään pelaajalle vain tulosvaiheessa (`question_result`, `leaderboard`, `finished`) |
| Syötteiden validointi | Zod kaikille pyynnöille; nimimerkki 2–24 merkkiä, sallitut merkit rajattu |
| Nopeusrajoitus | Muistinvarainen liukuva ikkuna: liittyminen, huoneen luonti (5/min ja 20/h per IP) ja vastaukset |
| Avoin huoneen luonti | Voidaan suojata `HOST_PASSCODE`-tunnuslauseella. Vertailu vakioaikaisesti, tunnuslausetta ei koskaan palauteta vastauksissa. |
| Vanhentunut data | Huoneet poistetaan automaattisesti 24 tunnin jälkeen uuden huoneen luonnin yhteydessä (kaskadi poistaa pelaajat ja vastaukset) |
| Virheilmoitukset | Suomenkielisiä, eivät sisällä SQL-virheitä eivätkä salaisuuksia |

---

## 13. Tunnetut rajoitukset

- **Reaaliaikaisuus on kyselypohjaista** (n. 1 s väli), ei Supabase Realtime -tilausta.
  Perustelu on kohdassa 5. Yhden illan pikkujouluvisaan tämä on riittävä ja tietoturvaltaan
  selvästi turvallisempi vaihtoehto.
- **Nopeusrajoitus on prosessikohtainen.** Moni-instanssisessa tuotannossa tilalle vaihdetaan
  jaettu tallennus (esim. Redis).
- **Selaintason testit vaativat oikean Supabase-projektin** eivätkä ne siksi kuulu `npm run
  check` -komentoon. Ne ajetaan erikseen komennolla `npm run test:e2e` (ks. kohta 8).
  Testit on ajettu Chromiumilla; Safari ja Firefox eivät ole testatussa joukossa.
- **Testattu vain Chromiumilla ja yhdellä koneella.** Oikeilla puhelimilla (iOS Safari,
  Android Chrome) testaaminen jäi tekemättä, koska käytettävissä ei ollut laitteita.
- **Huoneet siivotaan automaattisesti 24 tunnin jälkeen** uuden huoneen luonnin yhteydessä.
  Siivous on parasta yritystä eikä kaada huoneen luontia, jos se epäonnistuu. Jos haluat säilyttää
  tulokset pidempään, ota siivous pois päältä tai pidennä aikarajaa
  (`src/lib/rooms.ts` → `PURGE_OLDER_THAN_HOURS`).
- **Juontajan istunto on selainkohtainen.** Jos selaimen tiedot tyhjennetään kesken pelin,
  peliä ei voi enää hallita – uusi peli pitää luoda.
- **Pelaaja ei voi palata peliin uudella laitteella.** Istunto on sidottu selaimeen;
  uudelleenliittyminen onnistuu vain ennen pelin alkua.

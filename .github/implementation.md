# Rakenna Kahoot-tyylinen pikkujouluvisa

## 1. Rooli ja tavoite

Toimi kokeneena full-stack-kehittäjänä ja rakenna täysin toimiva, selaimessa pelattava Kahoot-tyylinen tietovisasovellus pikkujouluihin.

Tämä ei ole pelkkä UI-prototyyppi. Toteuta toimiva monen pelaajan järjestelmä, jossa:

- Juontaja käynnistää pelin omalla tietokoneellaan.
- Juontaja näyttää liittymiskoodin ja QR-koodin projektorilla.
- Pelaajat liittyvät omilla puhelimillaan ilman käyttäjätunnusta tai sovelluksen asentamista.
- Juontaja käynnistää kysymykset ja hallitsee pelin etenemistä.
- Pelaajat vastaavat samanaikaisesti puhelimillaan.
- Vastaukset tarkistetaan turvallisesti palvelinpuolella.
- Pisteet lasketaan oikeellisuuden ja vastausnopeuden perusteella.
- Tulokset ja tulostaulu päivittyvät reaaliaikaisesti.
- Pelin lopussa näytetään voittaja ja lopullinen tulostaulu.

Optimoi toteutus yhden työpäivän MVP-projektiksi. Priorisoi toimivuus, selkeä arkkitehtuuri, näyttävä käyttöliittymä ja helppo käyttöönotto.

Älä rakenna tarpeettomia ominaisuuksia. Älä tyydy esittelydataan tai feikattuun reaaliaikaisuuteen.

## 2. Teknologiat

Käytä seuraavia teknologioita:

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- Supabase Postgres
- Supabase Realtime
- Supabase SSR -kirjaston ajantasainen, tuettu toteutus tarvittaessa
- Zod syötteiden validointiin
- Lucide React ikoneihin
- QR-koodin generointiin sopiva kevyt kirjasto, esimerkiksi `qrcode.react`
- Vitest yksikkötesteihin
- Playwright kriittisten käyttäjäpolkujen testaamiseen, jos aika sallii

Käytä projektin luontihetkellä ajantasaisia vakaita ja keskenään yhteensopivia versioita. Tarkista kirjastojen API ennen toteutusta.

Älä lisää tarpeettomia riippuvuuksia.

Kaikki näkymät toimivat responsiivisesti mobiilissa ja tietokoneella.

## 3. Pelin käyttäjäpolut

### Juontaja

Juontaja avaa reitin `/host`.

Juontajan näkymä sisältää:

1. Aloitusnäkymä ja painike uuden pelin luomiseen.
2. Pelihuoneen luonti.
3. Liittymiskoodi ja QR-koodi.
4. Osallistujien odotushuone.
5. Osallistujalista ja pelaajamäärä.
6. Painike pelin aloittamiseen.
7. Kysymysnäkymä, jossa ovat kysymys, neljä vastausvaihtoehtoa, ajastin ja vastausmäärä.
8. Kysymyksen päätyttyä oikea vastaus ja vastausjakauma.
9. Välitulostaulu.
10. Seuraavan kysymyksen käynnistys.
11. Lopullinen tulostaulu ja voittajan korostus.

Juontaja hallitsee pelin etenemistä. Pelin tulee olla hallittavissa yhdestä selaimesta.

### Pelaaja

Pelaaja avaa reitin `/join`.

Pelaajan polku:

1. Syötä liittymiskoodi tai siirry QR-koodin kautta valmiiksi täytettyyn liittymisnäkymään.
2. Anna nimimerkki.
3. Liity odotushuoneeseen.
4. Odota juontajan aloitusta.
5. Näe kysymys ja neljä suurta vastauspainiketta.
6. Valitse yksi vastaus.
7. Näe vahvistus vastauksen tallentumisesta.
8. Odota kysymyksen päättymistä.
9. Näe oikea vastaus ja omat pisteet.
10. Jatka seuraavaan kysymykseen.
11. Näe lopullinen sijoitus ja pistemäärä.

Pelaajan käyttöliittymän on oltava erittäin helppo käyttää yhdellä kädellä puhelimella.

Älä näytä oikeaa vastausta ennen kuin kysymys on päättynyt.

### Yleiset reitit

Toteuta vähintään:

- `/` – näyttävä aloitussivu, josta pääsee juontajaksi tai pelaajaksi.
- `/host` – juontajan sovellus.
- `/join` – liittyminen.
- `/play/[playerId]` – pelaajan pelinäkymä.
- `/host/[roomId]` – juontajan yksittäinen pelihuone.

Voit yhdistää tai yksinkertaistaa reittejä, jos se tekee toteutuksesta luotettavamman. Säilytä kuitenkin erilliset juontajan ja pelaajan käyttökokemukset.

## 4. Visuaalinen suunnittelu

Tee käyttöliittymästä kirkas, värikäs ja energinen. Sen tulee muistuttaa modernia live-tietovisapeliä, mutta älä kopioi Kahootin logoa tai brändi-ilmettä sellaisenaan.

### Visuaalinen tyyli

- Kirkas violetti tai syvän sininen tausta.
- Neljä selvästi erottuvaa vastausväriä: punainen, sininen, keltainen ja vihreä.
- Suuret, pyöristetyt painikkeet.
- Valkoinen, erittäin helposti luettava typografia.
- Rohkeat otsikot ja suuret pisteluvut.
- Kevyet varjot ja selkeät kortit.
- Animoitu ajastin ja kysymyksen etenemispalkki.
- Tulostaulun sijoitukset visuaalisesti erottuviksi.
- Voittajalle konfettiefekti, mutta vain pelin lopussa.
- Kevyet siirtymät ja palautteet Framer Motionilla tai CSS-animaatioilla.

Älä tee käyttöliittymästä geneeristä SaaS-hallintapaneelia.

### Pelaajan mobiilinäkymä

- Neljä vastauspainiketta vievät suurimman osan käytettävissä olevasta tilasta.
- Painikkeiden kosketusalue on vähintään noin 48 × 48 CSS-pikseliä.
- Käytä CSS Grid -asettelua, joka toimii kapeilla näytöillä.
- Älä vaadi vaakasuuntaista vieritystä.
- Ota huomioon safe area -alueet.
- Näytä selkeästi, onko vastaus lähetetty.
- Estä lisävastaukset onnistuneen lähetyksen jälkeen.
- Säilytä näkymä vakaana, vaikka reaaliaikainen tilapäivitys saapuu.

### Juontajan näyttö

Optimoi projektorille ja suurelle näytölle:

- Suuret kysymystekstit.
- Selkeä liittymiskoodi.
- Helposti luettava QR-koodi.
- Vastausten lukumäärä.
- Näkyvä ajastin.
- Vastausvaihtoehtojen värit.
- Tulostaulussa vähintään kymmenen parasta pelaajaa, jos osallistujia riittää.

Tee myös näppäimistöllä käytettävät ohjaimet mahdollisuuksien mukaan, mutta varmista, etteivät tavalliset näppäinpainallukset vahingossa käynnistä peliä.

## 5. Kysymykset JSON-tiedostossa

Tallenna kysymykset tiedostoon:

`src/data/questions.json`

Käytä esimerkiksi seuraavaa rakennetta:

```json
[
  {
    "id": "q1",
    "category": "Yleistieto",
    "question": "Mikä on Suomen pääkaupunki?",
    "answers": [
      "Turku",
      "Tampere",
      "Helsinki",
      "Oulu"
    ],
    "correctAnswerIndex": 2,
    "timeLimitSeconds": 20,
    "points": 1000
  }
]
```

Lisää vähintään 20 esimerkkikysymystä suomeksi. Sisällytä esimerkiksi:

- Yleistieto
- Musiikki ja viihde
- Suomi ja suomalaiset ilmiöt
- Ruoka ja juoma
- Kevyt joulu- ja pikkujouluteema
- Hauskat mutta asialliset kysymykset

Älä käytä loukkaavaa sisältöä tai tekaistuja faktaväitteitä.

Varmista Zod-skeemalla, että jokaisessa kysymyksessä on:

- Yksilöllinen tunniste.
- Ei-tyhjä kysymysteksti.
- Täsmälleen neljä erillistä vastausvaihtoehtoa.
- Kelvollinen oikean vastauksen indeksi.
- Kelvollinen aikaraja.
- Kelvollinen maksimipistemäärä.

Luo kysymysten lataukseen tyypitetty moduuli. Lisää käynnistyksen yhteydessä tai testeissä validointi, joka epäonnistuu selkeästi virheellisellä JSON-datalla.

JSON on ainoa kysymysten lähde. Älä rakenna kysymyshallintapaneelia.

### Tärkeä tietoturvasääntö

Älä koskaan lähetä `correctAnswerIndex`-arvoa pelaajan selaimeen ennen kysymyksen päättymistä.

Pidä vastausavain vain palvelinpuolen moduulissa tai muuten palvelimen hallitsemassa ympäristössä. Älä tuo sitä client component -moduuliin.

Kun kysymys päättyy, lähetä pelaajille vain kysymyksen julkinen tulos, kuten oikean vaihtoehdon indeksi ja heidän oma pistemääränsä.

## 6. Tietokantamalli

Toteuta Supabaseen tarvittavat SQL-migraatiot esimerkiksi hakemistoon:

`supabase/migrations/`

Pidä tietomalli tarkoituksella yksinkertaisena.

### Taulu `rooms`

Kentät:

- `id`: UUID, primary key.
- `pin`: satunnainen kuusinumeroinen liittymiskoodi.
- `status`: `lobby`, `question`, `question_result`, `leaderboard`, `finished`.
- `current_question_index`: kokonaisluku.
- `question_started_at`: timestamptz, nullable.
- `question_ends_at`: timestamptz, nullable.
- `host_token_hash`: juontajan salaisen tokenin hash.
- `created_at`: timestamptz.
- `updated_at`: timestamptz.

Luo uniikki indeksi PIN-koodille. PIN-koodin luonti ei saa epäonnistua pysyvästi törmäyksen vuoksi, vaan palvelimen pitää yrittää uutta koodia.

### Taulu `players`

Kentät:

- `id`: UUID, primary key.
- `room_id`: UUID, foreign key huoneeseen.
- `nickname`: varchar, validoitu pituus.
- `score`: integer, oletus 0.
- `joined_at`: timestamptz.
- `last_seen_at`: timestamptz, jos läsnäolon seurantaa tarvitaan.

Lisää indeksi `(room_id, score DESC)`.

Pelaajan nimi ei ole autentikointitunniste. Pelaajan oikeudet perustuvat satunnaiseen, riittävän pitkään salaiseen tokeniin, jonka hash tallennetaan palvelimelle tai jonka validointi tehdään turvallisella allekirjoitetulla mekanismilla.

### Taulu `answers`

Kentät:

- `id`: UUID, primary key.
- `room_id`: UUID, foreign key.
- `player_id`: UUID, foreign key.
- `question_index`: integer.
- `answer_index`: integer.
- `is_correct`: boolean.
- `response_time_ms`: integer.
- `points_awarded`: integer.
- `submitted_at`: timestamptz.

Luo uniikki rajoite:

`UNIQUE (player_id, question_index)`

Tällä estetään useat vastaukset samasta kysymyksestä.

Lisää tarvittavat indeksit huoneen, kysymyksen ja pelaajan hakuihin.

Tallenna pisteet vain palvelinpuolen tarkistuksen jälkeen. Älä hyväksy asiakkaalta kenttiä `is_correct`, `response_time_ms` tai `points_awarded` luotettavina arvoina.

### Supabase Realtime

Käytä Realtimea pelaajalistan, huoneen julkisen tilan, vastausmäärän ja tulostaulun päivityksiin.

Älä käytä Realtime Broadcastia tai Presencea ainoana pysyvänä tietolähteenä. Tietokanta on pelin pysyvän tilan totuuden lähde.

Älä anna anonyymien selainten lukea koko tietokantaa tai oikeita vastauksia. Realtime-kanavat eivät itsessään ole käyttöoikeusjärjestelmä.

Jos suora Realtime-tilaus vaarantaisi yksityisyyden, käytä palvelimen kautta välitettyä julkista pelitilaa.

## 7. Tietoturva ja käyttöoikeudet

Toteuta seuraavat periaatteet alusta lähtien:

1. Supabase `service_role` -avain saa olla vain palvelinpuolella ympäristömuuttujassa. Älä koskaan käytä `NEXT_PUBLIC_`-etuliitettä siihen.
2. Ota RLS käyttöön kaikissa sovelluksen tauluissa.
3. Älä anna anonyymeille käyttäjille suoraa oikeutta muuttaa huoneiden tilaa, pelaajien pisteitä tai vastausrivejä.
4. Käytä palvelinpuolen Route Handlereita tai Server Actioneita validoituihin pelitoimintoihin.
5. Tarkista juontajan token jokaisessa juontajan komennossa.
6. Tarkista pelaajan token ja huonejäsenyys jokaisessa vastauspyynnössä.
7. Tokenit luodaan kryptografisesti turvallisella satunnaisuudella.
8. Älä tallenna selväkielisiä juontaja- tai pelaajatokeneita tietokantaan.
9. Älä palauta tokeneita lokiviesteissä tai virheilmoituksissa.
10. Validioi kaikki pyynnöt Zodilla.
11. Rajoita nimimerkin pituutta ja salli vain turvalliset, tulostettavat merkit.
12. Rajoita liittymis- ja vastauspyyntöjen nopeutta kohtuullisesti.
13. Älä hyväksy vastauksia ennen kysymyksen alkua tai sen päättymisen jälkeen.
14. Älä paljasta oikeita vastauksia ennen tulosvaihetta.
15. Älä luota selaimen kelloon, pistelaskuun tai ilmoitettuun vastausnopeuteen.

Älä rakenna täydellistä käyttäjähallintaa. Juontajan ja pelaajien satunnaiset istuntotokenit riittävät tähän kertakäyttöiseen peliin.

## 8. Pelin tilakone

Toteuta pelin tilat eksplisiittisenä tilakoneena.

Sallitut tilat:

- `lobby`
- `question`
- `question_result`
- `leaderboard`
- `finished`

Sallitut siirtymät:

`lobby → question`

`question → question_result`

`question_result → leaderboard`

`leaderboard → question`

`leaderboard → finished`

Viimeisen kysymyksen jälkeen siirry tulostaulun kautta `finished`-tilaan.

Toteuta pelin ohjaus palvelinpuolella. Jokaisen tilasiirtymän on tarkistettava nykyinen tila ja sallittu seuraava tila.

Huomioi samanaikaiset pyynnöt: kaksi nopeaa aloitus- tai seuraava kysymys -komentoa eivät saa hypätä kysymysten yli tai palkita pelaajia kahdesti.

Käytä tarvittaessa Postgres-transaktioita, RPC-funktiota tai lukitusta kriittisissä päivityksissä. Pisteytyksen ja vastauksen tallennuksen on oltava atomisia tai muuten suojattuja kilpailevilta pyynnöiltä.

### Tilojen toiminta

`lobby`:

- Pelaajat voivat liittyä.
- Juontaja näkee pelaajat reaaliajassa.
- Peliä ei voi aloittaa, jos huone on virheellinen.

`question`:

- Pelaajat näkevät kysymyksen ja vastausvaihtoehdot.
- Palvelin asettaa kysymyksen aloitus- ja päättymisajat.
- Vastauksia otetaan vastaan määräaikaan asti.
- Pelaaja voi vastata vain kerran.

`question_result`:

- Uudet vastaukset estetään.
- Oikea vastaus voidaan näyttää.
- Pelaajan pisteet ja vastausjakauma näytetään.

`leaderboard`:

- Näytetään sijoitukset ja pisteet.
- Juontaja voi käynnistää seuraavan kysymyksen.

`finished`:

- Lopullinen tulostaulu näytetään.
- Uusia vastauksia tai pelin etenemiskomentoja ei hyväksytä.
- Huone voidaan säilyttää tulosten katselua varten rajatun ajan.

## 9. Palvelinpuolen pisteytys

Toteuta pisteytys deterministisesti palvelinpuolella.

Oletuspisteytys:

- Väärä vastaus: 0 pistettä.
- Oikea vastaus: enintään 1000 pistettä.
- Mitä nopeammin pelaaja vastaa, sitä enemmän pisteitä hän saa.

Esimerkiksi:

`points = round(maxPoints * (1 - 0.5 * elapsedMs / timeLimitMs))`

Tämä antaa nopeasta oikeasta vastauksesta lähes 1000 pistettä ja aikarajan lopussa oikeasta vastauksesta noin 500 pistettä.

Pisteitä annetaan vain, jos vastaus on oikea ja vastaanottohetki on ennen kysymyksen määräaikaa.

Käytä palvelimen määrittämää kysymyksen aloitusaikaa ja määräaikaa. Laske vastausaika palvelimen vastaanottohetkestä ja kysymyksen aloitusajasta. Älä hyväksy asiakkaan ilmoittamaa vastausaikaa.

Vastaus hyväksytään vain, jos:

- Huone on `question`-tilassa.
- Pelaaja kuuluu kyseiseen huoneeseen.
- Pelaajan token on kelvollinen.
- Kysymysindeksi vastaa aktiivista kysymystä.
- Vastausvaihtoehdon indeksi on välillä 0–3.
- Palvelimen vastaanottohetki on ennen määräaikaa.
- Pelaaja ei ole jo vastannut kyseiseen kysymykseen.

Tallenna vastaus ja päivitä pisteet atomisesti. Vältä kaksinkertaista pisteytystä samanaikaisissa pyynnöissä.

Määrittele selkeästi, miten tasapisteet ratkaistaan. Käytä ensisijaisesti kokonaispisteitä ja sen jälkeen oikein vastattujen kysymysten määrää. Jos tasatilanne jatkuu, näytä jaettu sijoitus.

## 10. API-rakenne

Toteuta selkeästi nimetyt palvelinpuolen endpointit. Voit muuttaa nimiä projektin arkkitehtuurin perusteella.

Esimerkkejä:

- `POST /api/rooms` – luo huone.
- `POST /api/rooms/join` – liittää pelaajan PIN-koodilla.
- `GET /api/rooms/[roomId]/state` – palauttaa roolikohtaisen julkisen tilan.
- `POST /api/rooms/[roomId]/start` – aloittaa pelin.
- `POST /api/rooms/[roomId]/answer` – lähettää vastauksen.
- `POST /api/rooms/[roomId]/reveal` – siirtää kysymyksen tulosvaiheeseen.
- `POST /api/rooms/[roomId]/next` – käynnistää seuraavan kysymyksen tai päättää pelin.

Jokaisen endpointin pitää:

- Validoida syöte.
- Tarkistaa istunto ja käyttöoikeudet.
- Tarkistaa pelin nykyinen tila.
- Palauttaa johdonmukainen JSON-vastaus.
- Palauttaa järkevät HTTP-statuskoodit.
- Käsitellä virheet turvallisesti paljastamatta salaisuuksia.

Älä luota pelkästään käyttöliittymän piilottamiin painikkeisiin. Palvelin tarkistaa kaikki pelin siirtymät.

Älä luo endpointteja, joita sovellus ei käytä.

## 11. Ajastin ja reaaliaikaisuus

Ajastimen lähde on palvelimen tallentama `question_ends_at`.

Frontend näyttää jäljellä olevan ajan laskemalla erotuksen palvelimen määräaikaan. Selainajastin on vain näyttöä varten, ei vastausten hyväksymisen auktoriteetti.

Vastausten vastaanotto suljetaan palvelinpuolella määräajan jälkeen.

Kun ajastin päättyy:

- Pelaaja ei voi enää vastata.
- Juontaja voi siirtyä tulosvaiheeseen.
- Jos juontajan selain ei reagoi, sovellus ei saa hyväksyä myöhästyneitä vastauksia.
- Toteuta vähintään juontajan automaattinen tai manuaalinen siirtymä tulosvaiheeseen luotettavasti.

Vältä monimutkaista jatkuvasti käynnissä olevaa taustapalvelua. Yhden päivän projektissa riittää yksinkertainen, idempotentti mekanismi, jossa juontajan selain tai palvelinpuolen tilan tarkistus voi sulkea kysymyksen.

Kun selain yhdistyy uudelleen, sen pitää hakea palvelimelta nykyinen tila ja jatkaa oikeasta kohdasta.

## 12. QR-koodi ja liittyminen

Luo liittymiskoodi huoneen luonnin yhteydessä.

QR-koodin tulee osoittaa sovelluksen liittymisreittiin ja sisältää PIN-koodi esimerkiksi URL-parametrina:

`/join?pin=123456`

Käytä oikeaa julkista URL-osoitetta tuotannossa. Älä kovakoodaa localhost-osoitetta.

QR-koodin tulee olla riittävän suuri skannattavaksi projektorilta.

Näytä PIN-koodi QR-koodin rinnalla. Pelaaja voi liittyä myös syöttämällä PIN-koodin käsin.

PIN-koodi ei ole salainen autentikointitoken. Käyttöoikeus perustuu erillisiin satunnaisiin istuntotokeneihin.

## 13. Pelaajat ja istunnot

Pelaaja luodaan nimimerkillä ja sidotaan huoneeseen.

Luo pelaajalle kryptografisesti satunnainen istuntotoken. Palauta se pelaajan selaimeen turvallisella tavalla.

Älä käytä pelaajan UUIDä tai nimimerkkiä yksinään todisteena oikeudesta lähettää vastauksia.

Toteuta käytännöllinen istunnon säilytys, jotta sivun päivittäminen ei hävitä pelaajan pelipaikkaa.

Jos käytät HttpOnly-cookiea, suunnittele reitit ja istuntojen käsittely sen mukaisesti. Jos käytät selaimen muuta tallennustapaa, minimoi tokenin altistuminen ja varmista, ettei token päädy URL-osoitteeseen.

Estä samalla pelaajalla useiden vastausten lähettäminen samaan kysymykseen.

Pelin ei tarvitse tukea monimutkaista käyttäjätilien palautusta. Jos pelaaja menettää istuntonsa, näytä selkeä virhe ja anna mahdollisuus liittyä uudelleen turvallisesti ilman pisteiden manipulointia.

## 14. Virhetilanteet ja palautuminen

Käsittele vähintään:

- Virheellinen PIN-koodi.
- Täysi tai päättynyt pelihuone.
- Tyhjä tai liian pitkä nimimerkki.
- Kaksi samannimistä pelaajaa.
- Pelaaja päivittää sivun kesken pelin.
- Pelaaja menettää verkkoyhteyden.
- Juontaja päivittää sivun.
- Kysymys päättyy ennen vastausta.
- Pelaaja lähettää vastauksen kahdesti.
- Pelaaja yrittää vastata väärään kysymysindeksiin.
- Juontaja lähettää saman ohjauskomennon kahdesti.
- Kaksi pelaajaa vastaa täsmälleen samaan aikaan.
- Realtime-yhteys katkeaa ja palautuu.

Näytä käyttäjälle selkeä, suomenkielinen virheilmoitus. Älä näytä raakaa SQL-virhettä tai palvelimen sisäisiä tietoja.

## 15. Testit

Kirjoita Vitest-yksikkötestit ainakin seuraaville:

1. Kysymysten JSON-skeeman validointi.
2. Oikean vastauksen pisteytys.
3. Väärä vastaus tuottaa nolla pistettä.
4. Nopeampi oikea vastaus tuottaa vähintään yhtä paljon pisteitä kuin hitaampi.
5. Pisteytys ei ylitä maksimia.
6. Vastaus aikarajan jälkeen hylätään.
7. Toista vastausta samalta pelaajalta ei hyväksytä.
8. Tilakone estää virheelliset siirtymät.
9. Oikeaa vastausta ei sisälly pelaajan kysymysvastaukseen.
10. Tasapisteiden järjestäminen on deterministinen.

Jos aika sallii, lisää Playwright-testit:

- Pelaaja liittyy PIN-koodilla.
- Juontaja näkee pelaajan.
- Juontaja käynnistää kysymyksen.
- Pelaaja lähettää vastauksen.
- Tulostaulu näyttää pisteet.
- Viimeisen kysymyksen jälkeen peli päättyy.

Toteuta pisteytys ja tilakone erillisinä puhtaina funktioina mahdollisuuksien mukaan. Älä tee niiden testaamisesta riippuvaista selaimesta.

## 16. Käyttöönotto

Luo `.env.example`, jossa ovat tarvittavat ympäristömuuttujat:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` tai projektissa käytetyn nykyisen Supabase-clientin julkinen avainmuuttuja.
- Palvelinpuolen Supabase-avaimen muuttuja nykyisen suositellun käytännön mukaan.

Dokumentoi muuttujien käyttötarkoitus. Älä koskaan lisää oikeita salaisuuksia versionhallintaan.

Luo README.md, jossa kerrotaan:

1. Vaatimukset.
2. Riippuvuuksien asennus.
3. Supabase-projektin luonti.
4. SQL-migraatioiden suoritus.
5. Realtime-asetukset.
6. Ympäristömuuttujien asetus.
7. Kehityspalvelimen käynnistys.
8. Testien suoritus.
9. Tuotantojulkaisu.
10. Miten juontaja käynnistää pelin ja pelaajat liittyvät mukaan.

Sovelluksen tulee käynnistyä selkeillä komennoilla:

`npm install`

`npm run dev`

`npm run test`

Luo tarvittavat `package.json`-skriptit. Jos Playwright otetaan käyttöön, dokumentoi myös sen testikomennot.

## 17. Toteutusjärjestys: yhden päivän aikataulu

Työskentele seuraavassa järjestyksessä:

### Vaihe A – Projektin runko

- Tarkista nykyinen projektihakemisto.
- Jos projektia ei ole, luo Next.js-projekti.
- Asenna vain tarvittavat riippuvuudet.
- Luo reitit, tyylit ja peruskomponentit.
- Varmista, että projekti käynnistyy.

### Vaihe B – Staattinen käyttöliittymä

- Toteuta aloitussivu.
- Toteuta juontajan näkymä.
- Toteuta pelaajan liittymis- ja vastausnäkymä.
- Toteuta tulostaulu.
- Käytä tässä vaiheessa paikallista esimerkkidataa.
- Varmista mobiili- ja projektorikäyttö.

### Vaihe C – Pelin logiikka

- Luo kysymysten JSON ja validointi.
- Toteuta pelin tilakone.
- Toteuta pisteytys.
- Kirjoita yksikkötestit.
- Älä vielä lisää ylimääräisiä ominaisuuksia.

### Vaihe D – Supabase

- Luo SQL-migraatiot.
- Ota RLS käyttöön.
- Toteuta huoneen luonti ja liittyminen.
- Toteuta pelaajien istunnot.
- Toteuta vastausten palvelinpuolen tarkistus ja pisteytys.
- Toteuta Realtime-tilaukset.

### Vaihe E – Integrointi

- Yhdistä käyttöliittymä oikeaan backend-logiikkaan.
- Toteuta QR-koodi ja PIN-liittyminen.
- Toteuta ajastin.
- Toteuta tulokset ja seuraavan kysymyksen käynnistys.
- Lisää virheilmoitukset ja uudelleenyhdistyminen.

### Vaihe F – Testaus ja julkaisu

- Suorita lint, TypeScript-tarkistus ja yksikkötestit.
- Korjaa kaikki kriittiset virheet.
- Testaa peli vähintään kahdella erillisellä selainistunnolla.
- Testaa oikeilla puhelimilla, jos mahdollista.
- Dokumentoi käyttöönotto.
- Valmistele tuotantojulkaisu.

## 18. Työskentelyohjeet koodausagentille

Älä palauta pelkkää suunnitelmaa. Toteuta sovellus suoraan projektitiedostoihin.

Aloita tarkistamalla nykyinen hakemisto, projektin tila ja käytettävissä olevat komennot.

Sen jälkeen:

1. Tee lyhyt toteutussuunnitelma.
2. Luo ja muokkaa tiedostot.
3. Suorita komennot ja testit.
4. Korjaa löytyneet virheet.
5. Tarkista tietoturvakriittiset kohdat.
6. Päivitä README.
7. Raportoi lopuksi, mikä toimii ja mitä jäi tekemättä.

Älä kysy käyttäjältä vahvistusta jokaiselle pienelle toteutusvalinnalle. Tee järkevät oletukset ja jatka.

Jos Supabase-ympäristöä tai tunnuksia ei ole vielä saatavilla, toteuta ensin valmis sovellusrakenne ja migraatiot. Älä teeskentele, että reaaliaikainen backend on testattu ilman oikeaa ympäristöä.

Jos aikaraja uhkaa ylittyä, priorisoi tässä järjestyksessä:

1. Turvallinen huoneen luonti ja liittyminen.
2. Pelaajien vastausten vastaanotto.
3. Oikea palvelinpuolen pisteytys.
4. Reaaliaikainen pelitila.
5. Tulostaulu ja pelin päättäminen.
6. Visuaaliset efektit ja lisäviimeistely.

## 19. Hyväksymiskriteerit

Sovellus on valmis MVP, kun kaikki seuraavat toteutuvat:

- Juontaja voi luoda uuden pelihuoneen.
- Liittymiskoodi ja QR-koodi toimivat.
- Vähintään kaksi erillistä pelaajaa voi liittyä samaan huoneeseen.
- Juontaja näkee pelaajat.
- Juontaja voi aloittaa kysymyksen.
- Pelaajat näkevät kysymyksen puhelimillaan.
- Pelaaja voi lähettää yhden vastauksen kysymystä kohti.
- Oikeat ja väärät vastaukset käsitellään oikein.
- Myöhästyneet vastaukset hylätään palvelimella.
- Pisteet lasketaan palvelinpuolella.
- Tulokset ja tulostaulu päivittyvät oikein.
- Viimeisen kysymyksen jälkeen peli päättyy.
- Oikeat vastaukset eivät paljastu ennen tulosvaihetta.
- Kriittiselle logiikalle on testit.
- README sisältää käyttöönotto-ohjeet.
- Sovellus ei sisällä julkisia palvelinsalaisuuksia.
- `npm run build`, lint ja keskeiset testit onnistuvat.

Aloita nyt projektin tarkastuksesta ja toteuta MVP vaiheittain. Älä pysähdy pelkkään suunnitelmaan.

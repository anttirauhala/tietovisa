-- Tietovisa: pelaajan token-haun indeksi.
--
-- Miksi tämä migraatio on olemassa:
-- Jokainen pelaajan selain hakee pelitilan noin sekunnin välein reitiltä
-- GET /api/rooms/[roomId]/state. Palvelin tunnistaa pelaajan kyselyllä
--   select id, nickname, token_hash from public.players
--   where room_id = $1 and token_hash = $2
-- eli haku kohdistuu sarakepariin (room_id, token_hash). Ilman tätä indeksiä
-- tietokanta joutuu skannaamaan huoneen kaikki pelaajarivit jokaista kyselyä
-- kohti – 50 pelaajan pelissä se on 50 sekunnissa noin 2 500 riviä.
--
-- Yhdistelmäindeksi (room_id, token_hash) tekee hausta indeksihaun ja kattaa
-- samalla myös pelkän room_id-haun, joten erillinen players_room_idx on
-- tarpeeton ja poistetaan (se oli lisäksi päällekkäinen
-- players_room_score_idx-indeksin kanssa, joka alkaa myös room_id:llä).

create index if not exists players_room_token_idx
  on public.players (room_id, token_hash);

drop index if exists public.players_room_idx;

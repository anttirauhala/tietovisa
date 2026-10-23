-- Tietovisa: huoneiden elinkaari.
--
-- Miksi tämä migraatio on olemassa:
-- Huoneen luonti on tarkoituksellisesti avoin (ei käyttäjätunnuksia, jotta
-- pelaajat ja juontaja pääsevät aloittamaan ilman kirjautumista). Avoin
-- luonti tarkoittaa kuitenkin, että kuka tahansa sivuston löytävä voi luoda
-- huoneita, ja ilman siivousta ne jäisivät kantaan pysyvästi.
--
-- Tämä migraatio lisää:
--  1. indeksin created_at-sarakkeelle (siivouskyselyä varten)
--  2. purge_old_rooms-funktion, joka poistaa vanhentuneet huoneet
--     (pelaajat ja vastaukset poistuvat kaskadina)
--
-- Siivous kutsutaan palvelimelta huoneen luonnin yhteydessä, joten erillistä
-- ajastettua tehtävää tai taustapalvelua ei tarvita.

create index if not exists rooms_created_at_idx on public.rooms (created_at);

create or replace function public.purge_old_rooms(p_older_than_hours integer default 24)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  -- Varmistetaan, ettei vahingossa poisteta tuoreita huoneita.
  if p_older_than_hours is null or p_older_than_hours < 1 then
    return 0;
  end if;

  delete from public.rooms
  where created_at < now() - make_interval(hours => p_older_than_hours);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_old_rooms(integer) from public, anon, authenticated;
grant execute on function public.purge_old_rooms(integer) to service_role;

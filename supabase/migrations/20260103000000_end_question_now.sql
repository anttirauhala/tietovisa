-- Tietovisa: kysymyksen päättäminen kesken määräajan.
--
-- Miksi tämä migraatio on olemassa:
-- Juontajalla ei ollut mitään keinoa keskeyttää käynnissä olevaa kysymystä.
-- reveal_question palauttaa too_early, kunnes question_ends_at on kulunut,
-- joten kysymys kesti aina täydet 15–25 sekuntia. Jos pikkujouluissa tulee
-- keskeytys (puheenvuoro, aikataulu, porukka on valmis), juontajan piti vain
-- odottaa.
--
-- Ratkaisu: siirretään kysymyksen määräaika palvelimen nykyhetkeen. Tämän
-- jälkeen tavallinen tulosvaiheen siirtymä (reveal_question) menee läpi,
-- koska määräaika on kulunut. Vastaukset, jotka saapuvat tämän jälkeen,
-- hylätään edelleen myöhäisinä – määräaika on edelleen palvelimen kello.
--
-- Tilakone säilyy ennallaan: question → question_result tapahtuu edelleen
-- reveal_question-funktiossa, tämä funktio vain lyhentää kysymystä.

create or replace function public.end_question_now(
  p_room_id uuid,
  p_host_token_hash text,
  p_server_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;

  if not found then
    return jsonb_build_object('status', 'room_not_found');
  end if;

  if v_room.host_token_hash <> p_host_token_hash then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if v_room.status <> 'question' then
    return jsonb_build_object('status', 'invalid_state');
  end if;

  -- Idempotentti: jos määräaika on jo mennyt, ei tehdä mitään.
  if v_room.question_ends_at is null or v_room.question_ends_at <= p_server_now then
    return jsonb_build_object('status', 'ok', 'endsAt', v_room.question_ends_at);
  end if;

  update public.rooms
  set question_ends_at = p_server_now
  where id = p_room_id;

  return jsonb_build_object('status', 'ok', 'endsAt', p_server_now);
end;
$$;

revoke all on function public.end_question_now(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.end_question_now(uuid, text, timestamptz) to service_role;

-- Tietovisa: palvelinpuolen RPC-funktiot.
-- Kaikki tilasiirtymät ja pisteytys tapahtuvat näissä funktioissa transaktiona,
-- jotta kilpailevat pyynnöt eivät voi ohittaa kysymyksiä tai palkita pelaajaa kahdesti.
--
-- HUOM: EXECUTE-oikeus on poistettu rooleilta public/anon/authenticated.
-- Funktioita voi kutsua vain palvelinpuolen service-avaimella.

-- ---------------------------------------------------------------------------
-- Huoneen luonti. Palvelin arpoo PIN-koodin ja yrittää uudelleen, jos se on varattu.
-- ---------------------------------------------------------------------------
create or replace function public.create_room(p_pin text, p_host_token_hash text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_room_id uuid;
begin
  insert into public.rooms (pin, host_token_hash)
  values (p_pin, p_host_token_hash)
  returning id into v_room_id;

  return v_room_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pelaajan liittyminen huoneeseen PIN-koodilla.
-- ---------------------------------------------------------------------------
create or replace function public.join_room(
  p_pin text,
  p_nickname text,
  p_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_max_players constant integer := 200;
  v_room public.rooms;
  v_player_id uuid;
  v_player_count integer;
begin
  select * into v_room from public.rooms where pin = p_pin for update;

  if not found then
    return jsonb_build_object('status', 'room_not_found');
  end if;

  if v_room.status <> 'lobby' then
    return jsonb_build_object('status', 'already_started');
  end if;

  select count(*) into v_player_count from public.players where room_id = v_room.id;

  if v_player_count >= v_max_players then
    return jsonb_build_object('status', 'room_full');
  end if;

  if exists (
    select 1 from public.players
    where room_id = v_room.id and lower(btrim(nickname)) = lower(btrim(p_nickname))
  ) then
    return jsonb_build_object('status', 'nickname_taken');
  end if;

  insert into public.players (room_id, nickname, token_hash)
  values (v_room.id, btrim(p_nickname), p_token_hash)
  returning id into v_player_id;

  return jsonb_build_object(
    'status', 'ok',
    'playerId', v_player_id,
    'roomId', v_room.id,
    'nickname', btrim(p_nickname)
  );
exception
  when unique_violation then
    -- Nimimerkki ehti varata kilpailevassa pyynnössä.
    return jsonb_build_object('status', 'nickname_taken');
end;
$$;

-- ---------------------------------------------------------------------------
-- Kysymyksen käynnistys: lobby -> question tai leaderboard -> question.
-- ---------------------------------------------------------------------------
create or replace function public.start_question(
  p_room_id uuid,
  p_host_token_hash text,
  p_question_index integer,
  p_started_at timestamptz,
  p_ends_at timestamptz
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

  -- Idempotenssi: sama komento uudelleen ei siirrä peliä eteenpäin.
  if v_room.status = 'question' and v_room.current_question_index = p_question_index then
    return jsonb_build_object(
      'status', 'ok',
      'questionIndex', v_room.current_question_index,
      'startedAt', v_room.question_started_at,
      'endsAt', v_room.question_ends_at
    );
  end if;

  if v_room.status = 'lobby' then
    if p_question_index <> 0 then
      return jsonb_build_object('status', 'invalid_state');
    end if;
  elsif v_room.status = 'leaderboard' then
    if p_question_index <> v_room.current_question_index + 1 then
      return jsonb_build_object('status', 'invalid_state');
    end if;
  else
    return jsonb_build_object('status', 'invalid_state');
  end if;

  update public.rooms
  set
    status = 'question',
    current_question_index = p_question_index,
    question_started_at = p_started_at,
    question_ends_at = p_ends_at
  where id = p_room_id;

  return jsonb_build_object(
    'status', 'ok',
    'questionIndex', p_question_index,
    'startedAt', p_started_at,
    'endsAt', p_ends_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- question -> question_result. Vaatii että määräaika on kulunut (palvelimen kello).
-- ---------------------------------------------------------------------------
create or replace function public.reveal_question(
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

  if v_room.status in ('question_result', 'leaderboard', 'finished') then
    return jsonb_build_object('status', 'ok');
  end if;

  if v_room.status <> 'question' then
    return jsonb_build_object('status', 'invalid_state');
  end if;

  if v_room.question_ends_at is not null and p_server_now < v_room.question_ends_at then
    return jsonb_build_object('status', 'too_early', 'endsAt', v_room.question_ends_at);
  end if;

  update public.rooms set status = 'question_result' where id = p_room_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- question_result -> leaderboard.
-- ---------------------------------------------------------------------------
create or replace function public.show_leaderboard(
  p_room_id uuid,
  p_host_token_hash text
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

  if v_room.status in ('leaderboard', 'finished') then
    return jsonb_build_object('status', 'ok');
  end if;

  if v_room.status <> 'question_result' then
    return jsonb_build_object('status', 'invalid_state');
  end if;

  update public.rooms set status = 'leaderboard' where id = p_room_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- leaderboard -> finished.
-- ---------------------------------------------------------------------------
create or replace function public.finish_room(
  p_room_id uuid,
  p_host_token_hash text
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

  if v_room.status = 'finished' then
    return jsonb_build_object('status', 'ok');
  end if;

  if v_room.status <> 'leaderboard' then
    return jsonb_build_object('status', 'invalid_state');
  end if;

  update public.rooms
  set status = 'finished', question_started_at = null, question_ends_at = null
  where id = p_room_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Vastauksen tallennus ja pisteytys atomisesti.
-- is_correct / points_awarded / response_time_ms on laskettu palvelimella,
-- eikä niitä koskaan oteta vastaan selaimesta.
-- ---------------------------------------------------------------------------
create or replace function public.submit_answer(
  p_room_id uuid,
  p_player_id uuid,
  p_question_index integer,
  p_answer_index integer,
  p_is_correct boolean,
  p_points_awarded integer,
  p_response_time_ms integer,
  p_server_now timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms;
  v_player public.players;
  v_answer_id uuid;
  v_points integer;
begin
  if p_answer_index is null or p_answer_index < 0 or p_answer_index > 3 then
    return jsonb_build_object('status', 'invalid_answer_index');
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;

  if not found then
    return jsonb_build_object('status', 'room_not_found');
  end if;

  if v_room.status <> 'question' then
    return jsonb_build_object('status', 'closed');
  end if;

  if v_room.current_question_index <> p_question_index then
    return jsonb_build_object(
      'status', 'wrong_question',
      'activeQuestionIndex', v_room.current_question_index
    );
  end if;

  if v_room.question_started_at is null
     or v_room.question_ends_at is null
     or p_server_now < v_room.question_started_at
     or p_server_now > v_room.question_ends_at then
    return jsonb_build_object('status', 'late');
  end if;

  select * into v_player
  from public.players
  where id = p_player_id and room_id = p_room_id
  for update;

  if not found then
    return jsonb_build_object('status', 'player_not_found');
  end if;

  v_points := case
    when coalesce(p_is_correct, false) then greatest(coalesce(p_points_awarded, 0), 0)
    else 0
  end;

  insert into public.answers (
    room_id,
    player_id,
    question_index,
    answer_index,
    is_correct,
    response_time_ms,
    points_awarded,
    submitted_at
  )
  values (
    p_room_id,
    p_player_id,
    p_question_index,
    p_answer_index,
    coalesce(p_is_correct, false),
    greatest(coalesce(p_response_time_ms, 0), 0),
    v_points,
    p_server_now
  )
  on conflict (player_id, question_index) do nothing
  returning id into v_answer_id;

  if v_answer_id is null then
    return jsonb_build_object('status', 'already_answered');
  end if;

  update public.players
  set
    score = score + v_points,
    correct_count = correct_count + case when coalesce(p_is_correct, false) then 1 else 0 end,
    last_seen_at = p_server_now
  where id = p_player_id;

  return jsonb_build_object(
    'status', 'ok',
    'answerId', v_answer_id,
    'isCorrect', coalesce(p_is_correct, false),
    'pointsAwarded', v_points,
    'responseTimeMs', greatest(coalesce(p_response_time_ms, 0), 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Julkinen tilannekuva. Palauttaa vain julkisia kenttiä (ei tokeneita,
-- ei oikeita vastauksia). Kutsutaan ainoastaan palvelimelta service-avaimella.
-- ---------------------------------------------------------------------------
create or replace function public.room_snapshot(p_room_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'room', jsonb_build_object(
      'id', r.id,
      'pin', r.pin,
      'status', r.status,
      'currentQuestionIndex', r.current_question_index,
      'questionStartedAt', r.question_started_at,
      'questionEndsAt', r.question_ends_at,
      'playerCount', (
        select count(*) from public.players p where p.room_id = r.id
      )
    ),
    'players', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'nickname', p.nickname,
            'score', p.score,
            'correctCount', p.correct_count,
            'joinedAt', p.joined_at
          )
          order by p.score desc, p.correct_count desc, p.joined_at asc, p.id asc
        )
        from public.players p
        where p.room_id = r.id
      ),
      '[]'::jsonb
    ),
    'answers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'playerId', a.player_id,
            'questionIndex', a.question_index,
            'answerIndex', a.answer_index,
            'isCorrect', a.is_correct,
            'pointsAwarded', a.points_awarded,
            'responseTimeMs', a.response_time_ms,
            'submittedAt', a.submitted_at
          )
        )
        from public.answers a
        where a.room_id = r.id and a.question_index = r.current_question_index
      ),
      '[]'::jsonb
    )
  )
  from public.rooms r
  where r.id = p_room_id;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet: vain palvelinpuolen service-avain saa kutsua funktioita.
-- ---------------------------------------------------------------------------
revoke all on function public.create_room(text, text) from public, anon, authenticated;
revoke all on function public.join_room(text, text, text) from public, anon, authenticated;
revoke all on function public.start_question(uuid, text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.reveal_question(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.show_leaderboard(uuid, text) from public, anon, authenticated;
revoke all on function public.finish_room(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_answer(
  uuid, uuid, integer, integer, boolean, integer, integer, timestamptz
) from public, anon, authenticated;
revoke all on function public.room_snapshot(uuid) from public, anon, authenticated;

grant execute on function public.create_room(text, text) to service_role;
grant execute on function public.join_room(text, text, text) to service_role;
grant execute on function public.start_question(uuid, text, integer, timestamptz, timestamptz)
  to service_role;
grant execute on function public.reveal_question(uuid, text, timestamptz) to service_role;
grant execute on function public.show_leaderboard(uuid, text) to service_role;
grant execute on function public.finish_room(uuid, text) to service_role;
grant execute on function public.submit_answer(
  uuid, uuid, integer, integer, boolean, integer, integer, timestamptz
) to service_role;
grant execute on function public.room_snapshot(uuid) to service_role;

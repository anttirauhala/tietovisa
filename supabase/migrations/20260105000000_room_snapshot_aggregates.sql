-- Tietovisa: tilannekuvan kevennys (vaihe 2a).
--
-- Miksi tämä migraatio on olemassa:
-- room_snapshot palautti aiemmin jokaisen kuluvan kysymyksen vastausrivin
-- (playerId, questionIndex, answerIndex, isCorrect, pointsAwarded,
-- responseTimeMs, submittedAt). Selain kysyy tilan noin sekunnin välein, joten
-- 30 pelaajan huoneessa se tarkoitti noin 30 x 7 kenttää jokaista kyselyä
-- kohti – vaikka palvelin tarvitsee riveistä vain kaksi asiaa: vastausten
-- määrän ja jakauman.
--
-- Tämä migraatio korvaa raakarivit aggregaateilla:
--   answerCount  – kuinka moni on vastannut kuluvaan kysymykseen
--   distribution – vastausten määrä vaihtoehdoittain (aina 4 alkiota)
--   myAnswer     – kysyvän pelaajan oma vastaus (tai null)
--
-- myAnswer mahdollistaa sen, että palvelin näkee pelaajan oman vastauksen
-- (onko jo vastannut, mikä vaihtoehto, tulivatko pisteet) yhdellä RPC-kutsulla
-- ilman että kaikki vastausrivit siirretään tietokannasta palvelimelle.
--
-- Tietoturva säilyy ennallaan: funktio palauttaa edelleen vain julkisia
-- kenttiä eikä koskaan oikeaa vastausta eikä tokeneita.
--
-- HUOM: vanha yksiparametrinen allekirjoitus poistetaan, koska muuten
-- kutsu room_snapshot(uuid) olisi kahden funktion kesken monitulkintainen.
-- Uusi funktio toimii myös yhdellä parametrilla (p_player_id on valinnainen).

drop function if exists public.room_snapshot(uuid);

create or replace function public.room_snapshot(
  p_room_id uuid,
  p_player_id uuid default null
)
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
    -- Kuinka moni on vastannut kuluvaan kysymykseen.
    'answerCount', (
      select count(*)
      from public.answers a
      where a.room_id = r.id and a.question_index = r.current_question_index
    ),
    -- Vastausten määrä vaihtoehdoittain. generate_series takaa, että taulukossa
    -- on aina täsmälleen neljä alkiota myös silloin, kun jokin vaihtoehto on
    -- saanut nolla vastausta.
    'distribution', (
      select jsonb_agg(
        (
          select count(*)
          from public.answers a
          where a.room_id = r.id
            and a.question_index = r.current_question_index
            and a.answer_index = slots.slot
        )
        order by slots.slot
      )
      from generate_series(0, 3) as slots(slot)
    ),
    -- Kysyvän pelaajan oma vastaus kuluvaan kysymykseen.
    'myAnswer', case
      when p_player_id is null then null
      else (
        select jsonb_build_object(
          'answerIndex', a.answer_index,
          'isCorrect', a.is_correct,
          'pointsAwarded', a.points_awarded,
          'responseTimeMs', a.response_time_ms
        )
        from public.answers a
        where a.room_id = r.id
          and a.player_id = p_player_id
          and a.question_index = r.current_question_index
      )
    end
  )
  from public.rooms r
  where r.id = p_room_id;
$$;

revoke all on function public.room_snapshot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.room_snapshot(uuid, uuid) to service_role;

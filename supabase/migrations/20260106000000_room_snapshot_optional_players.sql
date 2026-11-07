-- Tietovisa: tilannekuvan kevennys (vaihe 2c)
--
-- Miksi tämä migraatio on olemassa:
-- Tilakysely toistuu pelaajalla noin kerran sekunnissa koko pelin ajan, ja
-- jokainen kysely hakee Supabasesta huoneen tilannekuvan. Rungon selvästi
-- suurin osa oli pelaajalista (jsonb_agg kaikista pelaajista), vaikka pelaaja
-- näkee listan vain tulostaulussa ja lopputilanteessa. Odotushuoneessa ja
-- kysymyksen aikana pelaaja tarvitsee vain oman rivinsä ja sijoituksensa.
--
-- 70 pelaajan huoneessa pelaajalista on noin 8 kt jokaista kyselyä kohti.
-- 15 minuutin peli tuotti noin 330 MB egressiä Supabasesta, mistä listat
-- olivat yli 80 %. Supabasen ilmaisen tason egress on 5 GB kuukaudessa,
-- joten tämä on halvin yksittäinen kevennys.
--
-- Mitä muuttui:
--   p_include_players  true = aina, false = ei koskaan, null (oletus) =
--                      automaattisesti vain vaiheissa, joissa lista näytetään
--                      (leaderboard ja finished)
--   myPlayer           kysyjän oma rivi ja sijoitus SQL:ssä laskettuna, jotta
--                      pelaajanäkymä ei tarvitse koko listaa sijoitukseensa.
--                      rank() säilyttää jaetut sijoitukset samalla säännöllä
--                      kuin palvelimen rankPlayers (pisteet, oikeat vastaukset).
--
-- Tietoturva säilyy ennallaan: funktio palauttaa edelleen vain julkisia
-- kenttiä eikä koskaan oikeaa vastausta eikä tokeneita. Parametrit vaikuttavat
-- vain siihen, mitä palautetaan - ei siihen, kenellä on oikeus kutsua.

drop function if exists public.room_snapshot(uuid, uuid);

create or replace function public.room_snapshot(
  p_room_id uuid,
  p_player_id uuid default null,
  p_include_players boolean default null
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
    -- Pelaajalista vain, kun se näytetään jollekin: tulostaulussa ja
    -- lopputilanteessa aina, muuten vain jos kutsuja pyytää sen erikseen
    -- (juontaja tarvitsee listan odotushuoneessa).
    'players', case
      when coalesce(p_include_players, r.status in ('leaderboard', 'finished')) then (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'nickname', p.nickname,
              'score', p.score,
              'correctCount', p.correct_count,
              'joinedAt', p.joined_at
            )
            order by p.score desc, p.correct_count desc, p.joined_at asc, p.id asc
          ),
          '[]'::jsonb
        )
        from public.players p
        where p.room_id = r.id
      )
      else '[]'::jsonb
    end,
    -- Kysyjän oma rivi ja sijoitus. Sijoitus lasketaan samalla säännöllä kuin
    -- palvelimen rankPlayers: täsmälleen samat pisteet ja oikeat vastaukset
    -- saaneet pelaajat saavat jaetun sijoituksen (rank = 1, 2, 2, 4).
    'myPlayer', case
      when p_player_id is null then null
      else (
        select jsonb_build_object(
          'id', ranked.id,
          'nickname', ranked.nickname,
          'score', ranked.score,
          'correctCount', ranked.correct_count,
          'rank', ranked.rank
        )
        from (
          select
            p.id,
            p.nickname,
            p.score,
            p.correct_count,
            rank() over (order by p.score desc, p.correct_count desc) as rank
          from public.players p
          where p.room_id = r.id
        ) as ranked
        where ranked.id = p_player_id
      )
    end,
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

revoke all on function public.room_snapshot(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.room_snapshot(uuid, uuid, boolean) to service_role;

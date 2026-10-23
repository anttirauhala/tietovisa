"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Trophy, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerTile } from "@/components/AnswerTile";
import { Confetti } from "@/components/Confetti";
import { LeaderboardList } from "@/components/LeaderboardList";
import { TimerBar } from "@/components/TimerBar";
import { Button, Card, Notice, Spinner } from "@/components/ui";
import { useCountdown } from "@/hooks/useCountdown";
import { useRoomState } from "@/hooks/useRoomState";
import { usePlayerSession } from "@/hooks/useStoredValue";
import { apiRequest } from "@/lib/api/client";
import { isRevealedQuestion, type PlayerState } from "@/lib/game/types";
import { clearPlayerSession } from "@/lib/session";

/**
 * Pelaajan pelinäkymä. Suunniteltu yhden käden käyttöön puhelimella:
 * neljä suurta vastauspainiketta, ei vaakasuuntaista vieritystä ja
 * selkeä vahvistus siitä, että vastaus on tallennettu.
 *
 * Oikea vastaus näytetään vasta, kun kysymys on päättynyt.
 */
export function PlayerRoom({ playerId }: { playerId: string }) {
  const session = usePlayerSession();

  if (session === null || session.playerId !== playerId) {
    return (
      <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <Notice tone="error">
          Tämän laitteen pelaajaistuntoa ei löytynyt. Jos päivität sivun kesken pelin, istunto
          säilyy samassa selaimessa – muussa tapauksessa liity uudelleen.
        </Notice>
        <Link href="/join">
          <Button>Liity peliin uudelleen</Button>
        </Link>
      </Card>
    );
  }

  return <PlayerRoomInner session={session} />;
}

function PlayerRoomInner({ session }: { session: { roomId: string; playerToken: string } }) {
  const router = useRouter();
  const { state, error, errorCode, isLoading, clockOffsetMs, refresh } = useRoomState<PlayerState>({
    roomId: session.roomId,
    token: session.playerToken,
    role: "player",
    intervalMs: 1100,
  });

  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lastQuestionIndexRef = useRef<number | null>(null);

  const room = state?.room ?? null;
  const countdown = useCountdown(
    room?.questionStartedAt ?? null,
    room?.questionEndsAt ?? null,
    clockOffsetMs,
  );

  // Uusi kysymys: tyhjennetään edellisen kysymyksen paikallinen tila.
  useEffect(() => {
    const index = room?.currentQuestionIndex ?? null;
    if (index !== lastQuestionIndexRef.current) {
      lastQuestionIndexRef.current = index;
      setPendingAnswer(null);
      setSubmitError(null);
    }
  }, [room?.currentQuestionIndex]);

  const submitAnswer = useCallback(
    async (answerIndex: number) => {
      if (!state) {
        return;
      }
      if (state.me.hasAnsweredCurrent || pendingAnswer !== null) {
        return;
      }

      setPendingAnswer(answerIndex);
      setSubmitError(null);

      const result = await apiRequest(`/api/rooms/${session.roomId}/answer`, {
        method: "POST",
        json: { questionIndex: state.room.currentQuestionIndex, answerIndex },
        playerToken: session.playerToken,
      });

      if (result.ok) {
        await refresh();
        return;
      }

      setPendingAnswer(null);

      if (result.code === "conflict" || result.code === "invalid_state") {
        // Vastaus ehti jo perille tai kysymys sulkeutui – päivitetään tila.
        await refresh();
        return;
      }

      if (result.code === "invalid_token") {
        // Istunto on vanhentunut tai pelaaja on poistettu – ohjataan liittymään.
        clearPlayerSession();
        router.replace("/join");
        return;
      }

      setSubmitError(result.message);
    },
    [pendingAnswer, refresh, router, session.playerToken, session.roomId, state],
  );

  if (errorCode === "invalid_token") {
    return (
      <Card className="flex flex-col items-center gap-4 text-center">
        <Notice tone="error">
          Istuntosi ei ole enää voimassa. Liity peliin uudelleen samalla nimimerkillä.
        </Notice>
        <Link href="/join">
          <Button>Liity uudelleen</Button>
        </Link>
      </Card>
    );
  }

  if (!state || !room) {
    if (isLoading) {
      return <Spinner label="Ladataan peliä…" />;
    }
    return (
      <Notice tone="error">
        {error ?? "Peliä ei löytynyt."}
        <div className="mt-3">
          <Link href="/join">
            <Button variant="secondary">Liity uudelleen</Button>
          </Link>
        </div>
      </Notice>
    );
  }

  const hasAnswered = state.me.hasAnsweredCurrent || pendingAnswer !== null;
  const selectedIndex = state.me.hasAnsweredCurrent ? state.me.myAnswerIndex : pendingAnswer;
  const question = state.question;
  const revealed = question && isRevealedQuestion(question) ? question : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-safe pb-safe">
      <header className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-bold">{state.me.nickname}</span>
        <span className="tv-chip px-3 py-1 font-semibold tabular-nums">
          {state.me.score.toLocaleString("fi-FI")} p
        </span>
      </header>

      {error ? (
        <Notice tone="error">
          <span className="flex items-center gap-2">
            <WifiOff className="size-4" />
            Yhteys katkesi – yritetään uudelleen.
          </span>
        </Notice>
      ) : null}

      {room.status === "lobby" ? (
        <Card className="flex flex-col items-center gap-3 text-center">
          <span className="animate-pulse-soft text-5xl">🎄</span>
          <h1 className="text-3xl font-black">Odotetaan juontajaa</h1>
          <p className="text-white/75">
            Olet mukana pelissä nimimerkillä <strong>{state.me.nickname}</strong>.
          </p>
          <p className="tv-chip px-4 py-2 text-lg font-bold tabular-nums">
            Pelaajia paikalla: {room.playerCount}
          </p>
          <p className="text-sm text-white/60">
            Pidä tämä sivu auki – kysymykset alkavat, kun juontaja käynnistää pelin.
          </p>
        </Card>
      ) : null}

      {room.status === "question" && question ? (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-white/75">
            <span className="tabular-nums">
              Kysymys {question.index + 1}/{question.total}
            </span>
            <span className="tv-chip px-3 py-1">{question.category}</span>
          </div>

          <TimerBar seconds={countdown.seconds} ratio={countdown.ratio} label="Aikaa" />

          <h1 className="text-xl leading-snug font-black sm:text-2xl">{question.question}</h1>

          {hasAnswered ? (
            <div className="flex flex-1 flex-col justify-center gap-4">
              <Notice tone="success">
                <span className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="size-5" />
                  Vastaus tallennettu!
                </span>
                <span className="mt-1 block text-white/85">
                  Valintasi: {selectedIndex !== null ? question.answers[selectedIndex] : "—"}
                </span>
              </Notice>

              <div className="flex flex-col gap-2">
                {question.answers.map((answer, index) => (
                  <AnswerTile
                    key={index}
                    index={index}
                    text={answer}
                    size="md"
                    state={index === selectedIndex ? "selected" : "muted"}
                  />
                ))}
              </div>

              <p className="text-center text-sm text-white/70">
                Odotetaan muita pelaajia ja oikeaa vastausta…
              </p>
            </div>
          ) : (
            <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3">
              {question.answers.map((answer, index) => (
                <AnswerTile
                  key={index}
                  index={index}
                  text={answer}
                  size="lg"
                  disabled={pendingAnswer !== null}
                  onClick={() => void submitAnswer(index)}
                />
              ))}
            </div>
          )}

          {pendingAnswer !== null && !state.me.hasAnsweredCurrent ? (
            <p className="flex items-center justify-center gap-2 text-sm text-white/75">
              <Loader2 className="size-4 animate-spin" />
              Lähetetään vastausta…
            </p>
          ) : null}

          {submitError ? <Notice tone="error">{submitError}</Notice> : null}
        </div>
      ) : null}

      {room.status === "question_result" && revealed ? (
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-lg leading-snug font-black sm:text-xl">{revealed.question}</h1>

          <Notice tone={state.me.currentIsCorrect ? "success" : "error"} className="text-base">
            {state.me.currentIsCorrect
              ? `Oikein! +${(state.me.currentPointsAwarded ?? 0).toLocaleString("fi-FI")} pistettä`
              : state.me.hasAnsweredCurrent
                ? "Väärä vastaus – 0 pistettä"
                : "Et ehtinyt vastata – 0 pistettä"}
            <span className="mt-1 block text-white/85">
              Oikea vastaus: {revealed.answers[revealed.correctAnswerIndex]}
            </span>
          </Notice>

          <div className="grid grid-cols-1 gap-2">
            {revealed.answers.map((answer, index) => {
              const isCorrect = index === revealed.correctAnswerIndex;
              const isOwn = index === state.me.myAnswerIndex;
              return (
                <AnswerTile
                  key={index}
                  index={index}
                  text={answer}
                  size="md"
                  state={isCorrect ? "correct" : isOwn ? "wrong" : "muted"}
                  trailing={
                    isOwn ? (
                      <span className="shrink-0 rounded-full bg-black/25 px-2 py-1 text-xs font-bold">
                        oma
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </div>

          <p className="text-center text-lg font-bold tabular-nums">
            Yhteispisteet {state.me.score.toLocaleString("fi-FI")}
          </p>
        </div>
      ) : null}

      {room.status === "leaderboard" ? (
        <div className="flex flex-1 flex-col gap-4">
          <Card className="text-center">
            <p className="text-sm font-semibold tracking-widest text-white/70 uppercase">
              Sijoituksesi
            </p>
            <p className="text-5xl font-black tabular-nums">{state.me.rank}.</p>
            <p className="text-lg font-bold tabular-nums text-white/85">
              {state.me.score.toLocaleString("fi-FI")} pistettä
            </p>
            <p className="mt-1 text-sm text-white/60">{state.me.correctCount} oikeaa vastausta</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-black">Viisi parasta</h2>
            <LeaderboardList
              players={state.players}
              limit={5}
              highlightPlayerId={state.me.id}
              size="sm"
            />
          </Card>

          <p className="text-center text-sm text-white/70">
            Seuraava kysymys alkaa, kun juontaja jatkaa peliä.
          </p>
        </div>
      ) : null}

      {room.status === "finished" ? (
        <div className="flex flex-1 flex-col gap-4">
          {state.me.rank === 1 ? <Confetti /> : null}

          <Card className="flex flex-col items-center gap-2 text-center">
            <Trophy className="size-10 text-amber-200" />
            <p className="text-sm font-semibold tracking-widest text-white/70 uppercase">
              Lopullinen sijoitus
            </p>
            <p className="text-6xl font-black tabular-nums">{state.me.rank}.</p>
            <p className="text-2xl font-bold tabular-nums">
              {state.me.score.toLocaleString("fi-FI")} pistettä
            </p>
            <p className="text-sm text-white/70">
              {state.me.correctCount} oikeaa vastausta / {room.questionCount} kysymystä
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-black">Lopullinen tulostaulu</h2>
            <LeaderboardList players={state.players} highlightPlayerId={state.me.id} size="sm" />
          </Card>

          <Link href="/" className="text-center text-sm text-white/70 underline">
            Takaisin etusivulle
          </Link>
        </div>
      ) : null}
    </div>
  );
}

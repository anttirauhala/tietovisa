"use client";

import { ArrowRight, Flag, ListOrdered, Sparkles, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnswerTile } from "@/components/AnswerTile";
import { Confetti } from "@/components/Confetti";
import { HostLobby } from "@/components/host/HostLobby";
import { LeaderboardList } from "@/components/LeaderboardList";
import { TimerBar } from "@/components/TimerBar";
import { Button, Card, Notice, Spinner } from "@/components/ui";
import { useCountdown } from "@/hooks/useCountdown";
import { useRoomState } from "@/hooks/useRoomState";
import { apiRequest } from "@/lib/api/client";
import { ANSWER_SLOTS } from "@/lib/game/answerSlots";
import type { HostState, PublicQuestion, RevealedQuestion } from "@/lib/game/types";
import { isRevealedQuestion } from "@/lib/game/types";

type HostAction = "start" | "reveal" | "leaderboard" | "next";

/**
 * Juontajan pelinäkymä. Pelin etenemistä hallitaan palvelimella: jokainen
 * painike lähettää komennon palvelimelle, joka tarkistaa nykyisen tilan ja
 * sallitun siirtymän.
 *
 * Kun kysymyksen määräaika päättyy, juontajan selain siirtää kysymyksen
 * automaattisesti tulosvaiheeseen. Sama onnistuu myös käsin painikkeesta,
 * joten peli ei jää jumiin, vaikka selain ehtisi nukkua.
 */
export function HostRoom({ roomId, hostToken }: { roomId: string; hostToken: string | null }) {
  const { state, error, isLoading, clockOffsetMs, refresh } = useRoomState<HostState>({
    roomId,
    token: hostToken,
    role: "host",
    intervalMs: 900,
  });

  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const revealedIndexRef = useRef<number | null>(null);

  const room = state?.room ?? null;
  const countdown = useCountdown(
    room?.questionStartedAt ?? null,
    room?.questionEndsAt ?? null,
    clockOffsetMs,
  );

  const runCommand = useCallback(
    async (action: HostAction) => {
      if (!hostToken) {
        return;
      }
      setBusy(true);
      setCommandError(null);

      const result = await apiRequest(`/api/rooms/${roomId}/${action}`, {
        method: "POST",
        json: {},
        hostToken,
      });

      if (!result.ok && result.code !== "aborted") {
        setCommandError(result.message);
      }

      await refresh();
      setBusy(false);
    },
    [hostToken, refresh, roomId],
  );

  // Automaattinen siirtymä tulosvaiheeseen määräajan jälkeen.
  useEffect(() => {
    if (!state || !hostToken) {
      return;
    }

    const { status, currentQuestionIndex, questionEndsAt } = state.room;

    if (status !== "question" || !questionEndsAt) {
      return;
    }
    if (revealedIndexRef.current === currentQuestionIndex) {
      return;
    }

    const endsAtMs = Date.parse(questionEndsAt);
    if (Number.isNaN(endsAtMs)) {
      return;
    }

    const delay = Math.max(0, endsAtMs - (Date.now() + clockOffsetMs)) + 400;

    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await apiRequest(`/api/rooms/${roomId}/reveal`, {
          method: "POST",
          json: {},
          hostToken,
        });

        if (result.ok || result.code === "invalid_state") {
          revealedIndexRef.current = currentQuestionIndex;
          await refresh();
        }
      })();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [clockOffsetMs, hostToken, refresh, roomId, state]);

  const primaryAction = useMemo<HostAction | null>(() => {
    if (!room) {
      return null;
    }
    switch (room.status) {
      case "lobby":
        return room.playerCount > 0 ? "start" : null;
      case "question":
        return countdown.isFinished ? "reveal" : null;
      case "question_result":
        return "leaderboard";
      case "leaderboard":
        return "next";
      default:
        return null;
    }
  }, [countdown.isFinished, room]);

  // Näppäimistöohjaus vaatii tarkoituksellisen yhdistelmän (Ctrl/Cmd + Enter),
  // jotta tavallinen näppäinpainallus ei käynnistä peliä vahingossa.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
        return;
      }
      if (!primaryAction || busy) {
        return;
      }
      event.preventDefault();
      void runCommand(primaryAction);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, primaryAction, runCommand]);

  if (!hostToken) {
    return (
      <Notice tone="error">
        Juontajan istunto puuttuu tästä selaimesta. Luo uusi peli etusivun kautta.
      </Notice>
    );
  }

  if (!state || !room) {
    if (isLoading) {
      return <Spinner label="Ladataan pelihuonetta…" />;
    }
    return (
      <Notice tone="error">
        {error ?? "Pelihuonetta ei löytynyt."} Tarkista, että käytät samaa selainta, jolla loit
        pelin.
      </Notice>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-safe pb-safe sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-white/60 uppercase">
            Juontajan näkymä
          </p>
          <h1 className="text-xl font-black sm:text-2xl">Pikkujouluvisa</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="tv-chip px-3 py-1 font-semibold tabular-nums">PIN {room.pin}</span>
          {room.status !== "lobby" ? (
            <span className="tv-chip px-3 py-1 font-semibold tabular-nums">
              Kysymys {room.currentQuestionIndex + 1}/{room.questionCount}
            </span>
          ) : null}
          <span className="tv-chip px-3 py-1 font-semibold tabular-nums">
            Pelaajia {room.playerCount}
          </span>
        </div>
      </header>

      {error ? (
        <Notice tone="error">
          <span className="flex items-center gap-2">
            <WifiOff className="size-4" />
            Yhteys palvelimeen katkesi – yritetään uudelleen automaattisesti.
          </span>
        </Notice>
      ) : null}

      {room.status === "lobby" ? (
        <HostLobby
          pin={room.pin}
          players={state.players}
          playerCount={room.playerCount}
          onStart={() => void runCommand("start")}
          busy={busy}
          error={commandError}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {commandError ? <Notice tone="error">{commandError}</Notice> : null}

          {room.status === "question" && state.question ? (
            <QuestionStage
              question={state.question}
              seconds={countdown.seconds}
              ratio={countdown.ratio}
              answerCount={state.answerCount}
              playerCount={room.playerCount}
              actionLabel={
                countdown.isFinished ? "Näytä oikea vastaus" : "Odota ajan loppumista"
              }
              actionDisabled={busy || !countdown.isFinished}
              onAction={() => void runCommand("reveal")}
            />
          ) : null}

          {room.status === "question_result" && state.question ? (
            <ResultStage
              question={state.question}
              answerCount={state.answerCount}
              playerCount={room.playerCount}
              busy={busy}
              onAction={() => void runCommand("leaderboard")}
            />
          ) : null}

          {room.status === "leaderboard" ? (
            <LeaderboardStage
              players={state.players}
              questionIndex={room.currentQuestionIndex}
              questionCount={room.questionCount}
              busy={busy}
              onNext={() => void runCommand("next")}
            />
          ) : null}

          {room.status === "finished" ? <FinishedStage players={state.players} /> : null}
        </div>
      )}
    </div>
  );
}

/** Kysymysvaihe: kysymys, neljä vaihtoehtoa, ajastin ja vastausmäärä. */
function QuestionStage({
  question,
  seconds,
  ratio,
  answerCount,
  playerCount,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  question: { index: number; total: number; category: string; question: string; answers: string[] };
  seconds: number;
  ratio: number;
  answerCount: number;
  playerCount: number;
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="tv-chip px-4 py-1 text-sm font-bold tracking-wide uppercase">
            {question.category}
          </span>
          <span className="text-sm font-semibold text-white/70 tabular-nums">
            Kysymys {question.index + 1} / {question.total}
          </span>
        </div>

        <h2 className="text-3xl leading-tight font-black sm:text-5xl">{question.question}</h2>

        <TimerBar seconds={seconds} ratio={ratio} />
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {question.answers.map((answer, index) => (
          <AnswerTile key={index} index={index} text={answer} size="lg" />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-2xl font-bold tabular-nums" data-testid="answer-count">
          {answerCount} / {playerCount}{" "}
          <span className="text-base font-semibold text-white/70">on vastannut</span>
        </p>
        <Button onClick={onAction} disabled={actionDisabled} className="px-8 py-5 text-xl">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

/** Tulosvaihe: oikea vastaus ja vastausjakauma. */
function ResultStage({
  question,
  answerCount,
  playerCount,
  busy,
  onAction,
}: {
  question: PublicQuestion | RevealedQuestion;
  answerCount: number;
  playerCount: number;
  busy: boolean;
  onAction: () => void;
}) {
  const revealed = isRevealedQuestion(question) ? question : null;

  if (!revealed) {
    return (
      <Notice tone="info">Tulosvaiheen tiedot päivittyvät hetken kuluttua…</Notice>
    );
  }

  const distribution = revealed.distribution;
  const maxCount = Math.max(1, ...distribution);
  const correctIndex = revealed.correctAnswerIndex;

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="tv-chip px-4 py-1 text-sm font-bold tracking-wide uppercase">
            {revealed.category}
          </span>
          <span className="text-sm font-semibold text-white/70 tabular-nums">
            Kysymys {revealed.index + 1} / {revealed.total}
          </span>
        </div>
        <h2 className="text-2xl leading-tight font-black sm:text-4xl">{revealed.question}</h2>
        <p className="text-lg font-bold text-emerald-200">
          Oikea vastaus: {revealed.answers[correctIndex]}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {revealed.answers.map((answer, index) => {
          const count = distribution[index] ?? 0;
          const widthPercent = Math.round((count / maxCount) * 100);

          return (
            <div key={index} className="flex flex-col gap-2">
              <AnswerTile
                index={index}
                text={answer}
                size="lg"
                state={index === correctIndex ? "correct" : "muted"}
                trailing={
                  <span className="shrink-0 rounded-full bg-black/25 px-3 py-1 text-base font-bold tabular-nums">
                    {count}
                  </span>
                }
              />
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className={`h-full rounded-full ${ANSWER_SLOTS[index].fillClass}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xl font-semibold tabular-nums text-white/80">
          Vastauksia {answerCount} / {playerCount}
        </p>
        <Button onClick={onAction} disabled={busy} className="px-8 py-5 text-xl">
          Näytä tilanne
        </Button>
      </div>
    </div>
  );
}

/** Välitulostaulu: vähintään kymmenen parasta pelaajaa. */
function LeaderboardStage({
  players,
  questionIndex,
  questionCount,
  busy,
  onNext,
}: {
  players: HostState["players"];
  questionIndex: number;
  questionCount: number;
  busy: boolean;
  onNext: () => void;
}) {
  const isLastQuestion = questionIndex + 1 >= questionCount;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 text-3xl font-black">
            <ListOrdered className="size-7" />
            Tilanne
          </h2>
          <span className="text-sm font-semibold text-white/70 tabular-nums">
            {questionIndex + 1} / {questionCount} kysymystä pelattu
          </span>
        </div>

        <LeaderboardList players={players} limit={10} size="lg" />
      </Card>

      <div className="flex justify-center">
        <Button onClick={onNext} disabled={busy} className="px-8 py-5 text-xl">
          {isLastQuestion ? (
            <>
              <Flag className="size-6" />
              Näytä lopullinen tulostaulu
            </>
          ) : (
            <>
              Seuraava kysymys
              <ArrowRight className="size-6" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** Lopputilanne: voittaja, konfetti ja lopullinen tulostaulu. */
function FinishedStage({ players }: { players: HostState["players"] }) {
  const winner = players[0] ?? null;
  const isTie = winner?.isTied ?? false;

  return (
    <div className="flex flex-col gap-6">
      <Confetti />

      <Card className="flex flex-col items-center gap-3 text-center">
        <span className="flex items-center gap-2 text-sm font-bold tracking-widest text-amber-200 uppercase">
          <Sparkles className="size-4" />
          Peli päättynyt
        </span>
        <h2 className="text-4xl font-black sm:text-6xl">
          {winner ? (isTie ? "Jaettu voitto!" : `Voittaja: ${winner.nickname}`) : "Ei pelaajia"}
        </h2>
        {winner ? (
          <p className="text-2xl font-bold tabular-nums text-white/85">
            {winner.score.toLocaleString("fi-FI")} pistettä
          </p>
        ) : null}
      </Card>

      <Card>
        <h3 className="mb-5 text-2xl font-black">Lopullinen tulostaulu</h3>
        <LeaderboardList players={players} size="lg" emptyMessage="Ei pelaajia." />
      </Card>
    </div>
  );
}

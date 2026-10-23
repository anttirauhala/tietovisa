"use client";

import { useNow } from "@/hooks/useNow";
import {
  clampToQuestionLength,
  progressRatio,
  remainingMs as calcRemainingMs,
  toDisplaySeconds,
} from "@/lib/time";

/**
 * Näyttökello. Lähde on palvelimen tallentama määräaika (question_ends_at)
 * ja palvelimen kellon perusteella laskettu aikakorjaus. Selaimen kello ei
 * ratkaise sitä, hyväksytäänkö vastaus – sen tekee palvelin.
 */
export function useCountdown(
  startedAt: string | null,
  endsAt: string | null,
  clockOffsetMs: number,
) {
  const active = Boolean(startedAt && endsAt);
  const nowMs = useNow(active);

  const remaining = active
    ? clampToQuestionLength(calcRemainingMs(endsAt, nowMs, clockOffsetMs), startedAt, endsAt)
    : null;

  return {
    remainingMs: remaining,
    seconds: toDisplaySeconds(remaining),
    ratio: active ? progressRatio(startedAt, endsAt, nowMs, clockOffsetMs) : 0,
    isFinished: remaining !== null && remaining <= 0,
  };
}

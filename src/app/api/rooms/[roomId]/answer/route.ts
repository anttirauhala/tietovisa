import { jsonErrorResponse, jsonResponse, parseWith, readJsonBody } from "@/lib/api/errors";
import { answerRequestSchema } from "@/lib/api/schemas";
import { assertRoomId, enforceRateLimit, requirePlayerToken } from "@/lib/api/server";
import { validateAnswerSubmission } from "@/lib/game/answerValidation";
import { isAnswerCorrect, scoreAnswer } from "@/lib/questions";
import { loadRoomSnapshot, requirePlayerSession } from "@/lib/roomState";
import { submitPlayerAnswer } from "@/lib/rooms";
import { apiErrorFromAnswerReason } from "@/lib/supabase/errors";

type RouteContext = { params: Promise<{ roomId: string }> };

/**
 * POST /api/rooms/[roomId]/answer
 *
 * Vastauksen vastaanotto. Palvelin tarkistaa:
 *  - pelaajan tokenin ja huonejäsenyyden
 *  - että huone on question-tilassa ja kysymysindeksi täsmää
 *  - että vastausvaihtoehto on välillä 0–3
 *  - että palvelimen kellon mukaan määräaika ei ole ylittynyt
 *  - että pelaaja ei ole jo vastannut tähän kysymykseen
 *
 * Pisteet lasketaan palvelimella. Selaimen ilmoittamaa vastausaikaa,
 * oikeellisuutta tai pistemäärää ei hyväksytä koskaan.
 *
 * Vastaus ei paljasta oikeaa vaihtoehtoa: pelaaja näkee oikeellisuuden vasta
 * kysymyksen tulosvaiheessa.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    assertRoomId(roomId);
    enforceRateLimit(request, "rooms:answer", 120, 60_000);

    const playerToken = requirePlayerToken(request);
    const body = parseWith(answerRequestSchema, await readJsonBody(request));

    const session = await requirePlayerSession(roomId, playerToken);
    const snapshot = await loadRoomSnapshot(roomId);

    const activeQuestionIndex = snapshot.room.currentQuestionIndex;
    const alreadyAnswered = snapshot.answers.some(
      (answer) =>
        answer.playerId === session.playerId && answer.questionIndex === activeQuestionIndex,
    );

    const validation = validateAnswerSubmission({
      roomStatus: snapshot.room.status,
      activeQuestionIndex,
      submittedQuestionIndex: body.questionIndex,
      answerIndex: body.answerIndex,
      questionStartedAt: snapshot.room.questionStartedAt,
      questionEndsAt: snapshot.room.questionEndsAt,
      serverNowMs: Date.now(),
      alreadyAnswered,
      playerBelongsToRoom: true,
    });

    if (!validation.ok) {
      throw apiErrorFromAnswerReason(validation.reason);
    }

    const isCorrect = isAnswerCorrect(activeQuestionIndex, body.answerIndex);
    const pointsAwarded = scoreAnswer(
      activeQuestionIndex,
      body.answerIndex,
      validation.elapsedMs,
    );

    await submitPlayerAnswer({
      roomId,
      playerId: session.playerId,
      questionIndex: activeQuestionIndex,
      answerIndex: body.answerIndex,
      isCorrect,
      pointsAwarded,
      responseTimeMs: validation.responseTimeMs,
    });

    return jsonResponse(
      {
        accepted: true,
        questionIndex: activeQuestionIndex,
        answerIndex: body.answerIndex,
      },
      201,
    );
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

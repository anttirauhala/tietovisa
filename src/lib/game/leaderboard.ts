import type { PublicPlayer, RankedPlayer } from "./types";

/**
 * Tulostaulun järjestäminen. Puhdas ja deterministinen.
 *
 * Järjestysperusteet:
 *  1. kokonaispisteet laskevasti
 *  2. oikeiden vastausten määrä laskevasti
 *  3. liittymisjärjestys (aikaisempi ensin) – deterministinen ratkaisu
 *  4. pelaajan tunniste – viimeinen varmistus täydelliselle determinismille
 *
 * Täsmälleen samat pisteet ja oikeat vastaukset saaneet pelaajat saavat
 * jaetun sijoituksen.
 */

export type LeaderboardInput = Pick<
  PublicPlayer,
  "id" | "nickname" | "score" | "correctCount" | "joinedAt"
>;

export function comparePlayers(a: LeaderboardInput, b: LeaderboardInput): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (b.correctCount !== a.correctCount) {
    return b.correctCount - a.correctCount;
  }
  if (a.joinedAt !== b.joinedAt) {
    return a.joinedAt < b.joinedAt ? -1 : 1;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1;
  }
  return 0;
}

function sameRank(a: LeaderboardInput, b: LeaderboardInput): boolean {
  return a.score === b.score && a.correctCount === b.correctCount;
}

export function rankPlayers(players: readonly LeaderboardInput[]): RankedPlayer[] {
  const sorted = [...players].sort(comparePlayers);
  const ranked: RankedPlayer[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const player = sorted[index];
    const previous = sorted[index - 1];
    const rank = previous && sameRank(previous, player) ? ranked[index - 1].rank : index + 1;
    ranked.push({ ...player, rank, isTied: false });
  }

  // Merkitään jaetut sijoitukset: sama sijoitusnumero useammalla pelaajalla.
  const rankCounts = new Map<number, number>();
  for (const player of ranked) {
    rankCounts.set(player.rank, (rankCounts.get(player.rank) ?? 0) + 1);
  }
  for (const player of ranked) {
    player.isTied = (rankCounts.get(player.rank) ?? 0) > 1;
  }

  return ranked;
}

export function findPlayerRank(
  players: readonly LeaderboardInput[],
  playerId: string,
): RankedPlayer | null {
  return rankPlayers(players).find((player) => player.id === playerId) ?? null;
}

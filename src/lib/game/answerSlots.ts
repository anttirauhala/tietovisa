/**
 * Vastausvaihtoehtojen värit ja symbolit.
 *
 * Neljä selvästi erottuvaa väriä ja geometrista symbolia, jotta ero on
 * havaittavissa myös heikentyneellä värinäöllä.
 * Luokat ovat staattisia merkkijonoja, jotta Tailwind löytää ne.
 */

export type AnswerSlotIndex = 0 | 1 | 2 | 3;

export type AnswerSlotDefinition = {
  index: AnswerSlotIndex;
  name: string;
  symbol: string;
  /** Vastauslaatan tausta ja reunus. */
  tileClass: string;
  /** Jakaumapalkin väri. */
  fillClass: string;
  /** Tekstin väri laatan päällä. */
  textClass: string;
};

export const ANSWER_SLOTS: readonly AnswerSlotDefinition[] = [
  {
    index: 0,
    name: "Punainen",
    symbol: "▲",
    tileClass: "bg-answer-red border-white/25",
    fillClass: "bg-answer-red",
    textClass: "text-white",
  },
  {
    index: 1,
    name: "Sininen",
    symbol: "◆",
    tileClass: "bg-answer-blue border-white/25",
    fillClass: "bg-answer-blue",
    textClass: "text-white",
  },
  {
    index: 2,
    name: "Keltainen",
    symbol: "●",
    tileClass: "bg-answer-yellow border-white/30",
    fillClass: "bg-answer-yellow",
    textClass: "text-night",
  },
  {
    index: 3,
    name: "Vihreä",
    symbol: "■",
    tileClass: "bg-answer-green border-white/25",
    fillClass: "bg-answer-green",
    textClass: "text-white",
  },
];

export function getAnswerSlot(index: number): AnswerSlotDefinition {
  return ANSWER_SLOTS[index] ?? ANSWER_SLOTS[0];
}

export function isAnswerSlotIndex(value: unknown): value is AnswerSlotIndex {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3;
}

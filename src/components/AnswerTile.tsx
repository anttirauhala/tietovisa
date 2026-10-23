"use client";

import { Check, X } from "lucide-react";

import { getAnswerSlot } from "@/lib/game/answerSlots";

export type AnswerTileState = "idle" | "selected" | "correct" | "wrong" | "muted";

type AnswerTileProps = {
  index: number;
  text: string;
  state?: AnswerTileState;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  trailing?: React.ReactNode;
};

const SIZE_STYLES = {
  sm: "px-4 py-3 text-base rounded-2xl",
  md: "px-5 py-4 text-lg rounded-2xl",
  lg: "px-6 py-5 text-xl sm:text-2xl rounded-3xl",
} as const;

/**
 * Yksi vastausvaihtoehto. Sama komponentti toimii juontajan näytöllä
 * (suurena laatana) ja pelaajan puhelimessa (kosketuspainikkeena).
 * Kosketusalue on aina vähintään 48 × 48 CSS-pikseliä.
 */
export function AnswerTile({
  index,
  text,
  state = "idle",
  size = "md",
  disabled = false,
  onClick,
  className = "",
  trailing,
}: AnswerTileProps) {
  const slot = getAnswerSlot(index);
  const isInteractive = typeof onClick === "function" && !disabled;

  const stateStyles: Record<AnswerTileState, string> = {
    idle: "opacity-100 ring-0",
    selected: "opacity-100 ring-4 ring-white scale-[0.99]",
    correct: "opacity-100 ring-4 ring-white",
    wrong: "opacity-100 ring-4 ring-rose-200",
    muted: "opacity-40 ring-0",
  };

  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/20 text-lg font-bold">
        {slot.symbol}
      </span>
      <span className="min-w-0 flex-1 text-left font-bold leading-tight break-words">
        {text}
      </span>
      {trailing}
      {state === "correct" ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/25">
          <Check className="size-5" />
        </span>
      ) : null}
      {state === "wrong" ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/25">
          <X className="size-5" />
        </span>
      ) : null}
    </>
  );

  const baseClass = `flex w-full items-center gap-3 border ${slot.tileClass} ${slot.textClass} ${SIZE_STYLES[size]} ${stateStyles[state]} ${className}`;

  if (!isInteractive) {
    return (
      <div
        className={baseClass}
        aria-label={`${slot.name}: ${text}`}
        data-answer-index={index}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={`${baseClass} min-h-[48px] cursor-pointer transition active:scale-[0.98] disabled:cursor-not-allowed`}
      data-answer-index={index}
    >
      {content}
    </button>
  );
}

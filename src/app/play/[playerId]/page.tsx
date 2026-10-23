import { Suspense } from "react";

import { PlayerRoomRoute } from "@/components/player/PlayerRoomRoute";
import { Spinner } from "@/components/ui";

/**
 * Pelaajan pelinäkymä. Reittiparametri luetaan selaimessa, joten sisältö on
 * Suspense-rajauksen takana.
 */
export default function PlayPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 pt-safe pb-safe">
            <Spinner label="Ladataan peliä…" />
          </div>
        }
      >
        <PlayerRoomRoute />
      </Suspense>
    </main>
  );
}

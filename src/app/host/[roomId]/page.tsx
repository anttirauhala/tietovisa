import { Suspense } from "react";

import { HostRoomRoute } from "@/components/host/HostRoomRoute";
import { Spinner } from "@/components/ui";

/**
 * Juontajan pelihuone. Reittiparametri luetaan selaimessa, joten sisältö on
 * Suspense-rajauksen takana: staattinen kehys voidaan esirenderöidä ja
 * huoneen tila ladataan heti perässä.
 */
export default function HostRoomPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 pt-safe pb-safe">
            <Spinner label="Avataan pelihuonetta…" />
          </div>
        }
      >
        <HostRoomRoute />
      </Suspense>
    </main>
  );
}

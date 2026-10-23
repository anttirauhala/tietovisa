import { Suspense } from "react";

import { JoinForm } from "@/components/join/JoinForm";
import { Spinner } from "@/components/ui";

/**
 * Liittymisnäkymä. Lomake lukee PIN-koodin URL-parametrista selaimessa,
 * joten se on Suspense-rajauksen sisällä.
 */
export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 pt-safe pb-safe">
      <Suspense fallback={<Spinner label="Ladataan liittymisnäkymää…" />}>
        <JoinForm />
      </Suspense>
    </main>
  );
}

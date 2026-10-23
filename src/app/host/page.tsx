"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Ticket } from "lucide-react";
import { useCallback, useState } from "react";

import { Button, Card, Notice } from "@/components/ui";
import { useHostSession } from "@/hooks/useStoredValue";
import { apiRequest } from "@/lib/api/client";
import { saveHostSession } from "@/lib/session";

type CreateRoomResponse = {
  roomId: string;
  pin: string;
  hostToken: string;
};

/**
 * Juontajan aloitusnäkymä: uuden pelin luonti ja aiemman pelin jatkaminen.
 */
export default function HostStartPage() {
  const router = useRouter();
  const existing = useHostSession();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createRoom = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    const result = await apiRequest<CreateRoomResponse>("/api/rooms", {
      method: "POST",
      json: {},
    });

    if (!result.ok) {
      setError(result.message);
      setIsCreating(false);
      return;
    }

    saveHostSession({
      roomId: result.data.roomId,
      pin: result.data.pin,
      hostToken: result.data.hostToken,
      createdAt: new Date().toISOString(),
    });

    router.push(`/host/${result.data.roomId}`);
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10 pt-safe pb-safe">
      <div className="text-center">
        <h1 className="text-4xl font-black">Juontajan näkymä</h1>
        <p className="mt-2 text-white/75">
          Luo pelihuone ja näytä liittymiskoodi osallistujille.
        </p>
      </div>

      {existing ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-black">Jatka aiempaa peliä</h2>
            <p className="text-white/70">
              Pelihuone, jonka PIN-koodi on <strong>{existing.pin}</strong>.
            </p>
          </div>
          <Link href={`/host/${existing.roomId}`}>
            <Button variant="secondary" className="w-full">
              <Ticket className="size-5" />
              Avaa pelihuone {existing.pin}
            </Button>
          </Link>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-black">Uusi peli</h2>
          <p className="text-white/70">
            Sovellus arpoo kuusinumeroisen liittymiskoodin ja QR-koodin pelaajille.
          </p>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <Button onClick={() => void createRoom()} disabled={isCreating} className="w-full py-5 text-xl">
          <Plus className="size-6" />
          {isCreating ? "Luodaan peliä…" : "Luo uusi peli"}
        </Button>

        <p className="text-xs text-white/55">
          Juontajan istunto tallennetaan tähän selaimeen. Jos tyhjennät selaimen tiedot, peliä
          ei voi enää hallita – luo silloin uusi peli.
        </p>
      </Card>

      <Link href="/" className="text-center text-sm text-white/65 underline">
        Takaisin etusivulle
      </Link>
    </main>
  );
}

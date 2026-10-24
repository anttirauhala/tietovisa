"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Plus, Ticket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button, Card, Notice } from "@/components/ui";
import { useHostPasscode, useHostSession } from "@/hooks/useStoredValue";
import { apiRequest } from "@/lib/api/client";
import { saveHostPasscode, saveHostSession } from "@/lib/session";

type CreateRoomResponse = {
  roomId: string;
  pin: string;
  hostToken: string;
};

type RoomOptionsResponse = {
  passcodeRequired: boolean;
};

/**
 * Juontajan aloitusnäkymä: uuden pelin luonti ja aieman pelin jatkaminen.
 *
 * Jos palvelimelle on asetettu HOST_PASSCODE, uuden pelin luonti vaatii
 * tunnuslauseen. Sivu kysyy sen palvelimelta (GET /api/rooms), joten
 * tunnuslausekenttä näytetään vain silloin kun sitä tarvitaan.
 */
export default function HostStartPage() {
  const router = useRouter();
  const existing = useHostSession();
  const storedPasscode = useHostPasscode();

  const [passcodeRequired, setPasscodeRequired] = useState(false);
  const [editedPasscode, setEditedPasscode] = useState<string | null>(null);
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Tallennettu tunnuslause näytetään, kunnes käyttäjä muokkaa kenttää.
  const passcode = editedPasscode ?? storedPasscode?.value ?? "";

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await apiRequest<RoomOptionsResponse>("/api/rooms");
      if (!cancelled && result.ok) {
        setPasscodeRequired(result.data.passcodeRequired);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const createRoom = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    if (passcodeRequired && passcode.trim().length === 0) {
      setError("Syötä juontajan tunnuslause.");
      setIsCreating(false);
      return;
    }

    const result = await apiRequest<CreateRoomResponse>("/api/rooms", {
      method: "POST",
      json: passcodeRequired ? { passcode } : {},
    });

    if (!result.ok) {
      setError(result.message);
      setIsCreating(false);
      return;
    }

    // Tunnuslause muistetaan tässä selaimessa seuraavaa kertaa varten.
    saveHostPasscode(passcode);
    saveHostSession({
      roomId: result.data.roomId,
      pin: result.data.pin,
      hostToken: result.data.hostToken,
      createdAt: new Date().toISOString(),
    });

    router.push(`/host/${result.data.roomId}`);
  }, [passcode, passcodeRequired, router]);

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

        {passcodeRequired ? (
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
              <Lock className="size-4" />
              Juontajan tunnuslause
            </span>
            <div className="flex items-stretch gap-2">
              <input
                type={showPasscode ? "text" : "password"}
                value={passcode}
                onChange={(event) => setEditedPasscode(event.target.value)}
                autoComplete="off"
                placeholder="Palvelimelle asetettu tunnuslause"
                className="min-h-[52px] flex-1 rounded-2xl border border-white/25 bg-white/10 px-4 text-lg font-bold outline-none placeholder:text-white/35 focus:border-fuchsia-300"
                aria-label="Juontajan tunnuslause"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowPasscode((visible) => !visible)}
                aria-pressed={showPasscode}
                className="shrink-0"
              >
                {showPasscode ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                {showPasscode ? "Piilota" : "Näytä"}
              </Button>
            </div>
            <span className="text-xs text-white/55">
              Tämä palvelin on suojattu: uuden pelin luominen vaatii tunnuslauseen.
              Sen pitää täsmätä palvelimen <strong>HOST_PASSCODE</strong>-arvoon
              (kirjainkoko merkitsee). Se muistetaan tässä selaimessa.
            </span>
          </label>
        ) : null}

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

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Ticket } from "lucide-react";
import { useCallback, useState } from "react";

import { Button, Card, Notice } from "@/components/ui";
import { usePlayerSession } from "@/hooks/useStoredValue";
import { apiRequest } from "@/lib/api/client";
import { NICKNAME_MAX_LENGTH } from "@/lib/api/schemas";
import { clearPlayerSession, savePlayerSession } from "@/lib/session";

type JoinResponse = {
  playerId: string;
  roomId: string;
  nickname: string;
  playerToken: string;
};

/**
 * Liittymislomake. PIN-koodi luetaan URL-parametrista (?pin=123456), joten
 * QR-koodin skannannut pelaaja pääsee suoraan eteenpäin. Istuntotokenia ei
 * koskaan laiteta URL-osoitteeseen – se tallennetaan selaimen tallennukseen.
 */
export function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existing = usePlayerSession();

  const pinFromUrl = searchParams.get("pin") ?? "";
  const [pin, setPin] = useState(/^[0-9]{6}$/.test(pinFromUrl) ? pinFromUrl : "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    setError(null);

    if (!/^[0-9]{6}$/.test(pin)) {
      setError("Liittymiskoodin pitää olla kuusi numeroa.");
      return;
    }
    if (nickname.trim().length < 2) {
      setError("Nimimerkin pitää olla vähintään 2 merkkiä.");
      return;
    }

    setIsSubmitting(true);

    const result = await apiRequest<JoinResponse>("/api/rooms/join", {
      method: "POST",
      json: { pin, nickname: nickname.trim() },
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    clearPlayerSession();
    savePlayerSession({
      playerId: result.data.playerId,
      roomId: result.data.roomId,
      nickname: result.data.nickname,
      playerToken: result.data.playerToken,
      createdAt: new Date().toISOString(),
    });

    router.push(`/play/${result.data.playerId}`);
  }, [nickname, pin, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-black">Liity peliin</h1>
        <p className="mt-2 text-white/75">Syötä liittymiskoodi ja valitse nimimerkki.</p>
      </div>

      {existing ? (
        <Notice tone="info">
          Tässä selaimessa on käynnissä oleva peli nimimerkillä{" "}
          <strong>{existing.nickname}</strong>.
          <div className="mt-3">
            <Link href={`/play/${existing.playerId}`}>
              <Button variant="secondary">Jatka samalla pelaajalla</Button>
            </Link>
          </div>
        </Notice>
      ) : null}

      <Card>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
              <Ticket className="size-4" />
              Liittymiskoodi
            </span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="min-h-[56px] rounded-2xl border border-white/25 bg-white/10 px-4 text-center text-3xl font-black tracking-[0.3em] tabular-nums outline-none placeholder:text-white/35 focus:border-fuchsia-300"
              aria-label="Liittymiskoodi"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
              <LogIn className="size-4" />
              Nimimerkki
            </span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value.slice(0, NICKNAME_MAX_LENGTH))}
              maxLength={NICKNAME_MAX_LENGTH}
              autoComplete="nickname"
              placeholder="Esim. Jouluinen Jussi"
              className="min-h-[56px] rounded-2xl border border-white/25 bg-white/10 px-4 text-xl font-bold outline-none placeholder:text-white/35 focus:border-fuchsia-300"
              aria-label="Nimimerkki"
            />
            <span className="text-xs text-white/55">
              2–{NICKNAME_MAX_LENGTH} merkkiä. Nimimerkin pitää olla yksilöllinen tässä pelissä.
            </span>
          </label>

          {error ? <Notice tone="error">{error}</Notice> : null}

          <Button type="submit" disabled={isSubmitting} className="py-5 text-xl">
            {isSubmitting ? "Liitytään…" : "Liity peliin"}
          </Button>
        </form>
      </Card>

      <Link href="/" className="text-center text-sm text-white/65 underline">
        Takaisin etusivulle
      </Link>
    </div>
  );
}

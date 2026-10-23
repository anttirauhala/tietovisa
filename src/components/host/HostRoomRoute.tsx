"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { HostRoom } from "@/components/host/HostRoom";
import { Button, Card, Notice, Spinner } from "@/components/ui";
import { useHostSession } from "@/hooks/useStoredValue";

/**
 * Juontajan yksittäinen pelihuone.
 *
 * Istunto luetaan selaimen tallennuksesta – tokenia ei koskaan välitetä
 * URL-osoitteessa. Tämä komponentti lukee reittiparametrin selaimessa, joten
 * se on käärittävä Suspense-rajaukseen (ks. page.tsx).
 */
export function HostRoomRoute() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const session = useHostSession();

  if (session === null) {
    return (
      <Card className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 text-center">
        <Notice tone="error">
          Juontajan istuntoa ei löytynyt tästä selaimesta. Pelihuonetta voi hallita vain sillä
          selaimella, jolla se luotiin.
        </Notice>
        <Link href="/host">
          <Button>Luo uusi peli</Button>
        </Link>
      </Card>
    );
  }

  if (session.roomId !== roomId) {
    return (
      <Card className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 text-center">
        <Notice tone="info">
          Tässä selaimessa on käynnissä toinen peli (PIN {session.pin}).
        </Notice>
        <Link href={`/host/${session.roomId}`}>
          <Button>Avaa pelihuone {session.pin}</Button>
        </Link>
        <Spinner label="Etsitään pyydettyä huonetta…" />
      </Card>
    );
  }

  return <HostRoom roomId={session.roomId} hostToken={session.hostToken} />;
}

"use client";

import { useParams } from "next/navigation";

import { PlayerRoom } from "@/components/player/PlayerRoom";

/**
 * Pelaajan pelinäkymä. Pelaajan tunniste on URLissa (ei salaisuus);
 * oikeudet perustuvat selaimessa säilytettävään istuntotokeniin.
 * Reittiparametri luetaan selaimessa, joten komponentti on Suspense-rajauksen
 * sisällä (ks. page.tsx).
 */
export function PlayerRoomRoute() {
  const params = useParams<{ playerId: string }>();
  const playerId = typeof params?.playerId === "string" ? params.playerId : "";

  return <PlayerRoom playerId={playerId} />;
}

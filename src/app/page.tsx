import { Gift, QrCode, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";

/**
 * Aloitussivu: juontaja tai pelaaja.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-12 pt-safe pb-safe sm:px-6">
      <div className="text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-semibold tracking-widest uppercase">
          <Sparkles className="size-4" />
          Pikkujoulut 2026
        </p>
        <h1 className="text-5xl leading-none font-black sm:text-7xl">
          Pikkujoulu<span className="text-fuchsia-300">visa</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80 sm:text-xl">
          Reaaliaikainen tietovisa koko porukalle. Juontaja näyttää kysymykset
          projektorilta, pelaajat vastaavat omilla puhelimillaan – ilman sovellusta ja ilman
          tunnuksia.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/host"
          className="tv-card group flex flex-col gap-3 p-7 transition hover:border-fuchsia-300/50 hover:bg-white/15"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-700">
            <Trophy className="size-7" />
          </span>
          <h2 className="text-2xl font-black">Olen juontaja</h2>
          <p className="text-white/75">
            Luo pelihuone, näytä liittymiskoodi ja QR-koodi, käynnistä kysymykset ja seuraa
            tulostaulua.
          </p>
          <span className="mt-auto font-bold text-fuchsia-200 group-hover:underline">
            Luo peli →
          </span>
        </Link>

        <Link
          href="/join"
          className="tv-card group flex flex-col gap-3 p-7 transition hover:border-emerald-300/50 hover:bg-white/15"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700">
            <Gift className="size-7" />
          </span>
          <h2 className="text-2xl font-black">Liity peliin</h2>
          <p className="text-white/75">
            Syötä juontajan näyttämä liittymiskoodi tai skannaa QR-koodi. Tarvitset vain
            nimimerkin.
          </p>
          <span className="mt-auto font-bold text-emerald-200 group-hover:underline">
            Syötä koodi →
          </span>
        </Link>
      </div>

      <ul className="grid gap-4 text-sm text-white/75 sm:grid-cols-3">
        <li className="flex items-start gap-3">
          <QrCode className="mt-0.5 size-5 shrink-0 text-fuchsia-200" />
          Liittyminen QR-koodilla tai kuusinumeroisella koodilla.
        </li>
        <li className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-fuchsia-200" />
          Vastaukset ja pisteet päivittyvät kaikille samaan aikaan.
        </li>
        <li className="flex items-start gap-3">
          <Trophy className="mt-0.5 size-5 shrink-0 text-fuchsia-200" />
          Pisteet lasketaan palvelimella – nopeus ratkaisee.
        </li>
      </ul>
    </main>
  );
}

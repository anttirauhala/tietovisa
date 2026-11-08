import Image from "next/image";
import Link from "next/link";
import { QrCode, Trophy, Users } from "lucide-react";

/**
 * Aloitussivu: juontaja tai pelaaja.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-12 pt-safe pb-safe sm:px-6">
      <div className="text-center">
        <Image
          src="/robot.png"
          alt="Pikkujouluvisan maskotti: joulupukinhatussa oleva robotti miettii vastausta pitäen kädessään juomapulloa"
          width={1312}
          height={1199}
          className="mx-auto mb-2 h-auto w-36 sm:w-48 drop-shadow-[0_16px_28px_rgba(0,0,0,0.45)]"
        />
        <h1 className="text-[clamp(1.75rem,9vw,3rem)] leading-none font-black text-balance sm:text-7xl">
          <span className="block sm:inline">Pikkujoulu</span>
          <span className="block text-fuchsia-300 sm:inline">visa</span>
        </h1>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/host"
          className="tv-card group flex flex-col gap-3 p-7 transition hover:border-fuchsia-300/50 hover:bg-white/15"
        >
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

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";

/**
 * Integraatiotestien tietokanta-apurit.
 *
 * Testit ajavat samat SQL-migraatiot kuin tuotannossa käyttämällä PGliteä
 * (PostgreSQL WebAssemblyssä). Näin migraatioiden syntaksi, RPC-funktioiden
 * atomisuus ja tietokantatason rajoitteet tulevat oikeasti testatuiksi ilman
 * erillistä Supabase-projektia.
 *
 * HUOM: Supabasen roolit (anon, authenticated, service_role) luodaan
 * testikannassa erikseen, koska migraatiot viittaavat niihin.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();

  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
  `);

  for (const file of listMigrations()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await db.exec(sql);
  }

  return db;
}

export async function closeTestDatabase(db: PGlite): Promise<void> {
  await db.close();
}

/** Kutsuu RPC-funktiota ja palauttaa jsonb-tuloksen objektina. */
export async function callRpc<T = Record<string, unknown>>(
  db: PGlite,
  functionName: string,
  params: unknown[],
): Promise<T> {
  const placeholders = params.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db.query<Record<string, T>>(
    `select public.${functionName}(${placeholders}) as result`,
    params,
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`RPC ${functionName} ei palauttanut riviä.`);
  }

  return row.result;
}

export type RpcStatus = {
  status: string;
  [key: string]: unknown;
};

export async function callRpcStatus(
  db: PGlite,
  functionName: string,
  params: unknown[],
): Promise<RpcStatus> {
  return callRpc<RpcStatus>(db, functionName, params);
}

export const TOKEN_HASH_A = "a".repeat(64);
export const TOKEN_HASH_B = "b".repeat(64);
export const TOKEN_HASH_C = "c".repeat(64);

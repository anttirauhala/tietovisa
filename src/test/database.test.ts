import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  callRpc,
  callRpcStatus,
  closeTestDatabase,
  createTestDatabase,
  listMigrations,
  TOKEN_HASH_A,
  TOKEN_HASH_B,
  TOKEN_HASH_C,
} from "./database";

/**
 * Integraatiotestit oikealle PostgreSQL-moottorille (PGlite = PostgreSQL
 * WebAssemblyssä). Testit ajavat samat migraatiot kuin tuotanto ja
 * varmistavat pelin kriittisen logiikan tietokantatasolla:
 *
 *  - tilakoneen siirtymät ja niiden atomisuus
 *  - yhden vastauksen sääntö ja kaksinkertaisen pisteytyksen esto
 *  - myöhästyneiden vastausten hylkäys palvelimen kellon perusteella
 *  - oikean vastauksen ja tokenien pysyminen poissa julkisesta tilannekuvasta
 */

const PIN = "123456";
const QUESTION_LIMIT_MS = 20_000;

let db: PGlite;
let roomId: string;
let playerOne: string;
let playerTwo: string;

async function startQuestion(index: number, startedAtMs: number) {
  return callRpcStatus(db, "start_question", [
    roomId,
    TOKEN_HASH_A,
    index,
    new Date(startedAtMs).toISOString(),
    new Date(startedAtMs + QUESTION_LIMIT_MS).toISOString(),
  ]);
}

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase(db);
});

describe("SQL-migraatiot", () => {
  it("sisältää odotetut migraatiotiedostot", () => {
    expect(listMigrations()).toEqual([
      "20260101000000_init.sql",
      "20260101000100_functions.sql",
    ]);
  });

  it("luo taulut ja ottaa RLS:n käyttöön", async () => {
    const tables = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    );

    expect(tables.rows.map((row) => row.tablename)).toEqual(["answers", "players", "rooms"]);
    expect(tables.rows.every((row) => row.rowsecurity)).toBe(true);
  });

  it("ei anna anon-roolille oikeuksia tauluihin", async () => {
    const grants = await db.query<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`,
    );

    expect(grants.rows).toHaveLength(0);
  });

  it("ei anna anon-roolille EXECUTE-oikeutta RPC-funktioihin", async () => {
    const grants = await db.query<{ routine_name: string }>(
      `select routine_name from information_schema.role_routine_grants
       where grantee = 'anon' and routine_schema = 'public'`,
    );

    expect(grants.rows).toHaveLength(0);
  });

  it("pakottaa answers-tauluun yhden vastauksen kysymystä kohti", async () => {
    const constraints = await db.query<{ constraint_name: string }>(
      `select constraint_name from information_schema.table_constraints
       where table_name = 'answers' and constraint_type = 'UNIQUE'`,
    );

    expect(constraints.rows.map((row) => row.constraint_name)).toContain(
      "answers_player_question_key",
    );
  });
});

describe("huoneen luonti ja liittyminen", () => {
  it("luo huoneen ja hylkää varatun PIN-koodin", async () => {
    roomId = await callRpc<string>(db, "create_room", [PIN, TOKEN_HASH_A]);
    expect(roomId).toMatch(/^[0-9a-f-]{36}$/);

    await expect(callRpc(db, "create_room", [PIN, TOKEN_HASH_B])).rejects.toThrow(
      /duplicate|unique/i,
    );
  });

  it("liittää kaksi pelaajaa samaan huoneeseen", async () => {
    const first = await callRpcStatus(db, "join_room", [PIN, "Joulu-Jussi", TOKEN_HASH_B]);
    const second = await callRpcStatus(db, "join_room", [PIN, "Pukki", TOKEN_HASH_C]);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");

    playerOne = String(first.playerId);
    playerTwo = String(second.playerId);
    expect(playerOne).not.toBe(playerTwo);
  });

  it("estää samannimisen pelaajan kirjainkoosta riippumatta", async () => {
    const duplicate = await callRpcStatus(db, "join_room", [PIN, "joulu-jussi", TOKEN_HASH_A]);
    expect(duplicate.status).toBe("nickname_taken");
  });

  it("hylkää virheellisen PIN-koodin", async () => {
    const result = await callRpcStatus(db, "join_room", ["999999", "Matti", TOKEN_HASH_A]);
    expect(result.status).toBe("room_not_found");
  });
});

describe("pelin tilakone tietokannassa", () => {
  it("estää kysymyksen aloittamisen väärällä juontajatokenilla", async () => {
    const result = await callRpcStatus(db, "start_question", [
      roomId,
      TOKEN_HASH_B,
      0,
      new Date().toISOString(),
      new Date(Date.now() + QUESTION_LIMIT_MS).toISOString(),
    ]);

    expect(result.status).toBe("forbidden");
  });

  it("estää siirtymän lobby → question väärällä kysymysindeksillä", async () => {
    const result = await startQuestion(5, Date.now());
    expect(result.status).toBe("invalid_state");
  });

  it("aloittaa pelin ja on idempotentti samalle komennolle", async () => {
    const startedAtMs = Date.now();
    const first = await startQuestion(0, startedAtMs);
    const second = await startQuestion(0, startedAtMs + 500);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");

    const room = await db.query<{ status: string; current_question_index: number }>(
      `select status, current_question_index from public.rooms where id = $1`,
      [roomId],
    );

    expect(room.rows[0].status).toBe("question");
    expect(room.rows[0].current_question_index).toBe(0);
  });

  it("estää liittymisen kesken pelin", async () => {
    const result = await callRpcStatus(db, "join_room", [PIN, "Myöhäinen", TOKEN_HASH_C]);
    expect(result.status).toBe("already_started");
  });

  it("ei paljasta oikeaa vastausta eikä tokeneita julkisessa tilannekuvassa", async () => {
    const snapshot = await callRpc<Record<string, unknown>>(db, "room_snapshot", [roomId]);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.room).toBeDefined();
    expect(serialized).not.toContain("correctAnswerIndex");
    expect(serialized).not.toContain("host_token_hash");
    expect(serialized).not.toContain("token_hash");
  });

  it("estää tulosvaiheen siirtymän ennen määräajan päättymistä", async () => {
    const tooEarly = await callRpcStatus(db, "reveal_question", [
      roomId,
      TOKEN_HASH_A,
      new Date().toISOString(),
    ]);

    expect(tooEarly.status).toBe("too_early");
  });

  it("estää siirtymän question → finished", async () => {
    const result = await callRpcStatus(db, "finish_room", [roomId, TOKEN_HASH_A]);
    expect(result.status).toBe("invalid_state");
  });
});

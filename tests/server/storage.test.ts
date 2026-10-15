import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EnvelopeError, open, seal } from "@/server/security/envelope";
import { FileStore } from "@/server/repositories/file-store";
import { makeTempDir } from "../helpers/app";

describe("envelope AES-256-GCM", () => {
  const key = randomBytes(32);

  it("cifra e decifra com o mesmo contexto", () => {
    const sealed = seal(key, Buffer.from("segredo"), "clients/1");
    expect(sealed.subarray(0, 3).toString()).toBe("SLK");
    expect(open(key, sealed, "clients/1").toString()).toBe("segredo");
  });

  it("usa nonce novo a cada gravação", () => {
    const a = seal(key, Buffer.from("x"), "c");
    const b = seal(key, Buffer.from("x"), "c");
    expect(a.equals(b)).toBe(false);
  });

  it("detecta adulteração, contexto trocado e chave errada", () => {
    const sealed = seal(key, Buffer.from("valor"), "plates/a");
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] ^= 1;
    expect(() => open(key, tampered, "plates/a")).toThrow(EnvelopeError);
    expect(() => open(key, sealed, "plates/b")).toThrow(EnvelopeError);
    expect(() => open(randomBytes(32), sealed, "plates/a")).toThrow(EnvelopeError);
    expect(() => open(key, Buffer.from("lixo"), "plates/a")).toThrow(EnvelopeError);
  });

  it("rejeita versão de formato desconhecida", () => {
    const sealed = seal(key, Buffer.from("v"), "c");
    sealed[3] = 99;
    expect(() => open(key, sealed, "c")).toThrow(/Versão/);
  });
});

describe("FileStore", () => {
  let dir: string;
  let cleanup: () => Promise<void>;
  const key = randomBytes(32);

  beforeEach(async () => {
    ({ dir, cleanup } = await makeTempDir());
  });
  afterEach(() => cleanup());

  it("grava de forma atômica, sem texto puro em disco e sem temporários", async () => {
    const store = new FileStore(dir, key);
    await store.init();
    const id = randomUUID();
    await store.write("clients", id, { id, name: "Cliente Secreto" });
    const files = await readdir(path.join(dir, "data", "clients"));
    expect(files).toEqual([`${id}.enc`]);
    const raw = await readFile(path.join(dir, "data", "clients", files[0]));
    expect(raw.includes(Buffer.from("Cliente Secreto"))).toBe(false);
    expect(await store.read("clients", id)).toEqual({ id, name: "Cliente Secreto" });
  });

  it("isola arquivos corrompidos ou trocados entre registros", async () => {
    const store = new FileStore(dir, key);
    await store.init();
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    await store.write("plates", a, { id: a });
    await store.write("plates", b, { id: b });
    // Copia o arquivo de A sobre um novo id C: o AAD não confere.
    await copyFile(path.join(dir, "data", "plates", `${a}.enc`), path.join(dir, "data", "plates", `${c}.enc`));
    // Corrompe B.
    await writeFile(path.join(dir, "data", "plates", `${b}.enc`), Buffer.from("corrompido"));

    const { records, corrupt } = await store.readAll<{ id: string }>("plates");
    expect(records.map((r) => r.id)).toEqual([a]);
    expect(corrupt.sort()).toEqual([`data/plates/${b}.enc`, `data/plates/${c}.enc`].sort());
  });

  it("remove temporários de gravações interrompidas no init", async () => {
    const store = new FileStore(dir, key);
    await store.init();
    await writeFile(path.join(dir, "data", "clients", "abc.enc.tmp-123"), "parcial");
    await store.init();
    expect(await readdir(path.join(dir, "data", "clients"))).toEqual([]);
  });

  it("recusa identificadores que poderiam escapar do diretório", async () => {
    const store = new FileStore(dir, key);
    await store.init();
    await expect(store.write("clients", "../../etc/passwd", {})).rejects.toThrow(/inválido/);
    await expect(store.read("stats", "2026-1")).rejects.toThrow(/inválido/);
  });
});

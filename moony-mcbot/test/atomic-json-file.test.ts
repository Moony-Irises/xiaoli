import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeJsonAtomic } from "../src/runtime/atomic-json-file.js";

async function withTemporaryDir(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "moony-mcbot-atomic-json-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("writeJsonAtomic creates parent directories and a complete JSON document", async () => {
  await withTemporaryDir(async (directory) => {
    const pathname = path.join(directory, "nested", "state.json");

    await writeJsonAtomic(pathname, { version: 1, value: "first" });

    assert.deepEqual(JSON.parse(await readFile(pathname, "utf8")), { version: 1, value: "first" });
    assert.deepEqual(await readdir(path.dirname(pathname)), ["state.json"]);
  });
});

test("writeJsonAtomic replaces an existing document without leaving a temp file", async () => {
  await withTemporaryDir(async (directory) => {
    const pathname = path.join(directory, "state.json");
    await writeFile(pathname, '{"value":"old"}\n', "utf8");

    await writeJsonAtomic(pathname, { value: "new" });

    assert.deepEqual(JSON.parse(await readFile(pathname, "utf8")), { value: "new" });
    assert.deepEqual(await readdir(directory), ["state.json"]);
  });
});

test("writeJsonAtomic does not touch the destination when serialization fails", async () => {
  await withTemporaryDir(async (directory) => {
    const pathname = path.join(directory, "state.json");
    await writeFile(pathname, '{"value":"old"}\n', "utf8");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    await assert.rejects(writeJsonAtomic(pathname, cyclic), TypeError);

    assert.equal(await readFile(pathname, "utf8"), '{"value":"old"}\n');
    assert.deepEqual(await readdir(directory), ["state.json"]);
  });
});

test("writeJsonAtomic removes its temp file when rename fails", async () => {
  await withTemporaryDir(async (directory) => {
    const pathname = path.join(directory, "state.json");
    await mkdir(pathname);

    await assert.rejects(writeJsonAtomic(pathname, { value: "new" }));

    assert.deepEqual(await readdir(directory), ["state.json"]);
    assert.deepEqual(await readdir(pathname), []);
  });
});

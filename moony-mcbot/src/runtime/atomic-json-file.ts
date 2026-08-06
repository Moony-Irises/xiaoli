import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";

export async function writeJsonAtomic(pathname: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value, null, 2);
  if (typeof serialized !== "string") {
    throw new TypeError("JSON value cannot be serialized as a document");
  }

  const directory = path.dirname(pathname);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(pathname)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle: FileHandle | null = null;
  let renamed = false;

  try {
    await mkdir(directory, { recursive: true });
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(`${serialized}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, pathname);
    renamed = true;
  } finally {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    if (!renamed) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface PackageManifest {
  dependencies?: Record<string, string>;
  engines?: {
    node?: string;
  };
  scripts?: Record<string, string>;
}

interface PackageLockEntry {
  dependencies?: Record<string, string>;
  engines?: {
    node?: string;
  };
  version?: string;
}

interface PackageLock {
  packages?: Record<string, PackageLockEntry>;
}

interface TestTypeScriptConfig {
  extends?: string;
  compilerOptions?: {
    noEmit?: boolean;
  };
  include?: string[];
}

async function readProjectJson<T>(relativePath: string): Promise<T> {
  const fileUrl = new URL(`../${relativePath}`, import.meta.url);
  return JSON.parse(await readFile(fileUrl, "utf8")) as T;
}

test("default test command discovers every TypeScript test file", async () => {
  const packageManifest = await readProjectJson<PackageManifest>("package.json");

  assert.equal(packageManifest.scripts?.test, "tsx --test --import ./scripts/test-setup.ts");
});

test("typecheck command validates source and test projects", async () => {
  const packageManifest = await readProjectJson<PackageManifest>("package.json");

  assert.equal(packageManifest.scripts?.["typecheck:src"], "tsc -p tsconfig.json --noEmit");
  assert.equal(packageManifest.scripts?.["typecheck:test"], "tsc -p tsconfig.test.json --noEmit");
  assert.equal(
    packageManifest.scripts?.typecheck,
    "npm run typecheck:src && npm run typecheck:test"
  );
  assert.equal(packageManifest.scripts?.lint, "eslint src test scripts --max-warnings=0");
});

test("test TypeScript project includes every test file without emitting output", async () => {
  const testConfig = await readProjectJson<TestTypeScriptConfig>("tsconfig.test.json");

  assert.equal(testConfig.extends, "./tsconfig.json");
  assert.equal(testConfig.compilerOptions?.noEmit, true);
  assert.ok(testConfig.include?.includes("src/**/*.d.ts"));
  assert.ok(testConfig.include?.includes("scripts/**/*.ts"));
  assert.ok(testConfig.include?.includes("test/**/*.ts"));
});

test("release entry validation is exposed through npm and enforced by CI", async () => {
  const packageManifest = await readProjectJson<PackageManifest>("package.json");
  const workflow = await readFile(
    new URL("../../.github/workflows/moony-mcbot-ci.yml", import.meta.url),
    "utf8"
  );

  assert.equal(
    packageManifest.scripts?.["validate:releases"],
    "tsx scripts/release-entry-validator.ts"
  );
  assert.match(workflow, /name: Validate release entries\s+run: npm run validate:releases/u);
});

test("runtime version contract stays aligned across manifest, lockfile and CI", async () => {
  const packageManifest = await readProjectJson<PackageManifest>("package.json");
  const packageLock = await readProjectJson<PackageLock>("package-lock.json");
  const nvmVersion = (
    await readFile(new URL("../.nvmrc", import.meta.url), "utf8")
  ).trim();
  const workflow = await readFile(
    new URL("../../.github/workflows/moony-mcbot-ci.yml", import.meta.url),
    "utf8"
  );
  const rootLockEntry = packageLock.packages?.[""];
  const mineflayerLockEntry = packageLock.packages?.["node_modules/mineflayer"];
  const protocolLockEntry = packageLock.packages?.["node_modules/minecraft-protocol"];

  assert.equal(packageManifest.engines?.node, ">=22");
  assert.equal(packageManifest.dependencies?.mineflayer, "4.35.0");
  assert.equal(rootLockEntry?.engines?.node, ">=22");
  assert.equal(rootLockEntry?.dependencies?.mineflayer, "4.35.0");
  assert.equal(mineflayerLockEntry?.version, "4.35.0");
  assert.equal(mineflayerLockEntry?.engines?.node, ">=22");
  assert.equal(protocolLockEntry?.engines?.node, ">=22");
  assert.equal(nvmVersion, "22");
  assert.match(workflow, /node-version: \["22\.x", "24\.x"\]/u);
  assert.match(workflow, /node-version: \$\{\{ matrix\.node-version \}\}/u);
  assert.doesNotMatch(workflow, /node-version: "20\.x"/u);
});

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  runReleaseEntryValidation,
  validateReleaseEntriesDirectory,
  validateReleaseEntryText
} from "../scripts/release-entry-validator.js";

const VALID_FILE_NAME = "2026-08-03-ci-release-validation.md";

function validEntry(testsField = "tests: npm test"): string {
  return `---
type: test
scope: ci
audience: developer
summary: Validate unreleased entry contracts
breaking: false
demo_ready: false
${testsField}
artifacts:
  - scripts/release-entry-validator.ts
---

## What changed

Added deterministic validation.

## Why it matters

Malformed release facts fail before publication.

## Demo posture / limitations

This is not a published release.
`;
}

function issueKeys(issues: ReturnType<typeof validateReleaseEntryText>): string[] {
  return issues.map((issue) => `${issue.code}:${issue.field ?? "-"}`);
}

test("release entry validator accepts scalar and list test commands", () => {
  assert.deepEqual(validateReleaseEntryText(VALID_FILE_NAME, validEntry()), []);
  assert.deepEqual(validateReleaseEntryText(
    VALID_FILE_NAME,
    validEntry("tests:\n  - npm run lint\n  - npm test")
  ), []);
});

test("release entry validator requires the filename scope to match frontmatter", () => {
  const keys = issueKeys(validateReleaseEntryText(
    "2026-08-03-runtime-release-validation.md",
    validEntry()
  ));

  assert.ok(keys.includes("filename_scope_mismatch:scope"));
});

test("release entry validator rejects invalid names, fields, booleans, and empty lists", () => {
  const invalidEntry = validEntry()
    .replace("type: test", "type: bugfix")
    .replace("scope: ci", "scope: api")
    .replace("audience: developer", "audience: team")
    .replace("summary: Validate unreleased entry contracts", "summary:")
    .replace("breaking: false", "breaking: \"false\"")
    .replace("tests: npm test", "tests:")
    .replace("  - scripts/release-entry-validator.ts", "")
    .replace("demo_ready: false", "demo_ready: false\nowner: McBot");
  const issues = validateReleaseEntryText("2026-02-30-api-Bad_Name.md", invalidEntry);
  const keys = issueKeys(issues);

  assert.ok(keys.includes("invalid_filename:-"));
  assert.ok(keys.includes("invalid_field:type"));
  assert.ok(keys.includes("invalid_field:scope"));
  assert.ok(keys.includes("invalid_field:audience"));
  assert.ok(keys.includes("invalid_field:summary"));
  assert.ok(keys.includes("invalid_field:breaking"));
  assert.ok(keys.includes("invalid_field:tests"));
  assert.ok(keys.includes("invalid_field:artifacts"));
  assert.ok(keys.includes("unknown_field:owner"));
});

test("release entry validator rejects duplicate fields and malformed frontmatter lines", () => {
  const invalidEntry = validEntry()
    .replace("scope: ci", "scope: ci\nscope: docs")
    .replace("  - scripts/release-entry-validator.ts", " - scripts/release-entry-validator.ts");
  const keys = issueKeys(validateReleaseEntryText(VALID_FILE_NAME, invalidEntry));

  assert.ok(keys.includes("duplicate_field:scope"));
  assert.ok(keys.includes("invalid_frontmatter:-"));
});

test("release entry validator reports missing required fields", () => {
  const keys = issueKeys(validateReleaseEntryText(
    VALID_FILE_NAME,
    validEntry().replace("demo_ready: false\n", "")
  ));

  assert.ok(keys.includes("missing_field:demo_ready"));
});

test("release entry validator requires ordered non-empty body sections", () => {
  const invalidEntry = validEntry()
    .replace("Added deterministic validation.", "")
    .replace("## Why it matters", "## Other section");
  const keys = issueKeys(validateReleaseEntryText(VALID_FILE_NAME, invalidEntry));

  assert.ok(keys.includes("empty_section:What changed"));
  assert.ok(keys.includes("missing_section:Why it matters"));

  const reorderedKeys = issueKeys(validateReleaseEntryText(
    VALID_FILE_NAME,
    validEntry()
      .replace("## What changed", "## TEMP")
      .replace("## Why it matters", "## What changed")
      .replace("## TEMP", "## Why it matters")
  ));
  assert.ok(reorderedKeys.includes("invalid_section_order:-"));
});

test("release entry directory validation reports invalid markdown and ignores other files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcbot-release-entry-test-"));
  try {
    await writeFile(path.join(directory, VALID_FILE_NAME), validEntry(), "utf8");
    await writeFile(path.join(directory, "2026-08-03-runtime-invalid.md"), "missing frontmatter", "utf8");
    await writeFile(path.join(directory, "notes.txt"), "ignored", "utf8");

    const report = await validateReleaseEntriesDirectory(directory);

    assert.equal(report.fileCount, 2);
    assert.equal(report.issues.length, 1);
    assert.equal(report.issues[0]?.fileName, "2026-08-03-runtime-invalid.md");
    assert.equal(report.issues[0]?.code, "invalid_frontmatter");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release entry CLI runner returns a failing code and grouped diagnostics", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcbot-release-cli-test-"));
  const output: string[] = [];
  const errors: string[] = [];
  try {
    await writeFile(path.join(directory, "invalid.md"), "invalid", "utf8");

    const exitCode = await runReleaseEntryValidation(directory, {
      log: (message) => output.push(message),
      error: (message) => errors.push(message)
    });

    assert.equal(exitCode, 1);
    assert.deepEqual(output, []);
    assert.equal(errors.length, 2);
    assert.match(errors[0] ?? "", /invalid\.md \[invalid_filename\]/u);
    assert.match(errors[1] ?? "", /invalid\.md \[invalid_frontmatter\]/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("all repository unreleased entries satisfy the release contract", async () => {
  const directory = path.resolve(import.meta.dirname, "..", "docs", "releases", "unreleased");
  const report = await validateReleaseEntriesDirectory(directory);

  assert.ok(report.fileCount > 0);
  assert.deepEqual(report.issues, []);
});

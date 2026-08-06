import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_FIELDS = [
  "type",
  "scope",
  "audience",
  "summary",
  "breaking",
  "demo_ready",
  "tests",
  "artifacts"
] as const;

const ALLOWED_TYPES = new Set(["feature", "fix", "docs", "refactor", "test", "chore"]);
const ALLOWED_SCOPES = new Set(["demo", "plugin", "runtime", "outbound", "workspace", "exec", "docs", "ci"]);
const ALLOWED_AUDIENCES = new Set(["public", "developer", "internal"]);
const REQUIRED_SECTIONS = ["What changed", "Why it matters", "Demo posture / limitations"] as const;
const FILE_NAME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})-([a-z0-9]+)(?:-[a-z0-9]+)*\.md$/u;

type ReleaseEntryField = typeof REQUIRED_FIELDS[number];
type FrontmatterValue = string | string[];

export type ReleaseEntryIssueCode =
  | "invalid_filename"
  | "filename_scope_mismatch"
  | "invalid_frontmatter"
  | "duplicate_field"
  | "unknown_field"
  | "missing_field"
  | "invalid_field"
  | "missing_section"
  | "empty_section"
  | "invalid_section_order";

export interface ReleaseEntryIssue {
  fileName: string;
  code: ReleaseEntryIssueCode;
  message: string;
  field?: string;
}

export interface ReleaseEntryValidationReport {
  fileCount: number;
  issues: ReleaseEntryIssue[];
}

export interface ReleaseEntryValidationOutput {
  log(message: string): void;
  error(message: string): void;
}

interface ParsedReleaseEntry {
  fields: Map<string, FrontmatterValue>;
  body: string;
  issues: ReleaseEntryIssue[];
}

function createIssue(
  fileName: string,
  code: ReleaseEntryIssueCode,
  message: string,
  field?: string
): ReleaseEntryIssue {
  return field ? { fileName, code, message, field } : { fileName, code, message };
}

function isValidCalendarDate(yearText: string, monthText: string, dayText: string): boolean {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year
    && value.getUTCMonth() === month - 1
    && value.getUTCDate() === day;
}

function validateFileName(fileName: string): ReleaseEntryIssue[] {
  const match = FILE_NAME_PATTERN.exec(fileName);
  if (!match || !isValidCalendarDate(match[1] ?? "", match[2] ?? "", match[3] ?? "")) {
    return [createIssue(
      fileName,
      "invalid_filename",
      "Expected YYYY-MM-DD-<scope>-<slug>.md with a real calendar date"
    )];
  }
  return [];
}

function parseReleaseEntry(fileName: string, source: string): ParsedReleaseEntry | null {
  const normalized = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/u.exec(normalized);
  if (!match) return null;

  const fields = new Map<string, FrontmatterValue>();
  const issues: ReleaseEntryIssue[] = [];
  let currentListField: string | null = null;

  for (const [index, line] of (match[1] ?? "").split("\n").entries()) {
    if (!line.trim()) continue;

    const fieldMatch = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/u.exec(line);
    if (fieldMatch) {
      const field = fieldMatch[1] ?? "";
      const scalarValue = (fieldMatch[2] ?? "").trim();
      currentListField = scalarValue ? null : field;
      if (fields.has(field)) {
        issues.push(createIssue(fileName, "duplicate_field", `Duplicate frontmatter field at line ${index + 2}`, field));
        continue;
      }
      fields.set(field, scalarValue || []);
      continue;
    }

    const listMatch = /^ {2}-\s+(.+)$/u.exec(line);
    if (listMatch && currentListField) {
      const value = (listMatch[1] ?? "").trim();
      const currentValue = fields.get(currentListField);
      if (Array.isArray(currentValue) && value) {
        currentValue.push(value);
        continue;
      }
    }

    currentListField = null;
    issues.push(createIssue(
      fileName,
      "invalid_frontmatter",
      `Unsupported frontmatter syntax at line ${index + 2}`
    ));
  }

  return { fields, body: match[2] ?? "", issues };
}

function validateScalarField(
  fileName: string,
  fields: Map<string, FrontmatterValue>,
  field: ReleaseEntryField,
  allowedValues?: ReadonlySet<string>
): ReleaseEntryIssue[] {
  const value = fields.get(field);
  if (typeof value !== "string" || !value.trim() || (allowedValues && !allowedValues.has(value))) {
    return [createIssue(fileName, "invalid_field", "Expected a non-empty allowed scalar value", field)];
  }
  return [];
}

function validateBooleanField(
  fileName: string,
  fields: Map<string, FrontmatterValue>,
  field: "breaking" | "demo_ready"
): ReleaseEntryIssue[] {
  const value = fields.get(field);
  if (value !== "true" && value !== "false") {
    return [createIssue(fileName, "invalid_field", "Expected unquoted true or false", field)];
  }
  return [];
}

function validateCommandField(fileName: string, fields: Map<string, FrontmatterValue>): ReleaseEntryIssue[] {
  const value = fields.get("tests");
  const valid = typeof value === "string"
    ? !!value.trim()
    : Array.isArray(value) && value.length > 0 && value.every((item) => !!item.trim());
  return valid
    ? []
    : [createIssue(fileName, "invalid_field", "Expected one command or a non-empty command list", "tests")];
}

function validateArtifactsField(fileName: string, fields: Map<string, FrontmatterValue>): ReleaseEntryIssue[] {
  const value = fields.get("artifacts");
  const valid = Array.isArray(value) && value.length > 0 && value.every((item) => !!item.trim());
  return valid
    ? []
    : [createIssue(fileName, "invalid_field", "Expected a non-empty artifact list", "artifacts")];
}

function validateBodySections(fileName: string, body: string): ReleaseEntryIssue[] {
  const issues: ReleaseEntryIssue[] = [];
  const headings = [...body.matchAll(/^## (.+?)\s*$/gmu)].map((match) => ({
    name: match[1] ?? "",
    index: match.index,
    contentStart: (match.index ?? 0) + match[0].length
  }));
  const requiredHeadings = REQUIRED_SECTIONS.map((name) => headings.find((heading) => heading.name === name));

  for (const [index, heading] of requiredHeadings.entries()) {
    const sectionName = REQUIRED_SECTIONS[index] ?? "";
    if (!heading) {
      issues.push(createIssue(fileName, "missing_section", `Missing required section: ${sectionName}`, sectionName));
      continue;
    }
    const nextHeading = headings.find((candidate) => candidate.index > heading.index);
    const content = body.slice(heading.contentStart, nextHeading?.index ?? body.length).trim();
    if (!content) {
      issues.push(createIssue(fileName, "empty_section", `Required section is empty: ${sectionName}`, sectionName));
    }
  }

  const presentRequiredHeadings = requiredHeadings.filter((heading): heading is NonNullable<typeof heading> => !!heading);
  if (presentRequiredHeadings.length === REQUIRED_SECTIONS.length) {
    const ordered = presentRequiredHeadings.every((heading, index) => index === 0 || heading.index > presentRequiredHeadings[index - 1]!.index);
    if (!ordered) {
      issues.push(createIssue(fileName, "invalid_section_order", "Required body sections are out of order"));
    }
  }
  return issues;
}

export function validateReleaseEntryText(fileName: string, source: string): ReleaseEntryIssue[] {
  const issues = validateFileName(fileName);
  const parsed = parseReleaseEntry(fileName, source);
  if (!parsed) {
    issues.push(createIssue(fileName, "invalid_frontmatter", "Expected a frontmatter block at the start of the file"));
    return issues;
  }
  issues.push(...parsed.issues);

  const knownFields = new Set<string>(REQUIRED_FIELDS);
  for (const field of parsed.fields.keys()) {
    if (!knownFields.has(field)) {
      issues.push(createIssue(fileName, "unknown_field", "Unknown frontmatter field", field));
    }
  }
  for (const field of REQUIRED_FIELDS) {
    if (!parsed.fields.has(field)) {
      issues.push(createIssue(fileName, "missing_field", "Missing required frontmatter field", field));
    }
  }

  if (parsed.fields.has("type")) issues.push(...validateScalarField(fileName, parsed.fields, "type", ALLOWED_TYPES));
  if (parsed.fields.has("scope")) issues.push(...validateScalarField(fileName, parsed.fields, "scope", ALLOWED_SCOPES));
  if (parsed.fields.has("audience")) issues.push(...validateScalarField(fileName, parsed.fields, "audience", ALLOWED_AUDIENCES));
  if (parsed.fields.has("summary")) issues.push(...validateScalarField(fileName, parsed.fields, "summary"));
  if (parsed.fields.has("breaking")) issues.push(...validateBooleanField(fileName, parsed.fields, "breaking"));
  if (parsed.fields.has("demo_ready")) issues.push(...validateBooleanField(fileName, parsed.fields, "demo_ready"));
  if (parsed.fields.has("tests")) issues.push(...validateCommandField(fileName, parsed.fields));
  if (parsed.fields.has("artifacts")) issues.push(...validateArtifactsField(fileName, parsed.fields));
  const fileNameMatch = FILE_NAME_PATTERN.exec(fileName);
  const scope = parsed.fields.get("scope");
  if (fileNameMatch && typeof scope === "string" && ALLOWED_SCOPES.has(scope) && fileNameMatch[4] !== scope) {
    issues.push(createIssue(
      fileName,
      "filename_scope_mismatch",
      `Filename scope '${fileNameMatch[4]}' does not match frontmatter scope '${scope}'`,
      "scope"
    ));
  }
  issues.push(...validateBodySections(fileName, parsed.body));
  return issues;
}

export async function validateReleaseEntriesDirectory(directory: string): Promise<ReleaseEntryValidationReport> {
  const entries = await readdir(directory, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const issues: ReleaseEntryIssue[] = [];
  for (const fileName of fileNames) {
    const source = await readFile(path.join(directory, fileName), "utf8");
    issues.push(...validateReleaseEntryText(fileName, source));
  }
  return { fileCount: fileNames.length, issues };
}

function formatIssue(issue: ReleaseEntryIssue): string {
  const field = issue.field ? ` ${issue.field}:` : "";
  return `${issue.fileName} [${issue.code}]${field} ${issue.message}`;
}

export async function runReleaseEntryValidation(
  directory: string,
  output: ReleaseEntryValidationOutput = {
    log: (message) => console.log(message),
    error: (message) => console.error(message)
  }
): Promise<number> {
  const report = await validateReleaseEntriesDirectory(directory);
  if (report.issues.length > 0) {
    for (const issue of report.issues) output.error(formatIssue(issue));
    return 1;
  }
  output.log(`Validated ${report.fileCount} unreleased entries.`);
  return 0;
}

const defaultDirectory = fileURLToPath(new URL("../docs/releases/unreleased", import.meta.url));
const entryPath = process.argv[1];
if (entryPath && pathToFileURL(path.resolve(entryPath)).href === import.meta.url) {
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : defaultDirectory;
  void runReleaseEntryValidation(directory)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

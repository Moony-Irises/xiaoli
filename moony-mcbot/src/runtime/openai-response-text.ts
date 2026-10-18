export function extractAiText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const record = part as Record<string, unknown>;
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      return "";
    })
    .join("")
    .trim();
}

export function summarizeEmptyAiChoice(choice: unknown): string {
  if (!choice || typeof choice !== "object") return "choice=missing";
  const record = choice as Record<string, unknown>;
  const message = record.message && typeof record.message === "object" ? (record.message as Record<string, unknown>) : {};
  const messageKeys = Object.keys(message);
  const content = message.content;
  const contentType = Array.isArray(content) ? "array" : typeof content;
  const reasoning = typeof message.reasoning_content === "string" ? message.reasoning_content.trim() : "";
  const text = typeof record.text === "string" ? record.text.trim() : "";
  return [
    `finish_reason=${String(record.finish_reason ?? "unknown")}`,
    `message_keys=${messageKeys.length > 0 ? messageKeys.join(",") : "none"}`,
    `content_type=${contentType}`,
    `has_reasoning_content=${reasoning.length > 0}`,
    `has_choice_text=${text.length > 0}`
  ].join("; ");
}

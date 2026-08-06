import { fetchTextWithTimeout } from "./ai-request.js";

export interface OpenAiChatCompletionsRequest {
  apiBaseUrl: string;
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface OpenAiChatCompletionsResponse {
  endpoint: string;
  response: Response;
  rawBody: string;
}

export function buildOpenAiChatCompletionsEndpoint(apiBaseUrl: string): string {
  const baseUrl = apiBaseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) return "https://api.openai.com/v1/chat/completions";

  try {
    const url = new URL(baseUrl);
    if (/\/chat\/completions$/i.test(url.pathname)) return baseUrl;
    const hasVersionSegment = /^\/v\d+(\/|$)/i.test(url.pathname);
    return hasVersionSegment ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
  } catch {
    return `${baseUrl}/chat/completions`;
  }
}

export async function postOpenAiChatCompletions(
  request: OpenAiChatCompletionsRequest
): Promise<OpenAiChatCompletionsResponse> {
  const endpoint = buildOpenAiChatCompletionsEndpoint(request.apiBaseUrl);
  const { response, text: rawBody } = await fetchTextWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`
    },
    body: JSON.stringify(request.body)
  }, { timeoutMs: request.timeoutMs, signal: request.signal });

  return { endpoint, response, rawBody };
}

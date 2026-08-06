import { timingSafeEqual } from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import { BotRegistry } from "../runtime/bot-registry.js";
import { log } from "../logger.js";
import {
  projectDiagnosticRecord,
  projectDiagnosticValue,
  redactDiagnosticText
} from "../utils/diagnostic-redaction.js";
import {
  debugAdvanceStrategicGoal,
  debugAttackNearestEntity,
  debugCapturePlaceHere,
  debugClearStrategicGoal,
  debugEatFood,
  debugEnableChatAi,
  debugEnableHiReply,
  debugOpenDoor,
  debugReloadPromptProfile,
  debugRewindStrategicGoal,
  debugRunAgentOnce,
  debugSetStrategicGoal,
  debugStopFollow,
  debugUseHeldItem,
  getAgentExecutionTraceForDebug,
  getAgentMemoryStatusForDebug,
  getAgentRecentEventsForDebug,
  getAgentStateSnapshotForDebug,
  getAgentStatusForDebug,
  getChatAiStatusForDebug,
  getChatListenerStatusForDebug,
  getCommandInvocationHistoryForDebug,
  getObserveSnapshotForDebug,
  getPromptProfileStatusForDebug,
  getSharedChatMemoryStatusForDebug,
  getSharedGameMemoryStatusForDebug,
  getTerritoryStatusForDebug
} from "../tools/action-tools.js";

interface DebugActionHistoryEntry {
  id: number;
  timestamp: string;
  botId: string | null;
  action: string;
  ok: boolean;
  payload: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

const debugActionHistory: DebugActionHistoryEntry[] = [];
let nextDebugActionId = 1;
const DEFAULT_DEBUG_MAX_BODY_BYTES = 64 * 1024;
const MAX_DEBUG_BODY_BYTES = 1024 * 1024;

class DebugRequestError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
    this.name = "DebugRequestError";
  }
}

function recordDebugAction(entry: Omit<DebugActionHistoryEntry, "id" | "timestamp">): DebugActionHistoryEntry {
  const recorded: DebugActionHistoryEntry = {
    id: nextDebugActionId,
    timestamp: new Date().toISOString(),
    botId: entry.botId,
    action: entry.action,
    ok: entry.ok,
    payload: projectDiagnosticRecord(entry.payload),
    ...(entry.result === undefined
      ? {}
      : { result: projectDiagnosticValue(entry.result) }),
    ...(entry.error === undefined
      ? {}
      : { error: redactDiagnosticText(entry.error) })
  };
  nextDebugActionId += 1;
  debugActionHistory.push(recorded);
  if (debugActionHistory.length > 80) {
    debugActionHistory.splice(0, debugActionHistory.length - 80);
  }
  log(recorded.ok ? "info" : "warn", recorded.ok ? "Debug action completed" : "Debug action failed", {
    id: recorded.id,
    botId: recorded.botId ?? undefined,
    action: recorded.action,
    error: recorded.error
  });
  return recorded;
}

function clearDebugActionHistoryForBot(botId: string): number {
  let clearedCount = 0;
  for (let index = debugActionHistory.length - 1; index >= 0; index -= 1) {
    if (debugActionHistory[index]?.botId === botId) {
      debugActionHistory.splice(index, 1);
      clearedCount += 1;
    }
  }
  return clearedCount;
}

function readEnabled(): boolean {
  const raw = process.env.MCBOT_DEBUG_WEB_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !["0", "false", "no", "off"].includes(raw);
}

function readHost(): string {
  return process.env.MCBOT_DEBUG_WEB_HOST?.trim() || "127.0.0.1";
}

function readPort(): number {
  const raw = process.env.MCBOT_DEBUG_WEB_PORT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 4637;
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) return 4637;
  return parsed;
}

function readAuthToken(): string {
  return process.env.MCBOT_DEBUG_WEB_AUTH_TOKEN?.trim() || "";
}

function readMaxBodyBytes(): number {
  const raw = process.env.MCBOT_DEBUG_WEB_MAX_BODY_BYTES?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_DEBUG_MAX_BODY_BYTES;
  if (!Number.isFinite(parsed) || parsed < 1024) return DEFAULT_DEBUG_MAX_BODY_BYTES;
  return Math.min(Math.trunc(parsed), MAX_DEBUG_BODY_BYTES);
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

function readAllowedOrigins(host: string, port: number): Set<string> {
  const configured = process.env.MCBOT_DEBUG_WEB_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return new Set(configured);

  return new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://[::1]:${port}`,
    `http://${host}:${port}`
  ]);
}

function hasValidDebugToken(req: http.IncomingMessage, expectedToken: string): boolean {
  if (!expectedToken) return true;
  const authorization = req.headers.authorization?.trim() || "";
  const headerToken = req.headers["x-mcbot-debug-token"]?.toString().trim() || "";
  const providedToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : headerToken;
  if (!providedToken) return false;

  const expected = Buffer.from(expectedToken, "utf8");
  const provided = Buffer.from(providedToken, "utf8");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function isAllowedDebugOrigin(req: http.IncomingMessage, allowedOrigins: Set<string>): boolean {
  const origin = req.headers.origin?.trim();
  return !origin || allowedOrigins.has(origin);
}

function authorizeDebugApiRequest(
  req: http.IncomingMessage,
  expectedToken: string,
  allowedOrigins: Set<string>
): { statusCode: number; error: string } | null {
  if (!isAllowedDebugOrigin(req, allowedOrigins)) {
    return { statusCode: 403, error: "origin_not_allowed" };
  }
  if (!hasValidDebugToken(req, expectedToken)) {
    return { statusCode: 401, error: "debug_web_auth_required" };
  }
  return null;
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res: http.ServerResponse, html: string): void {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  });
  res.end(html);
}

async function readJsonBody(req: http.IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBodyBytes) {
      req.resume();
      throw new DebugRequestError(413, `request_body_too_large_max_${maxBodyBytes}_bytes`);
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DebugRequestError(400, "invalid_json_body");
  }
}

export function buildDebugHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Moony MCBot Debug</title>
  <style>
    :root {
      --bg: #f6efe2;
      --paper: #fffaf0;
      --panel: #ffffff;
      --panel-2: #edf7f3;
      --text: #20302d;
      --muted: #6f7d78;
      --accent: #087f68;
      --accent-2: #d97706;
      --border: #d9e2dc;
      --shadow: rgba(34, 51, 47, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(8,127,104,0.16), transparent 34rem),
        radial-gradient(circle at top right, rgba(217,119,6,0.14), transparent 30rem),
        linear-gradient(180deg, #fffbf1 0%, var(--bg) 100%);
      color: var(--text);
    }
    .wrap {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    .toolbar {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
      flex-wrap: wrap;
      margin-bottom: 18px;
      position: sticky;
      top: 0;
      z-index: 10;
      padding: 12px 0 14px;
      background: linear-gradient(180deg, rgba(255,251,241,0.96) 0%, rgba(255,251,241,0.88) 100%);
      backdrop-filter: blur(10px);
    }
    .toolbar-top {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 220px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.02em;
    }
    .brand-subtitle {
      color: var(--muted);
      font-size: 12px;
    }
    select, button, textarea {
      background: var(--panel);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 10px 12px;
      border-radius: 999px;
      box-shadow: 0 4px 12px var(--shadow);
    }
    textarea {
      border-radius: 16px;
    }
    button {
      cursor: pointer;
      font-weight: 700;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    }
    button:hover {
      background: var(--panel-2);
      border-color: rgba(8,127,104,0.45);
      transform: translateY(-1px);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .action-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px;
      border: 1px solid rgba(217,226,220,0.9);
      border-radius: 18px;
      background: rgba(255,255,255,0.62);
      box-shadow: 0 4px 14px rgba(34, 51, 47, 0.08);
    }
    .group-title {
      color: var(--accent);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 0 4px;
      white-space: nowrap;
    }
    .danger-group {
      border-color: rgba(217,119,6,0.28);
      background: rgba(255,246,226,0.78);
    }
    .danger-group .group-title { color: #a54b0a; }
    .danger-button {
      color: #8d3c08;
      border-color: rgba(180,83,9,0.44);
      background: #fff0d5;
    }
    .danger-button:hover {
      color: #6f2f07;
      border-color: #b45309;
      background: #ffe2b5;
    }
    .action-result {
      margin-bottom: 16px;
      border: 1px solid var(--border);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.84);
      box-shadow: 0 16px 40px var(--shadow);
      overflow: hidden;
    }
    .action-result .title {
      padding: 10px 14px;
      color: var(--accent);
      background: linear-gradient(90deg, rgba(237,247,243,0.95), rgba(255,246,226,0.95));
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .action-result .title button {
      padding: 6px 8px;
      font-size: 12px;
    }
    .action-result pre {
      max-height: 220px;
      overflow: auto;
    }
    .raw-runner {
      margin-bottom: 16px;
      border: 1px solid var(--border);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.84);
      box-shadow: 0 16px 40px var(--shadow);
      overflow: hidden;
    }
    .raw-runner details {
      height: 100%;
    }
    .raw-runner summary {
      list-style: none;
      margin: 0;
      padding: 12px 14px;
      color: var(--accent);
      background: linear-gradient(90deg, rgba(237,247,243,0.95), rgba(255,246,226,0.95));
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      user-select: none;
    }
    .raw-runner summary::-webkit-details-marker { display: none; }
    .raw-runner-body {
      display: grid;
      grid-template-columns: minmax(180px, 260px) 1fr;
      gap: 12px;
      padding: 14px;
    }
    .raw-runner-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }
    .raw-runner label {
      color: var(--muted);
      font-size: 12px;
    }
    .raw-runner textarea {
      width: 100%;
      min-height: 180px;
      font-family: "Consolas", "SFMono-Regular", monospace;
      resize: vertical;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .summary-card {
      position: relative;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 14px 16px;
      box-shadow: 0 12px 30px var(--shadow);
      overflow: hidden;
    }
    .summary-card[data-panel-target] {
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .summary-card[data-panel-target]:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 34px rgba(34, 51, 47, 0.16);
    }
    .summary-card[data-panel-target]:focus-visible {
      outline: 3px solid rgba(8,127,104,0.36);
      outline-offset: 3px;
    }
    .summary-card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 5px;
      background: #a0aaa5;
    }
    .summary-card[data-state="ready"]::before { background: var(--accent); }
    .summary-card[data-state="active"]::before { background: var(--accent-2); }
    .summary-card[data-state="waiting"]::before { background: #8a9891; }
    .summary-card[data-state="error"]::before { background: #c2410c; }
    .summary-card[data-state="ready"] { border-color: rgba(8,127,104,0.3); }
    .summary-card[data-state="active"] { border-color: rgba(217,119,6,0.36); }
    .summary-card[data-state="error"] { border-color: rgba(194,65,12,0.4); }
    .summary-card-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .summary-card .label {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .summary-chip {
      flex: 0 0 auto;
      padding: 3px 7px;
      border: 1px solid rgba(111,125,120,0.3);
      border-radius: 999px;
      color: var(--muted);
      background: #f5f7f4;
      font-size: 10px;
      font-weight: 800;
    }
    .summary-card[data-state="ready"] .summary-chip {
      color: #066452;
      border-color: rgba(8,127,104,0.28);
      background: #e4f5ef;
    }
    .summary-card[data-state="active"] .summary-chip {
      color: #92520a;
      border-color: rgba(217,119,6,0.3);
      background: #fff1d8;
    }
    .summary-card[data-state="error"] .summary-chip {
      color: #a33d0c;
      border-color: rgba(194,65,12,0.3);
      background: #fff0e9;
    }
    .summary-card .value {
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
    }
    .summary-card .sub {
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    .panel {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid var(--border);
      border-radius: 22px;
      overflow: hidden;
      min-height: 80px;
      box-shadow: 0 12px 30px var(--shadow);
      scroll-margin-top: 150px;
    }
    .panel details {
      height: 100%;
    }
    .panel summary {
      list-style: none;
      margin: 0;
      padding: 14px 16px;
      font-size: 14px;
      color: var(--accent);
      background: linear-gradient(90deg, rgba(237,247,243,0.95), rgba(255,246,226,0.95));
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid transparent;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .panel summary::-webkit-details-marker { display: none; }
    .panel summary::after {
      content: "▸";
      color: var(--muted);
      transition: transform 120ms ease;
    }
    .panel details[open] summary {
      border-bottom-color: var(--border);
    }
    .panel details[open] summary::after {
      transform: rotate(90deg);
    }
    pre {
      margin: 0;
      padding: 16px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      line-height: 1.45;
      color: var(--text);
      font-family: "Consolas", "SFMono-Regular", monospace;
    }
    dialog {
      width: min(620px, calc(100vw - 32px));
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0;
      color: var(--text);
      background: var(--panel);
      box-shadow: 0 24px 64px rgba(26, 39, 35, 0.24);
    }
    dialog::backdrop { background: rgba(23, 33, 30, 0.36); }
    .goal-dialog-form { display: grid; gap: 14px; padding: 20px; }
    .goal-dialog-title { margin: 0; font-size: 18px; }
    .goal-dialog-hint { margin: -6px 0 0; color: var(--muted); font-size: 13px; }
    .goal-dialog-guide { margin: -2px 0 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
    .goal-dialog-guide strong { color: var(--text); }
    .goal-dialog-example {
      margin: 0;
      padding: 10px 12px;
      border-left: 3px solid var(--accent);
      color: var(--text);
      background: rgba(83, 137, 107, 0.08);
      font: 12px/1.55 "Consolas", "SFMono-Regular", monospace;
      white-space: pre-wrap;
    }
    .goal-dialog-form label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; }
    .goal-dialog-form input, .goal-dialog-form textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 9px 10px;
      color: var(--text);
      background: #fffdf8;
      font: inherit;
    }
    .goal-dialog-form textarea { min-height: 92px; resize: vertical; }
    .goal-dialog-meta { display: grid; grid-template-columns: minmax(0, 1fr) 130px; gap: 12px; }
    .goal-dialog-bot { color: var(--accent); font-family: "Consolas", "SFMono-Regular", monospace; }
    .goal-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    .status {
      color: var(--muted);
      font-size: 12px;
      margin-left: auto;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(255,255,255,0.72);
      box-shadow: 0 4px 12px rgba(34, 51, 47, 0.06);
    }
    @media (max-width: 1100px) {
      .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 960px) {
      .grid { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
      .raw-runner-body { grid-template-columns: 1fr; }
      .toolbar-top { align-items: stretch; }
      .action-group { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="toolbar">
      <div class="toolbar-top">
        <div class="brand">
          <div class="brand-title">小狸控制台</div>
          <div class="brand-subtitle">Moony MCBot Debug Panel</div>
        </div>
        <span class="status" id="status-text">加载中 loading...</span>
      </div>
      <div class="actions">
        <div class="action-group">
          <span class="group-title">状态 Status</span>
          <label for="bot-select">Bot / 机器人</label>
          <select id="bot-select"></select>
          <button id="refresh-btn" title="刷新所有状态">刷新 Refresh</button>
          <button id="toggle-auto-refresh-btn" title="暂停或恢复页面自动刷新">暂停刷新 Pause</button>
          <button id="refresh-observe-btn" title="刷新观察快照">刷新观察 Observe</button>
          <button id="expand-panels-btn" title="展开全部板块">展开全部 Expand</button>
          <button id="collapse-panels-btn" title="折叠全部板块">折叠全部 Collapse</button>
        </div>
        <div class="action-group">
          <span class="group-title">历史 History</span>
          <button id="copy-action-history-btn" title="复制动作历史">复制历史 Copy History</button>
          <button id="download-action-history-btn" title="下载动作历史 JSON">下载历史 Download</button>
          <button id="clear-action-history-btn" title="清空当前 bot 的动作历史">清空历史 Clear</button>
          <button id="copy-debug-snapshot-btn" title="复制完整调试快照">复制快照 Copy Snapshot</button>
          <button id="download-debug-snapshot-btn" title="下载完整调试快照">下载快照 Download</button>
        </div>
        <div class="action-group">
          <span class="group-title">目标 Goal</span>
          <button id="set-goal-btn" title="设置战略目标">设目标 Set Goal</button>
          <button id="advance-goal-btn" title="推进当前里程碑">推进目标 Advance</button>
          <button id="rewind-goal-btn" title="回退当前里程碑">回退目标 Rewind</button>
          <button id="clear-goal-btn" title="清空战略目标">清目标 Clear Goal</button>
          <button id="run-once-btn" title="手动跑一次 agent planner">跑一次 Run Once</button>
        </div>
        <div class="action-group">
          <span class="group-title">聊天 Chat</span>
          <button id="reload-prompt-profile-btn" title="重载小狸提示词文件">重载提示词 Reload Prompt</button>
          <button id="enable-hi-reply-btn" title="启用 hi小狸 -> hihi 固定回复">启用 hi 回复</button>
          <button id="enable-ai-chat-btn" title="启用游戏内 AI 闲聊">启用 AI 闲聊</button>
        </div>
        <div class="action-group">
          <span class="group-title">物品 Item</span>
          <button id="hold-slot-btn" title="切换快捷栏槽位">切槽 Hold Slot</button>
          <button id="hold-category-btn" title="按类别拿物品">拿类别 Hold Category</button>
          <button id="eat-food-btn" title="尝试吃食物">吃东西 Eat</button>
        </div>
        <div class="action-group">
          <span class="group-title">交互 Interact</span>
          <button id="right-click-btn" title="右键方块或使用手持物">右键 Right Click</button>
          <button id="open-door-btn" title="尝试开附近的门">开门 Open Door</button>
          <button id="stop-follow-btn" title="停止跟随">停跟随 Stop Follow</button>
          <button id="capture-place-btn" title="记录当前位置">记录地点 Capture Place</button>
        </div>
        <div class="action-group danger-group">
          <span class="group-title">危险 Danger</span>
          <button id="attack-nearest-btn" class="danger-button" title="攻击最近的非玩家实体，可能攻击动物或怪物">攻击最近实体 Attack</button>
        </div>
      </div>
    </div>
    <section class="action-result">
      <div class="title">
        <span>最近动作结果 Last Action Result</span>
        <button id="copy-action-result-btn" title="复制最近动作结果">复制结果 Copy</button>
      </div>
      <pre id="action-result">还没有动作 No action yet.</pre>
    </section>
    <section class="raw-runner">
      <details>
        <summary>JSON 动作执行器 Raw Action Runner</summary>
        <div class="raw-runner-body">
          <div class="raw-runner-controls">
            <label for="raw-action-select">动作接口 Action endpoint</label>
            <select id="raw-action-select"></select>
            <button id="raw-action-template-btn" title="载入示例 JSON">载入模板 Load Template</button>
            <button id="raw-action-copy-json-btn" title="复制当前 JSON 参数">复制 JSON</button>
            <button id="raw-action-run-btn" title="执行当前 JSON 动作">执行 JSON Run</button>
            <label>
              <input id="raw-action-inject-bot" type="checkbox" checked />
              自动注入当前 botId
            </label>
          </div>
          <textarea id="raw-action-json" spellcheck="false"></textarea>
        </div>
      </details>
    </section>
    <dialog id="goal-dialog" aria-labelledby="goal-dialog-title">
      <form id="goal-dialog-form" class="goal-dialog-form">
        <h2 class="goal-dialog-title" id="goal-dialog-title">设置战略目标 Set Goal</h2>
        <p class="goal-dialog-hint">当前 bot：<strong id="goal-dialog-bot" class="goal-dialog-bot">-</strong></p>
        <p class="goal-dialog-guide"><strong>目标</strong>是想做的事；<strong>理由</strong>是给规划器的背景；<strong>里程碑</strong>是可选的分步清单；<strong>起始索引</strong>表示从第几项开始，通常填 <strong>0</strong>。</p>
        <pre class="goal-dialog-example">示例：跟随 Judy<br>目标：Follow Judy<br>理由：测试跟随与停止<br>里程碑：开始跟随 Judy<br>&emsp;&emsp;维持在 Judy 附近<br>起始索引：0</pre>
        <label>目标 Goal
          <input id="goal-dialog-goal" name="goal" required maxlength="240" placeholder="例如：Follow Judy" />
        </label>
        <label>理由 Rationale
          <input id="goal-dialog-rationale" name="rationale" maxlength="320" value="debug-web" />
        </label>
        <div class="goal-dialog-meta">
          <label>里程碑 Milestones
            <textarea id="goal-dialog-milestones" name="milestones" maxlength="1200" placeholder="每行一个，或用英文逗号分隔"></textarea>
          </label>
          <label>起始索引 Start index
            <input id="goal-dialog-index" name="currentMilestoneIndex" type="number" min="0" step="1" value="0" />
          </label>
        </div>
        <div class="goal-dialog-actions">
          <button type="button" id="goal-dialog-cancel-btn">取消 Cancel</button>
          <button type="submit">设置目标 Set Goal</button>
        </div>
      </form>
    </dialog>
    <div class="summary-grid">
      <section class="summary-card" id="summary-bot-card" data-state="waiting" data-panel-target="bot-status" role="button" tabindex="0" title="查看机器人详细状态">
        <div class="summary-card-heading"><div class="label">Bot / 机器人</div><span class="summary-chip" id="summary-bot-chip">等待 waiting</span></div>
        <div class="value" id="summary-bot">-</div>
        <div class="sub" id="summary-bot-sub">-</div>
      </section>
      <section class="summary-card" id="summary-agent-card" data-state="waiting" data-panel-target="agent-status" role="button" tabindex="0" title="查看代理详细状态">
        <div class="summary-card-heading"><div class="label">Agent / 代理</div><span class="summary-chip" id="summary-agent-chip">等待 waiting</span></div>
        <div class="value" id="summary-agent">-</div>
        <div class="sub" id="summary-agent-sub">-</div>
      </section>
      <section class="summary-card" id="summary-goal-card" data-state="waiting" data-panel-target="trace-summary" role="button" tabindex="0" title="查看目标与里程碑详情">
        <div class="summary-card-heading"><div class="label">Goal / 目标</div><span class="summary-chip" id="summary-goal-chip">等待 waiting</span></div>
        <div class="value" id="summary-goal">-</div>
        <div class="sub" id="summary-goal-sub">-</div>
      </section>
      <section class="summary-card" id="summary-task-card" data-state="waiting" data-panel-target="trace-summary" role="button" tabindex="0" title="查看当前任务与执行摘要">
        <div class="summary-card-heading"><div class="label">Task / 任务</div><span class="summary-chip" id="summary-task-chip">等待 waiting</span></div>
        <div class="value" id="summary-task">-</div>
        <div class="sub" id="summary-task-sub">-</div>
      </section>
    </div>
    <div class="grid">
      <section class="panel"><details open><summary>机器人状态 Bot Status</summary><pre id="bot-status"></pre></details></section>
      <section class="panel"><details open><summary>代理状态 Agent Status</summary><pre id="agent-status"></pre></details></section>
      <section class="panel"><details open><summary>执行摘要 Trace Summary</summary><pre id="trace-summary"></pre></details></section>
      <section class="panel"><details><summary>提示词档案 Prompt Profile</summary><pre id="prompt-profile-status"></pre></details></section>
      <section class="panel"><details><summary>客户端适配 Client Adapter</summary><pre id="client-adapter-status"></pre></details></section>
      <section class="panel"><details open><summary>聊天监听 Chat Listener</summary><pre id="chat-listener-status"></pre></details></section>
      <section class="panel"><details open><summary>AI 闲聊 Chat AI</summary><pre id="chat-ai-status"></pre></details></section>
      <section class="panel"><details open><summary>观察自身 Observe Self</summary><pre id="observe-self"></pre></details></section>
      <section class="panel"><details open><summary>观察背包 Observe Inventory</summary><pre id="observe-inventory"></pre></details></section>
      <section class="panel"><details><summary>附近玩家 Nearby Players</summary><pre id="observe-nearby-players"></pre></details></section>
      <section class="panel"><details><summary>附近实体 Nearby Entities</summary><pre id="observe-nearby-entities"></pre></details></section>
      <section class="panel"><details><summary>方块观察 Observe Blocks</summary><pre id="observe-blocks"></pre></details></section>
      <section class="panel"><details><summary>状态快照 State Snapshot</summary><pre id="state-snapshot"></pre></details></section>
      <section class="panel"><details><summary>本地记忆 Memory</summary><pre id="memory-status"></pre></details></section>
      <section class="panel"><details><summary>共享聊天记忆 Shared Chat Memory</summary><pre id="shared-chat-memory-status"></pre></details></section>
      <section class="panel"><details><summary>共享游戏记忆 Shared Game Memory</summary><pre id="shared-game-memory-status"></pre></details></section>
      <section class="panel"><details><summary>领地 Territory</summary><pre id="territory-status"></pre></details></section>
      <section class="panel" style="grid-column: 1 / -1;"><details open><summary>命令历史 Command History</summary><pre id="command-history"></pre></details></section>
      <section class="panel" style="grid-column: 1 / -1;"><details open><summary>动作历史 Action History</summary><pre id="action-history"></pre></details></section>
      <section class="panel" style="grid-column: 1 / -1;"><details open><summary>近期事件 Recent Events</summary><pre id="events"></pre></details></section>
    </div>
  </div>
  <script>
    const botSelect = document.getElementById("bot-select");
    const statusText = document.getElementById("status-text");
    const ids = {
      botStatus: document.getElementById("bot-status"),
      agentStatus: document.getElementById("agent-status"),
      traceSummary: document.getElementById("trace-summary"),
      promptProfileStatus: document.getElementById("prompt-profile-status"),
      clientAdapterStatus: document.getElementById("client-adapter-status"),
      chatListenerStatus: document.getElementById("chat-listener-status"),
      chatAiStatus: document.getElementById("chat-ai-status"),
      observeSelf: document.getElementById("observe-self"),
      observeInventory: document.getElementById("observe-inventory"),
      observeNearbyPlayers: document.getElementById("observe-nearby-players"),
      observeNearbyEntities: document.getElementById("observe-nearby-entities"),
      observeBlocks: document.getElementById("observe-blocks"),
      stateSnapshot: document.getElementById("state-snapshot"),
      memoryStatus: document.getElementById("memory-status"),
      sharedChatMemoryStatus: document.getElementById("shared-chat-memory-status"),
      sharedGameMemoryStatus: document.getElementById("shared-game-memory-status"),
      territoryStatus: document.getElementById("territory-status"),
      commandHistory: document.getElementById("command-history"),
      actionHistory: document.getElementById("action-history"),
      events: document.getElementById("events")
    };
    const summary = {
      bot: document.getElementById("summary-bot"),
      botSub: document.getElementById("summary-bot-sub"),
      agent: document.getElementById("summary-agent"),
      agentSub: document.getElementById("summary-agent-sub"),
      goal: document.getElementById("summary-goal"),
      goalSub: document.getElementById("summary-goal-sub"),
      task: document.getElementById("summary-task"),
      taskSub: document.getElementById("summary-task-sub"),
      botCard: document.getElementById("summary-bot-card"),
      botChip: document.getElementById("summary-bot-chip"),
      agentCard: document.getElementById("summary-agent-card"),
      agentChip: document.getElementById("summary-agent-chip"),
      goalCard: document.getElementById("summary-goal-card"),
      goalChip: document.getElementById("summary-goal-chip"),
      taskCard: document.getElementById("summary-task-card"),
      taskChip: document.getElementById("summary-task-chip")
    };
    const rawActionSelect = document.getElementById("raw-action-select");
    const rawActionJson = document.getElementById("raw-action-json");
    const rawActionInjectBot = document.getElementById("raw-action-inject-bot");
    const goalDialog = document.getElementById("goal-dialog");
    const goalDialogForm = document.getElementById("goal-dialog-form");
    const goalDialogBot = document.getElementById("goal-dialog-bot");
    const goalDialogGoal = document.getElementById("goal-dialog-goal");
    const goalDialogRationale = document.getElementById("goal-dialog-rationale");
    const goalDialogMilestones = document.getElementById("goal-dialog-milestones");
    const goalDialogIndex = document.getElementById("goal-dialog-index");
    const panelStateStorageKey = "moony-mcbot.debug-panel.panel-state";
    const rawActionStateStorageKey = "moony-mcbot.debug-panel.raw-action-state";
    const autoRefreshButton = document.getElementById("toggle-auto-refresh-btn");
    let lastDebugSnapshot = null;
    let autoRefreshEnabled = true;
    let autoRefreshTimer = null;
    const rawActionLabels = {
      "set-goal": "设目标 set-goal",
      "advance-goal": "推进目标 advance-goal",
      "rewind-goal": "回退目标 rewind-goal",
      "run-once": "跑一次 run-once",
      "reload-prompt-profile": "重载提示词 reload-prompt-profile",
      "enable-hi-reply": "启用 hi 回复 enable-hi-reply",
      "enable-ai-chat": "启用 AI 闲聊 enable-ai-chat",
      "hold-slot": "切槽 hold-slot",
      "hold-category": "拿类别 hold-category",
      "eat-food": "吃东西 eat-food",
      "right-click": "右键 right-click",
      "open-door": "开门 open-door",
      "attack-nearest": "攻击最近实体 attack-nearest",
      "clear-goal": "清目标 clear-goal",
      "clear-history": "清空历史 clear-history",
      "stop-follow": "停跟随 stop-follow",
      "capture-place": "记录地点 capture-place"
    };
    const adapterActionLabels = {
      "attack_entity": "攻击指定实体 attack entity",
      "attack_nearest_entity": "攻击最近实体 attack nearest",
      "attack_player": "攻击玩家 attack player",
      "drop_held_item": "丢出手持物品 drop held item",
      "drop_hotbar_slot": "丢出快捷栏物品 drop hotbar slot",
      "eat_food": "进食 eat food",
      "follow_player": "跟随玩家 follow player",
      "hold_hotbar_slot": "切换快捷栏 hold hotbar slot",
      "hold_item_by_category": "按类别持有 hold by category",
      "mine_block": "挖掘指定方块 mine block",
      "organize_hotbar": "整理快捷栏 organize hotbar",
      "move_to_position": "定点移动 move to position",
      "pursue_entity": "追击指定实体 pursue entity",
      "look": "转头 look",
      "open_door": "开门 open door",
      "send_chat": "发送聊天 send chat",
      "stop_follow": "停止跟随 stop follow",
      "stop_movement": "停止移动 stop movement",
      "swing_arm": "挥动手臂 swing arm",
      "use_held_item": "使用手持物品 use held item",
      "walk_forward": "向前移动 walk forward"
    };
    const rawActionTemplates = {
      "set-goal": {
        goal: "Follow Judy",
        rationale: "web-raw-action",
        milestones: ["Start following Judy", "Maintain proximity to Judy"],
        currentMilestoneIndex: 0
      },
      "advance-goal": {},
      "rewind-goal": {},
      "run-once": {
        userInstruction: "Start following Judy",
        requester: "debug-web"
      },
      "reload-prompt-profile": {},
      "enable-hi-reply": {
        wakeName: "小狸",
        trigger: "hi小狸",
        reply: "hihi",
        whitelist: ["Judy"]
      },
      "enable-ai-chat": {
        wakeWord: "小狸",
        whitelist: ["Judy"]
      },
      "hold-slot": {
        slot: 1
      },
      "hold-category": {
        category: "food"
      },
      "eat-food": {},
      "right-click": {
        mode: "tap",
        reach: 4.5,
        preferBlockInteraction: true
      },
      "open-door": {
        reach: 4.5,
        radius: 6
      },
      "attack-nearest": {
        maxDistance: 4.5,
        includePlayers: false
      },
      "clear-goal": {},
      "clear-history": {},
      "stop-follow": {},
      "capture-place": {
        name: "home",
        tags: ["manual"]
      }
    };

    function setText(node, value) {
      node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    }

    async function copyText(label, text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "readonly");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          if (!ok) throw new Error("copy command failed");
        }
        statusText.textContent = "已复制 " + label + " " + new Date().toLocaleTimeString();
      } catch (error) {
        statusText.textContent = "复制失败 copy failed: " + (error instanceof Error ? error.message : String(error));
      }
    }

    function downloadTextFile(filename, text) {
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      statusText.textContent = "已下载 downloaded " + filename + " " + new Date().toLocaleTimeString();
    }

    function buildHistoryFilename() {
      const safeBotId = (botSelect.value || "no-bot").replace(/[^a-zA-Z0-9_.-]+/g, "_");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      return "moony-mcbot-action-history-" + safeBotId + "-" + timestamp + ".json";
    }

    function buildDebugSnapshotFilename() {
      const safeBotId = (botSelect.value || "no-bot").replace(/[^a-zA-Z0-9_.-]+/g, "_");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      return "moony-mcbot-debug-snapshot-" + safeBotId + "-" + timestamp + ".json";
    }

    function getDebugSnapshotText() {
      if (!lastDebugSnapshot) {
        return JSON.stringify({ status: "empty", message: "还没有加载调试快照 No debug snapshot has been loaded yet." }, null, 2);
      }
      return JSON.stringify(lastDebugSnapshot, null, 2);
    }

    function getPanelDetails() {
      return [...document.querySelectorAll(".panel details")];
    }

    function savePanelOpenState() {
      try {
        const state = getPanelDetails().map((node) => node.open);
        localStorage.setItem(panelStateStorageKey, JSON.stringify(state));
      } catch {
        // The panel remains usable when browser storage is unavailable.
      }
    }

    function restorePanelOpenState() {
      try {
        const raw = localStorage.getItem(panelStateStorageKey);
        const state = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(state)) return;
        getPanelDetails().forEach((node, index) => {
          if (typeof state[index] === "boolean") node.open = state[index];
        });
      } catch {
        // Keep the markup defaults when storage cannot be read.
      }
    }

    function setPanelOpenState(open) {
      getPanelDetails().forEach((node) => {
        node.open = open;
      });
      savePanelOpenState();
    }

    function focusPanel(panelContentId) {
      const content = document.getElementById(panelContentId);
      const panel = content?.closest(".panel");
      const details = panel?.querySelector("details");
      if (!panel || !details) return;
      details.open = true;
      savePanelOpenState();
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function initializeSummaryNavigation() {
      document.querySelectorAll(".summary-card[data-panel-target]").forEach((card) => {
        const navigate = () => focusPanel(card.dataset.panelTarget);
        card.addEventListener("click", navigate);
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          navigate();
        });
      });
    }

    function initializeRawActionRunner() {
      for (const action of Object.keys(rawActionTemplates)) {
        const option = document.createElement("option");
        option.value = action;
        option.textContent = rawActionLabels[action] || action;
        rawActionSelect.appendChild(option);
      }
      if (!restoreRawActionState()) loadRawActionTemplate();
    }

    function loadRawActionTemplate() {
      const action = rawActionSelect.value || Object.keys(rawActionTemplates)[0];
      const template = rawActionTemplates[action] || {};
      rawActionJson.value = JSON.stringify(template, null, 2);
      saveRawActionState();
    }

    function saveRawActionState() {
      try {
        localStorage.setItem(rawActionStateStorageKey, JSON.stringify({
          action: rawActionSelect.value,
          json: rawActionJson.value,
          injectBot: rawActionInjectBot.checked
        }));
      } catch {
        // The runner remains usable when browser storage is unavailable.
      }
    }

    function restoreRawActionState() {
      try {
        const raw = localStorage.getItem(rawActionStateStorageKey);
        const state = raw ? JSON.parse(raw) : null;
        if (!state || typeof state !== "object" || !Object.hasOwn(rawActionTemplates, state.action)) return false;
        rawActionSelect.value = state.action;
        if (typeof state.json === "string") rawActionJson.value = state.json;
        if (typeof state.injectBot === "boolean") rawActionInjectBot.checked = state.injectBot;
        return true;
      } catch {
        return false;
      }
    }

    async function runRawAction() {
      const action = rawActionSelect.value;
      if (!action) {
        statusText.textContent = "动作失败 action failed: 未选择动作";
        return;
      }
      if (action === "attack-nearest") {
        const ok = confirm("从 JSON 执行 attack-nearest？这可能会攻击 bot 附近的生物或动物。");
        if (!ok) return;
      }
      let payload;
      try {
        payload = rawActionJson.value.trim() ? JSON.parse(rawActionJson.value) : {};
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setText(document.getElementById("action-result"), {
          ok: false,
          action,
          error: "Invalid JSON: " + message
        });
        statusText.textContent = "动作失败 action failed: JSON 无效";
        return;
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        setText(document.getElementById("action-result"), {
          ok: false,
          action,
          error: "JSON payload must be an object"
        });
        statusText.textContent = "动作失败 action failed: JSON 必须是对象";
        return;
      }
      const finalPayload = rawActionInjectBot.checked ? { ...payload, botId: botSelect.value } : payload;
      await postAction(action, finalPayload);
    }

    function renderEmptyState(message) {
      setText(ids.botStatus, { status: "waiting", message });
      setText(ids.agentStatus, { status: "waiting", message });
      setText(ids.traceSummary, { status: "waiting", message });
      setText(ids.promptProfileStatus, { status: "waiting", message });
      setText(ids.clientAdapterStatus, { status: "waiting", message });
      setText(ids.chatListenerStatus, { status: "waiting", message });
      setText(ids.chatAiStatus, { status: "waiting", message });
      setText(ids.observeSelf, { status: "waiting", message });
      setText(ids.observeInventory, { status: "waiting", message });
      setText(ids.observeNearbyPlayers, { status: "waiting", message });
      setText(ids.observeNearbyEntities, { status: "waiting", message });
      setText(ids.observeBlocks, { status: "waiting", message });
      setText(ids.stateSnapshot, { status: "waiting", message });
      setText(ids.memoryStatus, { status: "waiting", message });
      setText(ids.sharedChatMemoryStatus, { status: "waiting", message });
      setText(ids.sharedGameMemoryStatus, { status: "waiting", message });
      setText(ids.territoryStatus, { status: "waiting", message });
      setText(ids.commandHistory, { status: "waiting", message });
      setText(ids.actionHistory, { status: "waiting", message });
      setText(ids.events, { status: "waiting", message });
      summary.bot.textContent = "waiting";
      summary.botSub.textContent = message;
      summary.agent.textContent = "-";
      summary.agentSub.textContent = "no bot selected";
      summary.goal.textContent = "-";
      summary.goalSub.textContent = "no strategic goal";
      summary.task.textContent = "-";
      summary.taskSub.textContent = "无活动任务 no active task";
      setSummaryState(summary.botCard, summary.botChip, "waiting", "等待 waiting");
      setSummaryState(summary.agentCard, summary.agentChip, "waiting", "等待 waiting");
      setSummaryState(summary.goalCard, summary.goalChip, "waiting", "等待 waiting");
      setSummaryState(summary.taskCard, summary.taskChip, "waiting", "等待 waiting");
    }

    function getDebugToken() {
      const queryToken = new URLSearchParams(window.location.search).get("token");
      if (queryToken) {
        try { sessionStorage.setItem("mcbotDebugToken", queryToken); } catch {}
        try { window.history.replaceState({}, document.title, window.location.pathname); } catch {}
        return queryToken;
      }
      try { return sessionStorage.getItem("mcbotDebugToken") || ""; } catch { return ""; }
    }

    function apiFetch(input, options = {}) {
      const token = getDebugToken();
      const headers = new Headers(options.headers || {});
      if (token) headers.set("Authorization", "Bearer " + token);
      return fetch(input, { ...options, headers });
    }

    async function loadBots() {
      const previousValue = botSelect.value;
      const res = await apiFetch("/api/bots");
      if (!res.ok) throw new Error("Failed to load bot list: HTTP " + res.status);
      const data = await res.json();
      botSelect.innerHTML = "";
      for (const botId of data.botIds || []) {
        const option = document.createElement("option");
        option.value = botId;
        option.textContent = botId;
        botSelect.appendChild(option);
      }
      if (previousValue && [...botSelect.options].some((option) => option.value === previousValue)) {
        botSelect.value = previousValue;
      }
      if (!botSelect.value && botSelect.options.length > 0) {
        botSelect.value = botSelect.options[0].value;
      }
      return (data.botIds || []).length;
    }

    function renderClientAdapterStatus(value) {
      if (!value || typeof value !== "object" || Array.isArray(value) || value.error) {
        setText(ids.clientAdapterStatus, value);
        return;
      }
      const capabilities = Object.entries(value.capabilities || {}).map(([id, supported]) => ({
        id,
        label: adapterActionLabels[id] || id,
        supported: Boolean(supported)
      }));
      const recentActions = Array.isArray(value.recentActions)
        ? value.recentActions.map((record) => ({
            ...record,
            label: adapterActionLabels[record.action] || record.action
          }))
        : [];
      setText(ids.clientAdapterStatus, {
        ...value,
        capabilities,
        recentActions
      });
    }

    async function refresh() {
      try {
        const botCount = await loadBots();
        const botId = botSelect.value;
        if (!botId) {
          const message = botCount > 0 ? "bot 列表已更新，请选择 bot" : "等待 bot runtime...";
          statusText.textContent = message;
          renderEmptyState(message);
          return;
        }
        statusText.textContent = "刷新中 refreshing...";
        const res = await apiFetch("/api/debug?botId=" + encodeURIComponent(botId));
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Debug request failed: HTTP " + res.status);
        lastDebugSnapshot = data;
        setText(ids.botStatus, data.botStatus);
        setText(ids.agentStatus, data.agentStatus);
        setText(ids.traceSummary, data.traceSummary);
        setText(ids.promptProfileStatus, data.promptProfileStatus);
        renderClientAdapterStatus(data.clientAdapterStatus);
        setText(ids.chatListenerStatus, data.chatListenerStatus);
        setText(ids.chatAiStatus, data.chatAiStatus);
        const observe = data.observeSnapshot || {};
        setText(ids.observeSelf, observe.self || null);
        setText(ids.observeInventory, observe.inventory || null);
        setText(ids.observeNearbyPlayers, observe.nearbyPlayers || null);
        setText(ids.observeNearbyEntities, observe.nearbyEntities || null);
        setText(ids.observeBlocks, observe.blocks || null);
        setText(ids.stateSnapshot, data.stateSnapshot);
        setText(ids.memoryStatus, data.memoryStatus);
        setText(ids.sharedChatMemoryStatus, data.sharedChatMemoryStatus);
        setText(ids.sharedGameMemoryStatus, data.sharedGameMemoryStatus);
        setText(ids.territoryStatus, data.territoryStatus);
        setText(ids.commandHistory, data.commandHistory);
        setText(ids.actionHistory, data.actionHistory);
        setText(ids.events, data.events);
        renderSummary(data);
        statusText.textContent = "已更新 updated " + new Date().toLocaleTimeString();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        statusText.textContent = "刷新失败 refresh failed: " + message;
        if (!lastDebugSnapshot) renderEmptyState(message);
      }
    }

    function setAutoRefreshEnabled(enabled) {
      autoRefreshEnabled = enabled;
      if (autoRefreshTimer !== null) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
      }
      if (autoRefreshEnabled) {
        autoRefreshTimer = setInterval(refresh, 3000);
        autoRefreshButton.textContent = "暂停刷新 Pause";
        autoRefreshButton.title = "暂停页面每 3 秒自动刷新";
      } else {
        autoRefreshButton.textContent = "恢复刷新 Resume";
        autoRefreshButton.title = "恢复页面每 3 秒自动刷新";
        statusText.textContent = "自动刷新已暂停 paused";
      }
    }

    function shorten(value, fallback = "-") {
      if (!value) return fallback;
      const text = String(value);
      return text.length > 42 ? text.slice(0, 39) + "..." : text;
    }

    function setSummaryState(card, chip, state, label) {
      card.dataset.state = state;
      chip.textContent = label;
    }

    function classifySummaryState(value, readyStates) {
      const normalized = String(value || "").toLowerCase();
      if (normalized.includes("error") || normalized.includes("failed") || normalized.includes("disconnected")) {
        return ["error", "异常 error"];
      }
      if (readyStates.some((state) => normalized === state || normalized.includes(state))) {
        return ["ready", "就绪 ready"];
      }
      if (normalized.includes("running") || normalized.includes("active") || normalized.includes("planning")) {
        return ["active", "进行中 active"];
      }
      return ["waiting", "等待 waiting"];
    }

    function renderSummary(data) {
      const botStatus = data.botStatus || {};
      const agentStatus = data.agentStatus || {};
      const trace = data.traceSummary || {};
      summary.bot.textContent = shorten(botStatus.state || botStatus.error);
      summary.botSub.textContent = shorten(botStatus.profileName || botStatus.serverHost || botStatus.error);
      const [botState, botLabel] = classifySummaryState(botStatus.state || botStatus.error, ["spawned", "connected", "logged_in"]);
      setSummaryState(summary.botCard, summary.botChip, botState, botLabel);
      summary.agent.textContent = shorten(agentStatus.runtimeState || agentStatus.error);
      summary.agentSub.textContent = shorten(agentStatus.mode ? agentStatus.mode + " / 主人 owner: " + (agentStatus.owner || "-") : agentStatus.error);
      const [agentState, agentLabel] = classifySummaryState(agentStatus.runtimeState || agentStatus.error, ["idle", "ready"]);
      setSummaryState(summary.agentCard, summary.agentChip, agentState, agentLabel);
      const goalText = trace.strategicGoal?.goal || agentStatus.strategicGoal?.goal || "-";
      summary.goal.textContent = shorten(goalText);
      summary.goalSub.textContent = shorten(trace.currentMilestone || agentStatus.currentMilestone || "无里程碑 no milestone");
      setSummaryState(summary.goalCard, summary.goalChip, goalText === "-" ? "waiting" : "active", goalText === "-" ? "未设置 none" : "已设置 set");
      summary.task.textContent = shorten(trace.activeTask?.type || trace.runtimeActiveAction?.kind || "空闲 idle");
      summary.taskSub.textContent = shorten(trace.runtimeActiveSkill?.tool || trace.activeTask?.detail || "无活动任务 no active task");
      const taskValue = trace.activeTask?.type || trace.runtimeActiveAction?.kind || "idle";
      const [taskState, taskLabel] = classifySummaryState(taskValue, ["idle", "ready"]);
      setSummaryState(summary.taskCard, summary.taskChip, taskState, taskLabel);
    }

    async function postAction(action, payload) {
      try {
        const res = await apiFetch("/api/action/" + action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        const actionResult = {
          ok: res.ok,
          action,
          status: res.status,
          result: data
        };
        setText(document.getElementById("action-result"), actionResult);
        statusText.textContent = res.ok ? "动作完成 action completed " + new Date().toLocaleTimeString() : "动作失败 action failed: " + (data?.error || res.status);
        await refresh();
        return actionResult;
      } catch (error) {
        const actionResult = {
          ok: false,
          action,
          error: error instanceof Error ? error.message : String(error)
        };
        setText(document.getElementById("action-result"), actionResult);
        statusText.textContent = "动作失败 action failed: " + actionResult.error;
        return actionResult;
      }
    }

    document.getElementById("refresh-btn").addEventListener("click", refresh);
    autoRefreshButton.addEventListener("click", () => setAutoRefreshEnabled(!autoRefreshEnabled));
    document.getElementById("refresh-observe-btn").addEventListener("click", refresh);
    document.getElementById("expand-panels-btn").addEventListener("click", () => setPanelOpenState(true));
    document.getElementById("collapse-panels-btn").addEventListener("click", () => setPanelOpenState(false));
    document.getElementById("copy-action-history-btn").addEventListener("click", async () => {
      await copyText("动作历史 action history", ids.actionHistory.textContent || "");
    });
    document.getElementById("download-action-history-btn").addEventListener("click", () => {
      downloadTextFile(buildHistoryFilename(), ids.actionHistory.textContent || "[]");
    });
    document.getElementById("clear-action-history-btn").addEventListener("click", async () => {
      const ok = confirm("清空当前 bot 的动作历史？");
      if (!ok) return;
      await postAction("clear-history", { botId: botSelect.value });
    });
    document.getElementById("copy-debug-snapshot-btn").addEventListener("click", async () => {
      await copyText("调试快照 debug snapshot", getDebugSnapshotText());
    });
    document.getElementById("download-debug-snapshot-btn").addEventListener("click", () => {
      downloadTextFile(buildDebugSnapshotFilename(), getDebugSnapshotText());
    });
    document.getElementById("copy-action-result-btn").addEventListener("click", async () => {
      await copyText("最近动作结果 last action result", document.getElementById("action-result").textContent || "");
    });
    document.getElementById("raw-action-template-btn").addEventListener("click", loadRawActionTemplate);
    document.getElementById("raw-action-copy-json-btn").addEventListener("click", async () => {
      await copyText("动作 JSON raw action JSON", rawActionJson.value);
    });
    document.getElementById("raw-action-run-btn").addEventListener("click", runRawAction);
    rawActionSelect.addEventListener("change", loadRawActionTemplate);
    rawActionJson.addEventListener("input", saveRawActionState);
    rawActionInjectBot.addEventListener("change", saveRawActionState);
    botSelect.addEventListener("change", refresh);
    document.getElementById("advance-goal-btn").addEventListener("click", async () => {
      await postAction("advance-goal", { botId: botSelect.value });
    });
    document.getElementById("rewind-goal-btn").addEventListener("click", async () => {
      await postAction("rewind-goal", { botId: botSelect.value });
    });
    document.getElementById("run-once-btn").addEventListener("click", async () => {
      const userInstruction = prompt("用户指令 User instruction");
      if (!userInstruction) return;
      const requester = prompt("请求来源 Requester（可选）", "");
      await postAction("run-once", {
        botId: botSelect.value,
        userInstruction,
        requester: requester || undefined
      });
    });
    document.getElementById("reload-prompt-profile-btn").addEventListener("click", async () => {
      await postAction("reload-prompt-profile", { botId: botSelect.value });
    });
    document.getElementById("enable-hi-reply-btn").addEventListener("click", async () => {
      const wakeName = prompt("唤醒名 Wake name", "小狸") || "小狸";
      const trigger = prompt("触发文本 Trigger", "hi" + wakeName) || "hi" + wakeName;
      const reply = prompt("回复内容 Reply", "hihi") || "hihi";
      const whitelistRaw = prompt("白名单 Whitelist（英文逗号分隔，可选）", "");
      const whitelist = whitelistRaw ? whitelistRaw.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
      await postAction("enable-hi-reply", {
        botId: botSelect.value,
        wakeName,
        trigger,
        reply,
        whitelist
      });
    });
    document.getElementById("enable-ai-chat-btn").addEventListener("click", async () => {
      const wakeWord = prompt("唤醒词 Wake word", "小狸") || "小狸";
      const apiBaseUrl = prompt("API base URL（可选）", "");
      const model = prompt("模型 Model（可选）", "");
      const whitelistRaw = prompt("白名单 Whitelist（英文逗号分隔，可选）", "");
      const whitelist = whitelistRaw ? whitelistRaw.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
      await postAction("enable-ai-chat", {
        botId: botSelect.value,
        wakeWord,
        apiBaseUrl: apiBaseUrl || undefined,
        model: model || undefined,
        whitelist
      });
    });
    document.getElementById("hold-slot-btn").addEventListener("click", async () => {
      const slotRaw = prompt("快捷栏槽位 Hotbar slot 1-9", "1");
      if (!slotRaw) return;
      await postAction("hold-slot", {
        botId: botSelect.value,
        slot: Number.parseInt(slotRaw, 10)
      });
    });
    document.getElementById("hold-category-btn").addEventListener("click", async () => {
      const category = prompt("物品类别 Category: sword / axe / pickaxe / food", "food");
      if (!category) return;
      await postAction("hold-category", {
        botId: botSelect.value,
        category: category.trim()
      });
    });
    document.getElementById("eat-food-btn").addEventListener("click", async () => {
      const itemName = prompt("食物物品名 Food item name（可选）", "");
      await postAction("eat-food", {
        botId: botSelect.value,
        itemName: itemName || undefined
      });
    });
    document.getElementById("right-click-btn").addEventListener("click", async () => {
      const modeRaw = prompt("模式 Mode: tap 或 hold", "tap") || "tap";
      const mode = modeRaw === "hold" ? "hold" : "tap";
      const holdMsRaw = prompt("按住毫秒 Hold ms", mode === "hold" ? "800" : "0") || "0";
      const reachRaw = prompt("触及距离 Reach", "4.5") || "4.5";
      await postAction("right-click", {
        botId: botSelect.value,
        mode,
        holdMs: Number.parseInt(holdMsRaw, 10) || undefined,
        reach: Number.parseFloat(reachRaw) || undefined,
        preferBlockInteraction: true
      });
    });
    document.getElementById("open-door-btn").addEventListener("click", async () => {
      const reachRaw = prompt("触及距离 Reach", "4.5") || "4.5";
      const radiusRaw = prompt("搜索半径 Search radius", "6") || "6";
      await postAction("open-door", {
        botId: botSelect.value,
        reach: Number.parseFloat(reachRaw) || undefined,
        radius: Number.parseFloat(radiusRaw) || undefined
      });
    });
    document.getElementById("attack-nearest-btn").addEventListener("click", async () => {
      const ok = confirm("攻击最近的非玩家实体？这可能会打到 bot 附近的怪物或动物。");
      if (!ok) return;
      const maxDistanceRaw = prompt("最大距离 Max distance", "4.5") || "4.5";
      const type = prompt("类型过滤 Type filter（可选）", "") || "";
      const name = prompt("名称过滤 Name filter（可选）", "") || "";
      await postAction("attack-nearest", {
        botId: botSelect.value,
        maxDistance: Number.parseFloat(maxDistanceRaw) || undefined,
        type: type || undefined,
        name: name || undefined,
        includePlayers: false
      });
    });
    document.getElementById("clear-goal-btn").addEventListener("click", async () => {
      await postAction("clear-goal", { botId: botSelect.value });
    });
    document.getElementById("stop-follow-btn").addEventListener("click", async () => {
      await postAction("stop-follow", { botId: botSelect.value });
    });
    document.getElementById("set-goal-btn").addEventListener("click", () => {
      if (!botSelect.value) {
        statusText.textContent = "请先选择 bot Select a bot first";
        return;
      }
      goalDialogForm.reset();
      goalDialogRationale.value = "debug-web";
      goalDialogIndex.value = "0";
      goalDialogBot.textContent = botSelect.selectedOptions[0]?.textContent || botSelect.value;
      goalDialog.showModal();
      goalDialogGoal.focus();
    });
    document.getElementById("goal-dialog-cancel-btn").addEventListener("click", () => {
      goalDialog.close();
    });
    goalDialogForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const goal = goalDialogGoal.value.trim();
      if (!goal) {
        goalDialogGoal.reportValidity();
        return;
      }
      const milestones = goalDialogMilestones.value
        .split(/[\\r\\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      const parsedIndex = Number.parseInt(goalDialogIndex.value, 10);
      goalDialog.close();
      await postAction("set-goal", {
        botId: botSelect.value,
        goal,
        rationale: goalDialogRationale.value.trim() || "debug-web",
        milestones: milestones.length > 0 ? milestones : undefined,
        currentMilestoneIndex: Number.isFinite(parsedIndex) ? Math.max(0, parsedIndex) : 0
      });
    });
    document.getElementById("capture-place-btn").addEventListener("click", async () => {
      const placeId = prompt("地点 ID Place ID");
      if (!placeId) return;
      const label = prompt("显示名 Label", placeId) || placeId;
      const notes = prompt("备注 Notes", "") || "";
      const tagsRaw = prompt("标签 Tags（英文逗号分隔）", "");
      const tags = tagsRaw ? tagsRaw.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
      await postAction("capture-place", {
        botId: botSelect.value,
        placeId,
        label,
        notes: notes || undefined,
        tags
      });
    });

    (async () => {
      try {
        restorePanelOpenState();
        getPanelDetails().forEach((node) => node.addEventListener("toggle", savePanelOpenState));
        initializeSummaryNavigation();
        initializeRawActionRunner();
        await refresh();
        setAutoRefreshEnabled(true);
      } catch (error) {
        statusText.textContent = String(error);
        renderEmptyState(String(error));
      }
    })();
  </script>
</body>
</html>`;
}

async function buildDebugPayload(registry: BotRegistry, botId: string): Promise<Record<string, unknown>> {
  const botStatus = (() => {
    try {
      return registry.get(botId).getStatus();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  })();

  const safe = <T>(fn: () => T): T | { error: string } => {
    try {
      return fn();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };
  const safeAsync = async <T>(fn: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await fn();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };

  return {
    botId,
    botStatus,
    agentStatus: safe(() => getAgentStatusForDebug(botId)),
    traceSummary: safe(() => getAgentExecutionTraceForDebug(botId)),
    promptProfileStatus: safe(() => getPromptProfileStatusForDebug()),
    clientAdapterStatus: safe(() => registry.get(botId).getClientAdapterStatus()),
    observeSnapshot: safe(() => getObserveSnapshotForDebug(botId, registry)),
    stateSnapshot: safe(() => getAgentStateSnapshotForDebug(botId, registry)),
    memoryStatus: safe(() => getAgentMemoryStatusForDebug(botId)),
    sharedChatMemoryStatus: await safeAsync(() => getSharedChatMemoryStatusForDebug()),
    sharedGameMemoryStatus: await safeAsync(() => getSharedGameMemoryStatusForDebug()),
    territoryStatus: safe(() => getTerritoryStatusForDebug(botId)),
    chatListenerStatus: safe(() => getChatListenerStatusForDebug(botId)),
    chatAiStatus: safe(() => getChatAiStatusForDebug(botId)),
    commandHistory: getCommandInvocationHistoryForDebug(registry, { botId }),
    actionHistory: debugActionHistory
      .filter((entry) => !entry.botId || entry.botId === botId)
      .slice()
      .reverse(),
    events: safe(() => getAgentRecentEventsForDebug(botId, { count: 24 }))
  };
}

export function startDebugWebServer(registry: BotRegistry): http.Server | null {
  if (!readEnabled()) {
    return null;
  }

  const host = readHost();
  const port = readPort();
  const authToken = readAuthToken();
  if (!isLoopbackHost(host) && !authToken) {
    log("warn", "Debug web panel refused to bind non-loopback host without MCBOT_DEBUG_WEB_AUTH_TOKEN", {
      host,
      port
    });
    return null;
  }
  const allowedOrigins = readAllowedOrigins(host, port);
  const maxBodyBytes = readMaxBodyBytes();

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${host}:${port}`);

    if (requestUrl.pathname.startsWith("/api/")) {
      const authFailure = authorizeDebugApiRequest(req, authToken, allowedOrigins);
      if (authFailure) {
        sendJson(res, authFailure.statusCode, { error: authFailure.error });
        return;
      }
    }

    if (requestUrl.pathname === "/") {
      sendHtml(res, buildDebugHtml());
      return;
    }

    if (requestUrl.pathname === "/api/bots") {
      sendJson(res, 200, { botIds: registry.listBotIds() });
      return;
    }

    if (requestUrl.pathname === "/api/debug") {
      void (async () => {
        try {
          const botId = requestUrl.searchParams.get("botId")?.trim();
          if (!botId) {
            sendJson(res, 400, { error: "botId is required" });
            return;
          }
          sendJson(res, 200, await buildDebugPayload(registry, botId));
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return;
    }

    if (req.method === "POST" && requestUrl.pathname.startsWith("/api/action/")) {
      void (async () => {
        const actionName = requestUrl.pathname.slice("/api/action/".length);
        let body: Record<string, unknown> = {};
        let botId: string | null = null;
        try {
          body = (await readJsonBody(req, maxBodyBytes)) as Record<string, unknown>;
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw new DebugRequestError(400, "json_body_must_be_an_object");
          }
          botId = String(body.botId ?? "").trim();
          if (!botId) {
            recordDebugAction({
              botId: null,
              action: actionName,
              ok: false,
              payload: body,
              error: "botId is required"
            });
            sendJson(res, 400, { error: "botId is required" });
            return;
          }

          let result: Record<string, unknown>;
          switch (actionName) {
            case "set-goal":
              result = await debugSetStrategicGoal(botId, registry, {
                goal: String(body.goal ?? "").trim(),
                rationale: typeof body.rationale === "string" ? body.rationale : undefined,
                milestones: Array.isArray(body.milestones)
                  ? body.milestones.map((x) => String(x).trim()).filter(Boolean)
                  : undefined,
                currentMilestoneIndex:
                  typeof body.currentMilestoneIndex === "number" ? body.currentMilestoneIndex : undefined
              });
              break;
            case "clear-goal":
              result = debugClearStrategicGoal(botId);
              break;
            case "clear-history": {
              const clearedCount = clearDebugActionHistoryForBot(botId);
              result = { action: "clear-history", botId, clearedCount };
              break;
            }
            case "advance-goal":
              result = debugAdvanceStrategicGoal(botId, registry);
              break;
            case "rewind-goal":
              result = debugRewindStrategicGoal(botId, registry);
              break;
            case "run-once":
              result = await debugRunAgentOnce(botId, registry, {
                userInstruction: String(body.userInstruction ?? "").trim(),
                requester: typeof body.requester === "string" ? body.requester : undefined
              });
              break;
            case "reload-prompt-profile":
              result = await debugReloadPromptProfile();
              break;
            case "enable-hi-reply":
              result = debugEnableHiReply(botId, registry, {
                whitelist: Array.isArray(body.whitelist)
                  ? body.whitelist.map((x) => String(x).trim()).filter(Boolean)
                  : undefined,
                wakeName: typeof body.wakeName === "string" ? body.wakeName : undefined,
                trigger: typeof body.trigger === "string" ? body.trigger : undefined,
                reply: typeof body.reply === "string" ? body.reply : undefined
              });
              break;
            case "enable-ai-chat":
              result = debugEnableChatAi(botId, registry, {
                whitelist: Array.isArray(body.whitelist)
                  ? body.whitelist.map((x) => String(x).trim()).filter(Boolean)
                  : undefined,
                wakeWord: typeof body.wakeWord === "string" ? body.wakeWord : undefined,
                apiBaseUrl: typeof body.apiBaseUrl === "string" ? body.apiBaseUrl : undefined,
                model: typeof body.model === "string" ? body.model : undefined
              });
              break;
            case "eat-food":
              result = await debugEatFood(botId, registry, {
                itemName: typeof body.itemName === "string" ? body.itemName : undefined
              });
              break;
            case "hold-slot": {
              const slot = typeof body.slot === "number" ? body.slot : Number.NaN;
              result = { action: "hold-slot", result: await registry.get(botId).holdHotbarSlot({ slot }) };
              break;
            }
            case "hold-category": {
              const category = String(body.category ?? "").trim();
              if (!["sword", "axe", "pickaxe", "food"].includes(category)) {
                throw new Error("category must be one of: sword, axe, pickaxe, food");
              }
              result = {
                action: "hold-category",
                result: await registry.get(botId).holdItemByCategory({
                  category: category as "sword" | "axe" | "pickaxe" | "food"
                })
              };
              break;
            }
            case "right-click":
              result = await debugUseHeldItem(botId, registry, {
                mode: body.mode === "hold" ? "hold" : "tap",
                holdMs: typeof body.holdMs === "number" ? body.holdMs : undefined,
                reach: typeof body.reach === "number" ? body.reach : undefined,
                preferBlockInteraction:
                  typeof body.preferBlockInteraction === "boolean" ? body.preferBlockInteraction : undefined
              });
              break;
            case "open-door":
              result = await debugOpenDoor(botId, registry, {
                reach: typeof body.reach === "number" ? body.reach : undefined,
                radius: typeof body.radius === "number" ? body.radius : undefined
              });
              break;
            case "attack-nearest":
              result = await debugAttackNearestEntity(botId, registry, {
                maxDistance: typeof body.maxDistance === "number" ? body.maxDistance : undefined,
                type: typeof body.type === "string" ? body.type : undefined,
                name: typeof body.name === "string" ? body.name : undefined,
                includePlayers: typeof body.includePlayers === "boolean" ? body.includePlayers : false
              });
              break;
            case "stop-follow":
              result = await debugStopFollow(botId, registry);
              break;
            case "capture-place":
              result = debugCapturePlaceHere(botId, registry, {
                placeId: String(body.placeId ?? "").trim(),
                label: String(body.label ?? "").trim(),
                notes: typeof body.notes === "string" ? body.notes : undefined,
                tags: Array.isArray(body.tags) ? body.tags.map((x) => String(x).trim()).filter(Boolean) : undefined
              });
              break;
            default:
              recordDebugAction({
                botId,
                action: actionName,
                ok: false,
                payload: body,
                error: "unknown_action"
              });
              sendJson(res, 404, { error: "unknown_action" });
              return;
          }

          recordDebugAction({
            botId,
            action: actionName,
            ok: true,
            payload: body,
            result
          });
          sendJson(res, 200, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const statusCode = error instanceof DebugRequestError ? error.statusCode : 500;
          recordDebugAction({
            botId,
            action: actionName,
            ok: false,
            payload: body,
            error: message
          });
          sendJson(res, statusCode, { error: message });
        }
      })();
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });

  server.listen(port, host, () => {
    log("info", "Debug web panel started", { host, port, url: `http://${host}:${port}` });
  });

  server.on("error", (error) => {
    log("warn", "Debug web panel failed", { error: error.message, host, port });
  });

  return server;
}

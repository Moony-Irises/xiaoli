import type { AgentTaskSource, AgentTaskStatus } from "../agent/types.js";

export interface AgentTaskHistoryRecord {
  id: string;
  taskType: string;
  status: AgentTaskStatus;
  source: AgentTaskSource;
  goal: string;
  detail?: string;
  lastError?: string;
  createdAt: number;
  finishedAt: number;
}

export interface AgentTaskHistoryStoreOptions {
  maxEntries?: number;
}

function cloneRecord(record: AgentTaskHistoryRecord): AgentTaskHistoryRecord {
  return { ...record };
}

export class AgentTaskHistoryStore {
  private readonly histories = new Map<string, AgentTaskHistoryRecord[]>();
  private readonly maxEntries: number;

  constructor(options: AgentTaskHistoryStoreOptions = {}) {
    const maxEntries = options.maxEntries ?? 20;
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new RangeError("Agent task history maxEntries must be a positive integer");
    }
    this.maxEntries = maxEntries;
  }

  get(botId: string): AgentTaskHistoryRecord[] {
    return (this.histories.get(botId) ?? []).map(cloneRecord);
  }

  replace(botId: string, records: readonly AgentTaskHistoryRecord[]): void {
    this.histories.set(botId, records.slice(-this.maxEntries).map(cloneRecord));
  }

  record(botId: string, record: AgentTaskHistoryRecord): void {
    const history = this.histories.get(botId) ?? [];
    history.push(cloneRecord(record));
    if (history.length > this.maxEntries) {
      history.splice(0, history.length - this.maxEntries);
    }
    this.histories.set(botId, history);
  }

  clear(botId: string): boolean {
    const hadEntries = (this.histories.get(botId)?.length ?? 0) > 0;
    this.histories.set(botId, []);
    return hadEntries;
  }

  delete(botId: string): boolean {
    return this.histories.delete(botId);
  }
}

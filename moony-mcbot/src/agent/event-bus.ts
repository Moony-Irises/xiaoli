import { AgentEvent, AgentEventType } from "./types.js";

type AgentEventHandler = (event: AgentEvent) => void;

export class AgentEventBus {
  private readonly handlers = new Map<AgentEventType | "*", Set<AgentEventHandler>>();
  private readonly history: AgentEvent[] = [];

  constructor(private readonly maxHistory = 128) {}

  publish(event: AgentEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    const direct = this.handlers.get(event.type);
    if (direct) {
      for (const handler of direct) handler(event);
    }
    const wildcard = this.handlers.get("*");
    if (wildcard) {
      for (const handler of wildcard) handler(event);
    }
  }

  subscribe(type: AgentEventType | "*", handler: AgentEventHandler): () => void {
    const set = this.handlers.get(type) ?? new Set<AgentEventHandler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      const current = this.handlers.get(type);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  getRecent(): AgentEvent[] {
    return [...this.history];
  }

  clear(): void {
    this.history.length = 0;
  }
}

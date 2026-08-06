export interface ChatEventDeduplicator {
  accept(botId: string, username: string, message: string, now?: number): boolean;
  clearBot(botId: string): void;
}

export function createChatEventDeduplicator(windowMs = 1500): ChatEventDeduplicator {
  const seenByBot = new Map<string, Map<string, number>>();
  const effectiveWindowMs = Math.max(1, Math.trunc(windowMs));

  return {
    accept(botId, username, message, now = Date.now()) {
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedMessage = message.trim().replace(/\s+/g, " ").toLowerCase();
      if (!normalizedUsername || !normalizedMessage) return true;

      const seen = seenByBot.get(botId) ?? new Map<string, number>();
      for (const [key, timestamp] of seen) {
        if (now - timestamp > effectiveWindowMs) {
          seen.delete(key);
        }
      }

      const key = `${normalizedUsername}\u0000${normalizedMessage}`;
      const previousAt = seen.get(key);
      seen.set(key, now);
      seenByBot.set(botId, seen);

      return previousAt === undefined || now - previousAt > effectiveWindowMs;
    },
    clearBot(botId) {
      seenByBot.delete(botId);
    }
  };
}

/**
 * Owns the current movement correlation key for each bot.
 *
 * The key is used to ignore stale movement events and async results. It is
 * not a Pathfinder goal, adapter state, or task record.
 */
export class MovementIntentStore {
  private readonly intents = new Map<string, string>();

  get(botId: string): string | undefined {
    return this.intents.get(botId);
  }

  has(botId: string): boolean {
    return this.intents.has(botId);
  }

  set(botId: string, movementId: string): void {
    this.intents.set(botId, movementId);
  }

  delete(botId: string): boolean {
    return this.intents.delete(botId);
  }
}

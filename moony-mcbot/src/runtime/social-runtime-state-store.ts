export interface SocialMemoryChatContext {
  player: string;
  relation: string;
  at: number;
}

interface SocialRuntimeState {
  lastInteractionAt?: number;
  lastProactiveSpeakAt?: number;
  memoryChatContext?: SocialMemoryChatContext;
  mood?: string;
  sceneTimestamps?: Map<string, number>;
}

export class SocialRuntimeStateStore {
  private readonly stateByBot = new Map<string, SocialRuntimeState>();

  getLastInteractionAt(botId: string): number | undefined {
    return this.stateByBot.get(botId)?.lastInteractionAt;
  }

  initializeInteraction(botId: string, at: number): number {
    const state = this.stateByBot.get(botId);
    if (state?.lastInteractionAt !== undefined) return state.lastInteractionAt;
    this.stateByBot.set(botId, { ...state, lastInteractionAt: at });
    return at;
  }

  recordInteraction(botId: string, at: number): void {
    const state = this.stateByBot.get(botId);
    this.stateByBot.set(botId, { ...state, lastInteractionAt: at });
  }

  getLastProactiveSpeakAt(botId: string): number | undefined {
    return this.stateByBot.get(botId)?.lastProactiveSpeakAt;
  }

  recordProactiveSpeak(botId: string, at: number): void {
    const state = this.stateByBot.get(botId);
    this.stateByBot.set(botId, { ...state, lastProactiveSpeakAt: at });
  }

  getMemoryChatContext(botId: string): SocialMemoryChatContext | undefined {
    const context = this.stateByBot.get(botId)?.memoryChatContext;
    return context ? { ...context } : undefined;
  }

  recordMemoryChatContext(botId: string, context: SocialMemoryChatContext): void {
    const state = this.stateByBot.get(botId);
    this.stateByBot.set(botId, { ...state, memoryChatContext: { ...context } });
  }

  getMood(botId: string): string | undefined {
    return this.stateByBot.get(botId)?.mood;
  }

  setMood(botId: string, mood: string): void {
    const state = this.stateByBot.get(botId);
    this.stateByBot.set(botId, { ...state, mood });
  }

  claimSceneLine(botId: string, scene: string, now: number, cooldownMs: number): boolean {
    const state = this.stateByBot.get(botId);
    const lastAt = state?.sceneTimestamps?.get(scene) ?? 0;
    if (now - lastAt < cooldownMs) return false;

    const sceneTimestamps = new Map(state?.sceneTimestamps);
    sceneTimestamps.set(scene, now);
    this.stateByBot.set(botId, { ...state, sceneTimestamps });
    return true;
  }

  clearBot(botId: string): boolean {
    return this.stateByBot.delete(botId);
  }
}

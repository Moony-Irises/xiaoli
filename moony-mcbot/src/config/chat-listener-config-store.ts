import type { PersistedChatConfig } from "./persisted-chat-config.js";

export interface ChatIntentPhrases {
  follow: string[];
  status: string[];
  stop: string[];
  eat: string[];
  organize: string[];
  mine: string[];
  challenge: string[];
  openDoor: string[];
  attack: string[];
  prepareBattle: string[];
}

export interface ChatSpecialReply {
  trigger: string;
  reply: string;
  matchMode: "exact" | "includes";
}

export interface ChatListenerConfig {
  enabled: boolean;
  whitelist: Set<string>;
  wakeNames: string[];
  dotPrefix: string;
  intents: ChatIntentPhrases;
  specialReplies: ChatSpecialReply[];
}

function createDefaultConfig(): ChatListenerConfig {
  return {
    enabled: false,
    whitelist: new Set<string>(),
    wakeNames: ["小狸"],
    dotPrefix: ".",
    intents: {
      follow: ["来我这", "跟我", "跟着我", "跟上我", "来一下", "跟过来"],
      status: ["在干什么", "在做什么"],
      stop: ["停下", "停止", "别跟", "不要跟", "别跟着", "先别跟我走"],
      eat: ["吃东西", "吃点", "先吃", "去吃", "补点吃的"],
      organize: ["整理背包", "整理快捷栏", "一键整理", "整背包"],
      mine: ["下矿", "去挖矿", "挖矿", "采矿"],
      challenge: ["挑战", "挑战一下"],
      openDoor: ["开门", "把门打开"],
      attack: ["打它", "攻击", "打一下", "揍它", "还手"],
      prepareBattle: ["准备战斗", "准备沾豆"]
    },
    specialReplies: [
      { trigger: "hi小狸", reply: "hihi", matchMode: "includes" }
    ]
  };
}

function pickIntent(value: string[] | undefined, fallback: string[]): string[] {
  return value === undefined ? fallback : value.filter(Boolean);
}

function applyPersistedConfig(
  config: ChatListenerConfig,
  persisted: PersistedChatConfig
): void {
  const defaults = config.intents;
  config.enabled = !!persisted.enabled;
  config.whitelist = new Set((persisted.whitelist || []).filter(Boolean));
  config.wakeNames = (persisted.wakeNames || []).filter(Boolean);
  config.dotPrefix = (persisted.dotPrefix || ".").slice(0, 4) || ".";
  config.intents = {
    follow: pickIntent(persisted.intents?.follow, defaults.follow),
    status: pickIntent(persisted.intents?.status, defaults.status),
    stop: pickIntent(persisted.intents?.stop, defaults.stop),
    eat: pickIntent(persisted.intents?.eat, defaults.eat),
    organize: pickIntent(persisted.intents?.organize, defaults.organize),
    mine: pickIntent(persisted.intents?.mine, defaults.mine),
    challenge: pickIntent(persisted.intents?.challenge, defaults.challenge),
    openDoor: pickIntent(persisted.intents?.openDoor, defaults.openDoor),
    attack: pickIntent(persisted.intents?.attack, defaults.attack),
    prepareBattle: pickIntent(persisted.intents?.prepareBattle, defaults.prepareBattle)
  };
  if (persisted.specialReplies !== undefined) {
    config.specialReplies = persisted.specialReplies
      .filter((reply) => reply.trigger.length > 0 && reply.reply.length > 0)
      .map((reply) => ({
        trigger: reply.trigger,
        reply: reply.reply,
        matchMode: reply.matchMode === "exact" ? "exact" : "includes"
      }));
  }
}

function toPersistedConfig(config: ChatListenerConfig): PersistedChatConfig {
  return {
    enabled: config.enabled,
    whitelist: [...config.whitelist],
    wakeNames: [...config.wakeNames],
    dotPrefix: config.dotPrefix,
    intents: {
      follow: [...config.intents.follow],
      status: [...config.intents.status],
      stop: [...config.intents.stop],
      eat: [...config.intents.eat],
      organize: [...config.intents.organize],
      mine: [...config.intents.mine],
      challenge: [...config.intents.challenge],
      openDoor: [...config.intents.openDoor],
      attack: [...config.intents.attack],
      prepareBattle: [...config.intents.prepareBattle]
    },
    specialReplies: config.specialReplies.map((reply) => ({
      trigger: reply.trigger,
      reply: reply.reply,
      matchMode: reply.matchMode
    }))
  };
}

export class ChatListenerConfigStore {
  private readonly configs = new Map<string, ChatListenerConfig>();

  get(botId: string): ChatListenerConfig | undefined {
    return this.configs.get(botId);
  }

  getOrCreate(botId: string): ChatListenerConfig {
    const existing = this.configs.get(botId);
    if (existing) return existing;

    const created = createDefaultConfig();
    this.configs.set(botId, created);
    return created;
  }

  replace(botId: string, persisted: PersistedChatConfig): ChatListenerConfig {
    const config = createDefaultConfig();
    applyPersistedConfig(config, persisted);
    this.configs.set(botId, config);
    return config;
  }

  delete(botId: string): boolean {
    return this.configs.delete(botId);
  }

  getRemovedBotIds(next: Readonly<Record<string, unknown>>): string[] {
    const nextBotIds = new Set(Object.keys(next));
    return [...this.configs.keys()].filter((botId) => !nextBotIds.has(botId));
  }

  toPersistedRecord(): Record<string, PersistedChatConfig> {
    const record: Record<string, PersistedChatConfig> = {};
    for (const [botId, config] of this.configs.entries()) {
      record[botId] = toPersistedConfig(config);
    }
    return record;
  }
}

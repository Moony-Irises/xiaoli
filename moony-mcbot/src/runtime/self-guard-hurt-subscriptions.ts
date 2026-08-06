export interface SelfGuardHurtEventEntity {
  id?: number;
}

export type SelfGuardHurtListener = (entity: SelfGuardHurtEventEntity) => void;

export interface SelfGuardHurtEmitter {
  on(event: "entityHurt", listener: SelfGuardHurtListener): unknown;
  off(event: "entityHurt", listener: SelfGuardHurtListener): unknown;
}

export interface EnabledSelfGuardConfig {
  enabled: boolean;
}

export interface SelfGuardHurtSubscriptionRegistryOptions<
  TConfig extends EnabledSelfGuardConfig,
  TEmitter extends SelfGuardHurtEmitter
> {
  getCurrentConfig: (botId: string) => TConfig | undefined;
  getSelfEntityId: (emitter: TEmitter) => number | undefined;
}

export type SelfGuardHurtReaction<
  TConfig extends EnabledSelfGuardConfig,
  TEmitter extends SelfGuardHurtEmitter
> = (botId: string, config: TConfig, emitter: TEmitter) => void;

interface SelfGuardHurtSubscription<TEmitter extends SelfGuardHurtEmitter> {
  emitter: TEmitter;
  listener: SelfGuardHurtListener;
}

export class SelfGuardHurtSubscriptionRegistry<
  TConfig extends EnabledSelfGuardConfig,
  TEmitter extends SelfGuardHurtEmitter
> {
  private readonly subscriptions = new Map<string, SelfGuardHurtSubscription<TEmitter>>();

  constructor(
    private readonly options: SelfGuardHurtSubscriptionRegistryOptions<TConfig, TEmitter>
  ) {}

  ensure(
    botId: string,
    emitter: TEmitter,
    onSelfHurt: SelfGuardHurtReaction<TConfig, TEmitter>
  ): boolean {
    const existing = this.subscriptions.get(botId);
    if (existing?.emitter === emitter) return false;
    if (existing) this.detach(botId, existing);

    const listener: SelfGuardHurtListener = (entity) => {
      const selfEntityId = this.options.getSelfEntityId(emitter);
      if (entity?.id === undefined || selfEntityId === undefined || entity.id !== selfEntityId) {
        return;
      }

      const config = this.options.getCurrentConfig(botId);
      if (!config?.enabled) return;
      onSelfHurt(botId, config, emitter);
    };

    emitter.on("entityHurt", listener);
    this.subscriptions.set(botId, { emitter, listener });
    return true;
  }

  delete(botId: string): boolean {
    const existing = this.subscriptions.get(botId);
    if (!existing) return false;
    this.detach(botId, existing);
    return true;
  }

  keys(): string[] {
    return [...this.subscriptions.keys()];
  }

  private detach(
    botId: string,
    subscription: SelfGuardHurtSubscription<TEmitter>
  ): void {
    subscription.emitter.off("entityHurt", subscription.listener);
    this.subscriptions.delete(botId);
  }
}

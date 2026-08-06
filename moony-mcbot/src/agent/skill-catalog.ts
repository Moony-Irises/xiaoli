import {
  AgentBlackboardSnapshot,
  SkillAffordance,
  SkillInvocation,
  SkillModuleDescriptor,
  StrategicAction
} from "./types.js";

function ok(score: number, reason: string): SkillAffordance {
  return { canRun: true, score, reason };
}

function no(reason: string): SkillAffordance {
  return { canRun: false, score: 0, reason };
}

function hasStringParam(action: StrategicAction, key: string): boolean {
  return typeof action.params[key] === "string" && String(action.params[key]).trim().length > 0;
}

function hasFiniteLookAngles(action: StrategicAction): action is StrategicAction & {
  params: Record<string, unknown> & { yaw: number; pitch: number };
} {
  return (
    typeof action.params.yaw === "number" &&
    Number.isFinite(action.params.yaw) &&
    typeof action.params.pitch === "number" &&
    Number.isFinite(action.params.pitch)
  );
}

function passthroughCompiler(skill: string) {
  return (action: StrategicAction): SkillInvocation[] => [{ skill, args: { ...action.params } }];
}

export function createDefaultSkillCatalog(): SkillModuleDescriptor[] {
  return [
    {
      id: "follow-skill",
      supportedActions: ["follow_player"],
      toolDependencies: ["move.followPlayer"],
      interruptible: true,
      tickRateMs: 250,
      estimate: (action) => (hasStringParam(action, "playerName") ? ok(0.95, "playerName present") : no("missing playerName")),
      compile: passthroughCompiler("move.followPlayer")
    },
    {
      id: "combat-skill",
      supportedActions: ["attack_target"],
      toolDependencies: ["interact.attackPlayer"],
      interruptible: true,
      tickRateMs: 250,
      estimate: (action) =>
        hasStringParam(action, "targetName") || hasStringParam(action, "playerName")
          ? ok(0.9, "target specified")
          : no("missing target"),
      compile: (action) => {
        const targetName = String(action.params.targetName ?? action.params.playerName ?? "").trim();
        return [
          {
            skill: "interact.attackPlayer",
            args: {
              playerName: targetName,
              style: action.style ?? "default"
            }
          }
        ];
      }
    },
    {
      id: "challenge-skill",
      supportedActions: ["challenge_entity"],
      toolDependencies: ["combat.challengeEntity"],
      interruptible: true,
      tickRateMs: 500,
      estimate: (action) =>
        hasStringParam(action, "targetText") || hasStringParam(action, "targetName")
          ? ok(0.92, "challenge target specified")
          : no("missing challenge target"),
      compile: (action) => [
        {
          skill: "combat.challengeEntity",
          args: {
            targetText: action.params.targetText ?? action.params.targetName,
            maxDistance: action.params.maxDistance ?? 16,
            requester: action.params.requester ?? "agent"
          }
        }
      ]
    },
    {
      id: "stop-follow-skill",
      supportedActions: ["stop_follow"],
      toolDependencies: ["move.stopFollow"],
      interruptible: true,
      tickRateMs: 250,
      estimate: () => ok(0.95, "stop follow is always lightweight"),
      compile: () => [{ skill: "move.stopFollow", args: {} }]
    },
    {
      id: "move-to-position-skill",
      supportedActions: ["move_to_position"],
      toolDependencies: ["move.goToPosition"],
      interruptible: true,
      tickRateMs: 250,
      estimate: (action) =>
        typeof action.params.x === "number" && typeof action.params.y === "number" && typeof action.params.z === "number"
          ? ok(0.9, "xyz position provided")
          : no("missing xyz position"),
      compile: (action) => [
        {
          skill: "move.goToPosition",
          args: {
            x: action.params.x,
            y: action.params.y,
            z: action.params.z,
            stopRadius: action.params.stopRadius ?? 2.3
          }
        }
      ]
    },
    {
      id: "eat-skill",
      supportedActions: ["eat_food"],
      toolDependencies: ["interact.eat"],
      interruptible: true,
      tickRateMs: 500,
      estimate: (_action, state) => {
        const rawSelfState = state.selfState.selfState;
        const nestedSelfState = rawSelfState && typeof rawSelfState === "object"
          ? rawSelfState as Record<string, unknown>
          : undefined;
        const rawVitals = nestedSelfState?.vitals;
        const vitals = rawVitals && typeof rawVitals === "object"
          ? rawVitals as Record<string, unknown>
          : undefined;
        const health = Number(vitals?.health ?? 20);
        const food = Number(vitals?.food ?? 20);
        return health < 20 || food < 20 ? ok(0.9, "healing or hunger suggests eating") : ok(0.6, "eating is available");
      },
      compile: () => [{ skill: "interact.eat", args: {} }]
    },
    {
      id: "prepare-battle-skill",
      supportedActions: ["prepare_battle"],
      toolDependencies: ["combat.prepareBattle"],
      interruptible: true,
      tickRateMs: 800,
      estimate: () => ok(0.9, "combat preparation is deterministic"),
      compile: (action) => [
        {
          skill: "combat.prepareBattle",
          args: {
            preferIronSword: action.params.preferIronSword ?? true,
            equipArmor: action.params.equipArmor ?? true
          }
        }
      ]
    },
    {
      id: "tpa-skill",
      supportedActions: ["request_teleport_to_player"],
      toolDependencies: ["chat.requestTeleportToPlayer"],
      interruptible: true,
      tickRateMs: 500,
      estimate: (action) =>
        hasStringParam(action, "playerName") ? ok(0.9, "target player specified") : no("missing playerName"),
      compile: (action) => [
        {
          skill: "chat.requestTeleportToPlayer",
          args: {
            playerName: action.params.playerName
          }
        }
      ]
    },
    {
      id: "equip-category-skill",
      supportedActions: ["equip_category"],
      toolDependencies: ["inventory.holdByCategory"],
      interruptible: true,
      tickRateMs: 500,
      estimate: (action) =>
        hasStringParam(action, "category") ? ok(0.85, "category provided") : no("missing category"),
      compile: (action) => [{ skill: "inventory.holdByCategory", args: { category: action.params.category } }]
    },
    {
      id: "organize-inventory-skill",
      supportedActions: ["organize_inventory"],
      toolDependencies: ["inventory.organizeHotbar"],
      interruptible: true,
      tickRateMs: 1000,
      estimate: () => ok(0.8, "organize hotbar is deterministic"),
      compile: () => [{ skill: "inventory.organizeHotbar", args: {} }]
    },
    {
      id: "drop-item-skill",
      supportedActions: ["drop_item"],
      toolDependencies: ["interact.dropHotbarSlot", "inventory.holdByCategory", "interact.dropHeld"],
      interruptible: true,
      tickRateMs: 800,
      estimate: () => ok(0.8, "drop target can be resolved from held item, category, or slot"),
      compile: (action) => {
        const mode = action.params.mode === "stack" ? "stack" : "one";
        if (typeof action.params.slot === "number") {
          return [
            {
              skill: "interact.dropHotbarSlot",
              args: {
                slot: action.params.slot,
                mode,
                restorePrevious: action.params.restorePrevious ?? true
              }
            }
          ];
        }
        if (hasStringParam(action, "category")) {
          return [
            {
              skill: "inventory.holdByCategory",
              args: { category: action.params.category }
            },
            {
              skill: "interact.dropHeld",
              args: { mode }
            }
          ];
        }
        return [{ skill: "interact.dropHeld", args: { mode } }];
      }
    },
    {
      id: "open-door-skill",
      supportedActions: ["open_door"],
      toolDependencies: ["interact.openDoor"],
      interruptible: true,
      tickRateMs: 500,
      estimate: () => ok(0.75, "door interaction is lightweight"),
      compile: (action) => [
        {
          skill: "interact.openDoor",
          args: {
            reach: action.params.reach ?? 4.5,
            radius: action.params.radius ?? 6
          }
        }
      ]
    },
    {
      id: "wander-skill",
      supportedActions: ["wander_area"],
      toolDependencies: ["movement.walk"],
      interruptible: true,
      tickRateMs: 1000,
      estimate: () => ok(0.7, "generic local wandering"),
      compile: (action) => [
        {
          skill: "movement.walk",
          args: {
            durationMs: action.params.durationMs === undefined ? 1500 : action.params.durationMs,
            sprint: action.params.sprint === undefined ? false : action.params.sprint,
            jump: action.params.jump === undefined ? false : action.params.jump
          }
        }
      ]
    },
    {
      id: "social-skill",
      supportedActions: ["socialize", "speak", "observe_target"],
      toolDependencies: [
        "chat.send",
        "player.look",
        "observe.nearbyPlayers",
        "observe.nearbyEntities"
      ],
      interruptible: true,
      tickRateMs: 500,
      estimate: (_action, state) => {
        const hasPlayers = Array.isArray(state.perception?.salientPlayers) || Array.isArray(state.perception?.nearbyPlayers);
        return ok(hasPlayers ? 0.8 : 0.6, "social action is lightweight");
      },
      compile: (action) => {
        if (action.kind === "speak") {
          return [{ skill: "chat.send", args: { message: String(action.params.text ?? "") } }];
        }
        if (hasFiniteLookAngles(action)) {
          return [{ skill: "player.look", args: { yaw: action.params.yaw, pitch: action.params.pitch } }];
        }
        if (action.kind === "socialize") {
          return [{ skill: "observe.nearbyPlayers", args: { radius: 32 } }];
        }
        return [{ skill: "observe.nearbyEntities", args: { radius: 24 } }];
      }
    },
    {
      id: "mining-skill",
      supportedActions: ["mine_visible"],
      toolDependencies: ["mine.collectVisible"],
      interruptible: true,
      tickRateMs: 1000,
      estimate: (action) =>
        Array.isArray(action.params.blockNames) || hasStringParam(action, "blockName")
          ? ok(0.85, "block target present")
          : no("missing block target"),
      compile: (action) => [
        {
          skill: "mine.collectVisible",
          args: {
            blockNames: action.params.blockNames ?? [action.params.blockName],
            searchRadius: action.params.searchRadius ?? 24,
            maxBlocks: action.params.maxBlocks ?? 8
          }
        }
      ]
    }
  ];
}

export function scoreActionAgainstCatalog(
  action: StrategicAction,
  state: AgentBlackboardSnapshot,
  catalog: SkillModuleDescriptor[]
): Array<{ module: SkillModuleDescriptor; affordance: SkillAffordance }> {
  return catalog
    .filter((module) => module.supportedActions.includes(action.kind))
    .map((module) => ({ module, affordance: module.estimate(action, state) }))
    .filter((entry) => entry.affordance.canRun)
    .sort((a, b) => b.affordance.score - a.affordance.score);
}

export interface SkillToolPermissionGap {
  moduleId: string;
  tool: string;
  supportedActions: readonly StrategicAction["kind"][];
}

export function auditSkillCatalogToolPermissions(
  catalog: readonly SkillModuleDescriptor[],
  allowedTools: readonly string[]
): SkillToolPermissionGap[] {
  const allowed = new Set(allowedTools);
  const gaps: SkillToolPermissionGap[] = [];

  for (const module of catalog) {
    for (const tool of new Set(module.toolDependencies)) {
      if (allowed.has(tool)) continue;
      gaps.push({
        moduleId: module.id,
        tool,
        supportedActions: [...module.supportedActions]
      });
    }
  }

  return gaps;
}

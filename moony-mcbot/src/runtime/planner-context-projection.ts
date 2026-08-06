type UnknownRecord = Record<string, unknown>;

export interface PlannerTaskSummary {
  type: unknown;
  status: unknown;
  source: unknown;
  goal: unknown;
  detail: unknown;
  lastError: unknown;
}

export interface PlannerStrategicGoalSummary {
  goal: unknown;
  rationale: unknown;
  source: unknown;
  milestones: string[];
  currentMilestoneIndex: unknown;
  failureCount: unknown;
}

export interface PlannerContextProjection {
  mode: unknown;
  runtimeState: unknown;
  self: {
    movement: UnknownRecord;
    vitals: UnknownRecord;
    heldItem: UnknownRecord | null;
    armor: UnknownRecord;
    inventory: {
      freeSlots: unknown;
      bestFood: unknown;
      foodCount: unknown;
      itemSummary: UnknownRecord[];
      toolSummary: UnknownRecord;
    };
    currentActivity: { type: unknown };
  };
  world: {
    dimension: unknown;
    time: UnknownRecord;
    terrain: UnknownRecord;
    visibleBlocks: UnknownRecord[];
    focus: UnknownRecord;
    salient: UnknownRecord;
  };
  nearbyPlayers: UnknownRecord[];
  nearbyEntities: UnknownRecord[];
  task: {
    activeTask: PlannerTaskSummary | null;
    subTask: UnknownRecord | null;
    risk: UnknownRecord | null;
  };
  strategicGoal: PlannerStrategicGoalSummary | null;
  recentEvents: Array<{ type: unknown; priority: unknown }>;
}

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function asRecordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is UnknownRecord => entry !== null && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function scalar(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))
    ? value
    : null;
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function projectMovement(value: unknown): UnknownRecord {
  const source = asRecord(value);
  return {
    onGround: scalar(source.onGround),
    isMoving: scalar(source.isMoving),
    isFollowing: scalar(source.isFollowing),
    isPathfinding: scalar(source.isPathfinding)
  };
}

function projectVitals(value: unknown): UnknownRecord {
  const source = asRecord(value);
  return {
    health: scalar(source.health),
    food: scalar(source.food),
    oxygenLevel: scalar(source.oxygenLevel),
    isHurt: scalar(source.isHurt),
    isHungry: scalar(source.isHungry),
    isCritical: scalar(source.isCritical)
  };
}

function projectHeldItem(value: unknown): UnknownRecord | null {
  const source = asRecord(value);
  if (Object.keys(source).length === 0) return null;
  return {
    name: scalar(source.name),
    count: scalar(source.count)
  };
}

function projectArmor(value: unknown): UnknownRecord {
  const source = asRecord(value);
  return {
    head: scalar(source.head),
    torso: scalar(source.torso),
    legs: scalar(source.legs),
    feet: scalar(source.feet)
  };
}

function projectInventoryItems(value: unknown): UnknownRecord[] {
  return asRecordArray(value).slice(0, 16).map((item) => ({
    name: scalar(item.name),
    count: scalar(item.count)
  }));
}

function projectToolSummary(value: unknown): UnknownRecord {
  const source = asRecord(value);
  return {
    hasSword: scalar(source.hasSword),
    hasAxe: scalar(source.hasAxe),
    hasPickaxe: scalar(source.hasPickaxe)
  };
}

function projectBlock(value: unknown): UnknownRecord | null {
  const source = asRecord(value);
  if (Object.keys(source).length === 0) return null;
  return {
    name: scalar(source.name),
    displayName: scalar(source.displayName),
    distance: scalar(source.distance),
    visible: scalar(source.visible),
    interactable: scalar(source.interactable),
    hazardNear: scalar(source.hazardNear)
  };
}

function projectEntity(value: unknown): UnknownRecord | null {
  const source = asRecord(value);
  if (Object.keys(source).length === 0) return null;
  return {
    category: scalar(source.category),
    type: scalar(source.type),
    name: scalar(source.name),
    displayName: scalar(source.displayName),
    username: scalar(source.username),
    kind: scalar(source.kind),
    distance: scalar(source.distance),
    relation: scalar(source.relation),
    threatLevel: scalar(source.threatLevel),
    isVisible: scalar(source.isVisible)
  };
}

function projectEntities(value: unknown, limit: number): UnknownRecord[] {
  return asRecordArray(value)
    .map(projectEntity)
    .filter((entry): entry is UnknownRecord => entry !== null)
    .slice(0, limit);
}

function projectFocus(value: unknown): UnknownRecord {
  const source = asRecord(value);
  return {
    focusType: scalar(source.focusType),
    block: projectBlock(source.block),
    entity: projectEntity(source.entity)
  };
}

function projectSalient(value: unknown): UnknownRecord {
  const source = asRecord(value);
  return {
    nearbyPlayers: projectEntities(source.nearbyPlayers, 4),
    interestingEntities: projectEntities(source.interestingEntities, 6),
    interactableBlocks: asRecordArray(source.interactableBlocks)
      .map(projectBlock)
      .filter((entry): entry is UnknownRecord => entry !== null)
      .slice(0, 6)
  };
}

function projectTask(value: unknown): PlannerContextProjection["task"] {
  const taskContext = asRecord(value);
  const activeSource = asRecord(taskContext.activeTask);
  const subTaskSource = asRecord(taskContext.subTask);
  const riskSource = asRecord(taskContext.risk);

  return {
    activeTask: Object.keys(activeSource).length === 0
      ? null
      : {
          type: scalar(activeSource.type),
          status: scalar(activeSource.status),
          source: scalar(activeSource.source),
          goal: scalar(activeSource.goal),
          detail: scalar(activeSource.detail),
          lastError: scalar(activeSource.lastError)
        },
    subTask: Object.keys(subTaskSource).length === 0
      ? null
      : {
          type: scalar(subTaskSource.type),
          status: scalar(subTaskSource.status),
          detail: scalar(subTaskSource.detail)
        },
    risk: Object.keys(riskSource).length === 0
      ? null
      : {
          level: scalar(riskSource.level),
          reasons: stringList(riskSource.reasons, 6)
        }
  };
}

function projectStrategicGoal(value: unknown): PlannerStrategicGoalSummary | null {
  const source = asRecord(value);
  if (Object.keys(source).length === 0) return null;
  return {
    goal: scalar(source.goal),
    rationale: scalar(source.rationale),
    source: scalar(source.source),
    milestones: stringList(source.milestones, 8),
    currentMilestoneIndex: scalar(source.currentMilestoneIndex),
    failureCount: scalar(source.failureCount)
  };
}

export function buildPlannerContextProjection(stateSnapshot: Record<string, unknown>): PlannerContextProjection {
  const selfState = asRecord(stateSnapshot.selfState);
  const equipment = asRecord(selfState.equipment);
  const inventory = asRecord(selfState.inventory);
  const currentActivity = asRecord(selfState.currentActivity);
  const localWorld = asRecord(stateSnapshot.localWorld);
  const time = asRecord(localWorld.time);
  const terrain = asRecord(localWorld.terrain);
  const entities = asRecordArray(stateSnapshot.entities);
  const memorySummary = asRecord(stateSnapshot.memorySummary);

  return {
    mode: scalar(stateSnapshot.mode),
    runtimeState: scalar(stateSnapshot.runtimeState),
    self: {
      movement: projectMovement(selfState.movement),
      vitals: projectVitals(selfState.vitals),
      heldItem: projectHeldItem(equipment.heldItem),
      armor: projectArmor(equipment.armor),
      inventory: {
        freeSlots: scalar(inventory.freeSlots),
        bestFood: scalar(inventory.bestFood),
        foodCount: scalar(inventory.foodCount),
        itemSummary: projectInventoryItems(inventory.itemSummary),
        toolSummary: projectToolSummary(inventory.toolSummary)
      },
      currentActivity: { type: scalar(currentActivity.type) }
    },
    world: {
      dimension: scalar(localWorld.dimension),
      time: {
        isDay: scalar(time.isDay),
        isNight: scalar(time.isNight),
        isRaining: scalar(time.isRaining)
      },
      terrain: {
        feetBlock: scalar(terrain.feetBlock),
        inSightBlock: scalar(terrain.inSightBlock),
        hazards: stringList(terrain.hazards, 8)
      },
      visibleBlocks: asRecordArray(localWorld.visibleBlocks)
        .map(projectBlock)
        .filter((entry): entry is UnknownRecord => entry !== null)
        .slice(0, 8),
      focus: projectFocus(localWorld.focus),
      salient: projectSalient(localWorld.salient)
    },
    nearbyPlayers: projectEntities(entities.filter((entity) => entity.category === "player"), 6),
    nearbyEntities: projectEntities(entities.filter((entity) => entity.category !== "player"), 10),
    task: projectTask(stateSnapshot.taskContext),
    strategicGoal: projectStrategicGoal(memorySummary.strategicGoal),
    recentEvents: asRecordArray(stateSnapshot.events)
      .slice(-8)
      .map((event) => ({
        type: scalar(event.type),
        priority: scalar(event.priority)
      }))
  };
}

export function buildPlannerMemorySummary(stateSnapshot: Record<string, unknown>): string {
  const memorySummary = asRecord(stateSnapshot.memorySummary);
  const memory = asRecord(memorySummary.memory);
  const playerProfiles = asRecordArray(memory.playerProfiles).slice(0, 4);
  const places = asRecordArray(memory.places).slice(0, 4);
  const taskHistory = asRecordArray(memory.taskHistory).slice(-4);
  const parts: string[] = [];

  if (playerProfiles.length > 0) {
    const players = playerProfiles.map((profile) => {
      const name = String(scalar(profile.playerName) ?? "unknown");
      const relation = String(scalar(profile.relation) ?? "unknown");
      const aliasValue = scalar(profile.alias);
      const alias = typeof aliasValue === "string" && aliasValue ? ` alias=${aliasValue}` : "";
      const tags = stringList(profile.tags, 8);
      return `${name}(${relation}${alias}${tags.length > 0 ? ` tags=${tags.join("/")}` : ""})`;
    });
    parts.push(`Known players: ${players.join(", ")}.`);
  }

  if (places.length > 0) {
    const knownPlaces = places.map((place) => {
      const label = String(scalar(place.label) ?? "unknown");
      const dimensionValue = scalar(place.dimension);
      const dimension = typeof dimensionValue === "string" && dimensionValue ? ` dimension=${dimensionValue}` : "";
      const tags = stringList(place.tags, 8);
      return `${label}(${dimension}${tags.length > 0 ? ` tags=${tags.join("/")}` : ""})`;
    });
    parts.push(`Known places: ${knownPlaces.join(", ")}.`);
  }

  if (taskHistory.length > 0) {
    const history = taskHistory.map((task) => {
      const taskType = String(scalar(task.taskType) ?? "unknown");
      const status = String(scalar(task.status) ?? "unknown");
      const goalValue = scalar(task.goal);
      return `${taskType}:${status}${typeof goalValue === "string" && goalValue ? `:${goalValue}` : ""}`;
    });
    parts.push(`Recent task history: ${history.join("; ")}.`);
  }

  return parts.join(" ") || "No durable memory recorded yet.";
}

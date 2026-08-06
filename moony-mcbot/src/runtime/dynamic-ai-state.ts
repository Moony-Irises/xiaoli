export interface DynamicAiStateTextInput {
  activity: string;
  nearestPlayerDistance: number | null;
  nearPlayerDistance: number;
  minutesSinceProactive: number | null;
  mood: string;
  health?: number;
  food?: number;
  heldItemName?: string | null;
  foodCount: number;
  focusTarget?: string | null;
}

function formatDistanceBucket(distance: number | null, nearDistance: number): string {
  if (
    typeof distance !== "number" ||
    !Number.isFinite(distance) ||
    distance < 0 ||
    !Number.isFinite(nearDistance) ||
    nearDistance < 0
  ) {
    return "未知";
  }
  return distance <= nearDistance ? "近" : "远";
}

function formatHealth(health: number | undefined): string {
  return typeof health === "number" && Number.isFinite(health)
    ? health.toFixed(1)
    : "unknown";
}

function formatFood(food: number | undefined): string {
  return typeof food === "number" && Number.isFinite(food)
    ? `${food}/20`
    : "unknown";
}

export function buildDynamicAiStateText(input: DynamicAiStateTextInput): string {
  const heldItemName = input.heldItemName?.trim() || "empty";
  const focusTarget = input.focusTarget?.trim() || "没有明确目标";
  const proactiveTime = input.minutesSinceProactive === null
    ? "从未"
    : `${input.minutesSinceProactive}分钟前`;

  return [
    `你目前正在：${input.activity}`,
    `玩家距离你：${formatDistanceBucket(input.nearestPlayerDistance, input.nearPlayerDistance)}`,
    `上一次你主动说话：${proactiveTime}`,
    `你的心情：${input.mood}`,
    `你的状态：血量=${formatHealth(input.health)}，饥饿=${formatFood(input.food)}，手持=${heldItemName}，食物总数=${input.foodCount}`,
    `你正看着：${focusTarget}`
  ].join("\n");
}

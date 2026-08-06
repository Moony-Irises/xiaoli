export interface MiningPosition {
  x: number;
  y: number;
  z: number;
  offset(x: number, y: number, z: number): MiningPosition;
}

export interface MineflayerMiningBlock {
  name: string;
  type: number;
  boundingBox?: string;
  position: MiningPosition;
  digTime(
    toolType: number | null,
    creative: boolean,
    inWater: boolean,
    notOnGround: boolean,
    enchantments: unknown[],
    effects: Record<string, unknown>
  ): number;
}

export interface MineflayerMiningItem {
  name: string;
  type: number;
  nbt?: {
    value?: {
      Enchantments?: {
        value?: {
          value?: unknown[];
        };
      };
    };
  };
}

export interface MineflayerMiningClient {
  entity: {
    position: MiningPosition;
    height?: number;
    effects?: Record<string, unknown>;
    isInWater?: boolean;
    isInLava?: boolean;
    onGround?: boolean;
  };
  inventory: {
    items(): MineflayerMiningItem[];
  };
  pathfinder?: {
    bestHarvestTool?(block: MineflayerMiningBlock): MineflayerMiningItem | null;
  };
  blockAt(position: MiningPosition): MineflayerMiningBlock | null;
  canDigBlock(block: MineflayerMiningBlock): boolean;
  lookAt(position: MiningPosition, force?: boolean): Promise<void>;
  dig(block: MineflayerMiningBlock, forceLook?: boolean): Promise<void>;
  equip(item: MineflayerMiningItem, destination: "hand"): Promise<void>;
}

export function miningPositionDistance(a: MiningPosition, b: MiningPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isSameBlockPosition(a: MiningPosition, b: MiningPosition): boolean {
  return Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y) && Math.floor(a.z) === Math.floor(b.z);
}

function isOccludingBlock(block: MineflayerMiningBlock | null): boolean {
  if (!block || block.type === 0 || block.boundingBox === "empty") return false;
  return true;
}

export function canSeeBlockByRay(
  bot: MineflayerMiningClient,
  block: MineflayerMiningBlock,
  step = 0.2
): boolean {
  const eyeY = typeof bot.entity.height === "number" ? bot.entity.height : 1.62;
  const eye = bot.entity.position.offset(0, eyeY, 0);
  const target = block.position.offset(0.5, 0.5, 0.5);
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance <= 0.0001) return true;

  const stepSize = Math.max(0.05, Math.min(step, 0.5));
  const dirX = dx / distance;
  const dirY = dy / distance;
  const dirZ = dz / distance;
  for (let travelled = 0.15; travelled < distance - 0.1; travelled += stepSize) {
    const hit = bot.blockAt(eye.offset(dirX * travelled, dirY * travelled, dirZ * travelled));
    if (!hit || isSameBlockPosition(hit.position, block.position)) continue;
    if (isOccludingBlock(hit)) return false;
  }
  return true;
}

function computeDigTimeWithTool(
  bot: MineflayerMiningClient,
  block: MineflayerMiningBlock,
  item: MineflayerMiningItem | null
): number {
  try {
    const enchantments = item?.nbt?.value?.Enchantments?.value?.value ?? [];
    return block.digTime(
      item?.type ?? null,
      false,
      Boolean(bot.entity.isInWater || bot.entity.isInLava),
      bot.entity.onGround === false,
      enchantments,
      bot.entity.effects ?? {}
    );
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function findFastestToolForBlock(
  bot: MineflayerMiningClient,
  block: MineflayerMiningBlock
): MineflayerMiningItem | null {
  const fromPathfinder = bot.pathfinder?.bestHarvestTool?.(block);
  if (fromPathfinder) return fromPathfinder;

  const items = bot.inventory.items();
  let best: MineflayerMiningItem | null = null;
  let bestTime = computeDigTimeWithTool(bot, block, null);
  for (const item of items) {
    const digTime = computeDigTimeWithTool(bot, block, item);
    if (digTime < bestTime) {
      bestTime = digTime;
      best = item;
    }
  }
  return best;
}

export async function equipBestToolForBlock(
  bot: MineflayerMiningClient,
  block: MineflayerMiningBlock
): Promise<{ equipped: boolean; tool: string | null }> {
  const best = findFastestToolForBlock(bot, block);
  if (!best) return { equipped: false, tool: null };
  try {
    await bot.equip(best, "hand");
    return { equipped: true, tool: best.name };
  } catch {
    return { equipped: false, tool: best.name };
  }
}

# Agent Runtime State Schema

## 1. Purpose

This document defines the runtime JSON contracts for the future agent system.

Goal:
- make Minecraft runtime state consumable by an AI planner/executor
- separate "human-readable logs" from "machine-consumable state"
- keep the schema stable enough that tools, planner, executor, and memory can all depend on it

This schema is intentionally designed for:
- one bot instance
- one active high-level task at a time
- short-horizon planning first

## 2. Top-Level Runtime Object

The agent runtime should be able to build a single snapshot object like this:

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "timestamp": "2026-03-06T10:00:00.000Z",
  "mode": "manual",
  "runtimeState": "idle",
  "selfState": {},
  "localWorld": {},
  "entities": [],
  "events": [],
  "taskContext": {},
  "memorySummary": {}
}
```

Field meanings:
- `mode`: agent control mode, such as `manual`, `assist`, `auto`
- `runtimeState`: current execution state, such as `idle`, `social`, `task_running`, `guarded`
- `selfState`: bot's own immediate state
- `localWorld`: nearby searchable world information
- `entities`: nearby entity summary
- `events`: recent important events
- `taskContext`: active task and execution context
- `memorySummary`: compressed long-term summary

## 3. Self State

`selfState` should be treated as the highest-priority input for immediate planning.

Recommended schema:

```json
{
  "position": {
    "x": 100.5,
    "y": 64,
    "z": -20.5
  },
  "rotation": {
    "yaw": 1.57,
    "pitch": 0.15
  },
  "movement": {
    "onGround": true,
    "velocity": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "isMoving": false,
    "isFollowing": false,
    "isPathfinding": false
  },
  "vitals": {
    "health": 20,
    "food": 18,
    "oxygenLevel": 20,
    "isHurt": false,
    "isHungry": false,
    "isCritical": false
  },
  "equipment": {
    "heldItem": {
      "name": "iron_pickaxe",
      "count": 1,
      "slot": 38
    },
    "armor": {
      "head": "iron_helmet",
      "torso": "iron_chestplate",
      "legs": "iron_leggings",
      "feet": "iron_boots"
    }
  },
  "inventory": {
    "freeSlots": 12,
    "foodCount": 18,
    "bestFood": "bread",
    "toolSummary": {
      "hasSword": true,
      "hasAxe": true,
      "hasPickaxe": true
    }
  },
  "effects": [],
  "currentActivity": {
    "type": "idle",
    "detail": ""
  }
}
```

Minimum required fields for first version:
- position
- vitals
- held item
- inventory free slots
- current activity

## 4. Local World

`localWorld` is not the whole world. It is only the search area the executor can reason about right now.

Recommended structure:

```json
{
  "radius": 24,
  "dimension": "minecraft:overworld",
  "time": {
    "isDay": true,
    "isNight": false,
    "isRaining": false
  },
  "terrain": {
    "feetBlock": "grass_block",
    "inSightBlock": "oak_log",
    "hazards": [
      {
        "type": "lava",
        "position": { "x": 104, "y": 63, "z": -17 },
        "distance": 5.2
      }
    ]
  },
  "visibleBlocks": [
    {
      "name": "coal_ore",
      "position": { "x": 108, "y": 62, "z": -15 },
      "distance": 8.4,
      "visible": true,
      "interactable": false,
      "hazardNear": false
    }
  ],
  "interactables": [
    {
      "name": "oak_door",
      "position": { "x": 101, "y": 64, "z": -18 },
      "distance": 3.1,
      "visible": true
    }
  ],
  "drops": [
    {
      "name": "cobblestone",
      "position": { "x": 102, "y": 64, "z": -21 },
      "distance": 1.9
    }
  ]
}
```

Important design rule:
- `visibleBlocks` means line-of-sight validated search results, not "all scanned blocks underground"

For phase 1, the runtime does not need a full block grid.
It is enough to build:
- visible resources
- interactable blocks
- local hazards
- drops

## 5. Entities

The planner should not read raw Mineflayer entities directly.
It should only see normalized entity summaries.

Recommended schema:

```json
[
  {
    "entityId": 123,
    "type": "player",
    "name": "Judy",
    "distance": 4.2,
    "position": { "x": 99, "y": 64, "z": -19 },
    "relation": "owner",
    "threatLevel": 0,
    "isVisible": true
  },
  {
    "entityId": 456,
    "type": "mob",
    "name": "zombie",
    "distance": 6.8,
    "position": { "x": 106, "y": 64, "z": -22 },
    "relation": "hostile",
    "threatLevel": 3,
    "isVisible": true
  }
]
```

Required normalized fields:
- `entityId`
- `type`
- `name`
- `distance`
- `relation`
- `threatLevel`
- `isVisible`

Recommended `relation` enum:
- `owner`
- `whitelist`
- `neutral`
- `hostile`
- `unknown`

Recommended `threatLevel`:
- `0`: harmless
- `1`: low
- `2`: moderate
- `3`: immediate

## 6. Event Schema

Events should be short-lived, append-only records for recent important changes.

Recommended schema:

```json
[
  {
    "id": "evt_001",
    "timestamp": "2026-03-06T10:00:01.000Z",
    "type": "chat_received",
    "priority": "normal",
    "payload": {
      "username": "Judy",
      "message": "小狸 下矿"
    }
  },
  {
    "id": "evt_002",
    "timestamp": "2026-03-06T10:00:02.000Z",
    "type": "hurt",
    "priority": "high",
    "payload": {
      "source": "zombie",
      "healthBefore": 20,
      "healthAfter": 17
    }
  }
]
```

Recommended initial event types:
- `chat_received`
- `wake_command`
- `hurt`
- `entity_dead`
- `item_drop_seen`
- `inventory_changed`
- `task_started`
- `task_finished`
- `task_failed`

Recommended `priority`:
- `low`
- `normal`
- `high`
- `critical`

Retention recommendation:
- planner reads last `10-20` events max
- executor reads only recent high-priority events

## 7. Task Context

This is the most important missing piece in the current project.
The agent should always know:
- what it is doing
- why it is doing it
- how far it has progressed
- what can interrupt it

Recommended schema:

```json
{
  "activeTask": {
    "taskId": "task_001",
    "type": "gather_visible_ore",
    "source": "player_command",
    "status": "running",
    "goal": "清理 Judy 附近 32 格内可见矿物",
    "owner": "Judy",
    "createdAt": "2026-03-06T10:00:00.000Z",
    "updatedAt": "2026-03-06T10:00:05.000Z",
    "params": {
      "centerPlayer": "Judy",
      "radius": 32,
      "blockNames": ["coal_ore", "iron_ore"]
    },
    "progress": {
      "stepsCompleted": 1,
      "stepsTotal": 3,
      "minedCount": 4
    },
    "constraints": {
      "interruptible": true,
      "timeoutMs": 120000,
      "returnToOwnerAfterDone": true
    }
  },
  "subTask": {
    "type": "move_to_block",
    "status": "running",
    "detail": "approaching visible iron ore"
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "resourceNeeds": {
    "food": false,
    "pickaxe": false,
    "freeInventorySlots": true
  }
}
```

Recommended task status enum:
- `pending`
- `running`
- `blocked`
- `done`
- `failed`
- `cancelled`

## 8. Memory Summary

This is not the raw long-term memory store.
It is the planner-facing compressed summary.

Recommended schema:

```json
{
  "owner": "Judy",
  "homeBase": {
    "x": 100,
    "y": 64,
    "z": -20
  },
  "knownAreas": [
    "spawn",
    "mine_entrance_north"
  ],
  "knownResourceHints": [
    {
      "type": "visible_ore_cluster",
      "label": "coal_near_spawn_hill"
    }
  ],
  "socialPreferences": {
    "whitelistPlayers": ["Judy"],
    "persona": "小狸"
  }
}
```

First phase can keep this very small:
- owner
- whitelist players
- optional base position

## 9. Planner Input Contract

The planner should not read arbitrary tool output.
It should receive a stable envelope:

```json
{
  "instruction": "没有任务时跟随 Judy；如果 Judy 命令你下矿，就去清理她附近可见矿",
  "runtime": {
    "botId": "XiaoLi_26.3.3_newnancity",
    "mode": "assist",
    "runtimeState": "idle",
    "selfState": {},
    "localWorld": {},
    "entities": [],
    "events": [],
    "taskContext": {},
    "memorySummary": {}
  },
  "policy": {
    "allowedTools": [
      "observe.self",
      "observe.inventory",
      "observe.nearbyPlayers",
      "mine.collectVisible",
      "move.followPlayer",
      "move.stopFollow",
      "chat.send"
    ],
    "maxToolCallsPerTurn": 1
  }
}
```

## 10. Planner Output Contract

Recommended first-version output:

```json
{
  "intent": "execute_skill",
  "reason": "Judy is nearby and no active task exists",
  "speak": "我跟着你。",
  "tool": "move.followPlayer",
  "arguments": {
    "playerName": "Judy",
    "minDistance": 2.5,
    "maxDistance": 24,
    "sprint": true,
    "tickMs": 250
  }
}
```

Or:

```json
{
  "intent": "no_action",
  "reason": "current active task should not be interrupted"
}
```

Future multi-step version can extend to:

```json
{
  "intent": "plan",
  "goal": "gather_visible_ore",
  "steps": [
    { "tool": "observe.inventory", "arguments": {} },
    { "tool": "mine.collectVisible", "arguments": { "maxBlocks": 8 } }
  ]
}
```

But this should not be the first implementation.

## 11. Executor Runtime Contract

Executor should maintain a per-bot object like:

```json
{
  "botId": "XiaoLi_26.3.3_newnancity",
  "activePlanId": "plan_001",
  "currentStepIndex": 0,
  "lastToolCallAt": "2026-03-06T10:00:00.000Z",
  "lastToolResult": {
    "tool": "move.followPlayer",
    "ok": true,
    "summary": "Started following Judy"
  }
}
```

This should be separate from `taskContext`.
`taskContext` is planner-facing.
Executor runtime is execution-facing.

## 12. Interrupt Rules

The schema should explicitly support interruption.

Required interrupt reasons:
- `manual_command`
- `self_guard`
- `task_timeout`
- `target_lost`
- `owner_override`

Every active task should be assumed interruptible unless explicitly marked otherwise.

## 13. Minimum Implementable Subset

Before full agent runtime, the project should implement this minimal schema subset:

### Required now

- `selfState.position`
- `selfState.vitals`
- `selfState.equipment.heldItem`
- `selfState.currentActivity`
- `entities[]` with player + nearby hostile summary
- `events[]` with last few `chat_received` and `hurt`
- `taskContext.activeTask`
- `memorySummary.owner`

### Can wait

- full local block grid
- explored area memory
- detailed event replay
- long-term resource graph

## 14. Next Implementation Mapping

Recommended implementation order:

1. `agent.buildStateSnapshot(botId)`
- internal function first
- later expose as MCP debug tool if needed

2. `agent.recordEvent(...)`
- unify chat/hurt/task events into one recent event queue

3. `agent.activeTask` runtime object
- one active task per bot

4. planner input/output validation
- strict JSON schema check

5. executor state
- one current tool call result per turn


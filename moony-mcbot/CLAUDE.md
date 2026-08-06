# moony-mcbot

Minecraft Java bot and local agent control plane built with TypeScript, Mineflayer, MCP and a local Web debug panel.

## Structure

- `src/runtime/`: bot lifecycle, client adapters and typed runtime projections
- `src/agent/`: blackboard, event bus, reactive rules and skill catalog
- `src/catalog/`: shared tool metadata and exposure policy
- `src/commands/`: cross-entry command validation, terminal results and bounded history
- `src/config/`: persisted configuration parsing, file I/O and write lifecycle
- `src/tools/`: MCP tools and legacy domain orchestration under migration
- `src/debug/`: local Web debug panel
- `src/memory/`: shared game/chat memory storage
- `scripts/`: typed repository validation and test infrastructure
- `docs/`: architecture, testing and migration plans

## Commands

- `npm run validate:releases`
- `npm run lint`
- `npm run build`
- `npm run typecheck`
- `npm test`

## Architecture

The current implementation is in an adapter and command-boundary migration stage. See [docs/architecture-convergence-roadmap.md](docs/architecture-convergence-roadmap.md), [docs/command-invocation-design.md](docs/command-invocation-design.md), [docs/persistence-lifecycle-design.md](docs/persistence-lifecycle-design.md), [docs/release-entry-lifecycle.md](docs/release-entry-lifecycle.md), and [docs/modded-client-adapter-plan.md](docs/modded-client-adapter-plan.md).

## Current Focus

The project is stabilizing runtime determinism before further Adapter or modded-client work. Runtime lifecycle, command history, ConfigRepository file I/O, all four core config stores, AI requests, Chat AI/self-guard queued tasks, self-guard subscriptions, timer handles, retaliation state, short-lived guard observations, alert cooldown and reactive threshold decisions, core reconnect/health transitions, proximity transitions, combat throttling, guard environment transitions, retaliation target selection/revalidation and continuous tick decisions now have explicit owners. Agent composed state, planner execution, full self-guard tick/chase/attack orchestration, true damage attribution, Adapter world environment snapshots, four-table commit, remaining commands and domain state still need migration. Mineflayer remains the only production default. Node 22+ is required and CI covers Node 22/24. First release archival, external MCP and real auth/server lifecycle tests remain pending.

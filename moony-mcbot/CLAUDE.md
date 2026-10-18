# moony-mcbot

Minecraft Java bot and local agent control plane built with TypeScript, Mineflayer, MCP and a local Web debug panel.

## Structure

- `../README.md`: repository overview, quick start and public project status
- `src/runtime/`: bot lifecycle, client adapters and typed runtime projections
- `src/agent/`: blackboard, event bus, reactive rules and skill catalog
- `src/catalog/`: shared tool metadata and exposure policy
- `src/commands/`: cross-entry command validation, terminal results and bounded history
- `src/config/`: persisted configuration parsing, file I/O and write lifecycle
- `src/tools/`: MCP tools and legacy domain orchestration under migration
- `src/debug/`: local Web debug panel
- `src/memory/`: shared game/chat memory storage
- `scripts/`: typed repository validation and test infrastructure
- `docs/`: indexed architecture, testing, contracts and migration plans; start at `docs/README.md`

## Commands

- `npm run validate:releases`
- `npm run lint`
- `npm run build`
- `npm run typecheck`
- `npm test`
- `powershell -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1`

## Architecture

Start from [docs/README.md](docs/README.md). The current implementation is in an adapter and command-boundary migration stage; the authoritative sequence is [docs/architecture-convergence-roadmap.md](docs/architecture-convergence-roadmap.md), and manual verification starts at [docs/manual-testing-guide.md](docs/manual-testing-guide.md).

## Current Focus

Complete the planner/blackboard/command path before Modded Client work. Planning and single-action execution have independent boundaries; [the design](docs/strategic-planner-injection-design.md) records compatibility, cancellation and event-delivery limits. Eat Skill preserves optional itemName through explicit/legacy plans and rejects invalid values without automatic eating. Default permissions stay unchanged; real API/game evidence remains in [manual testing](docs/manual-testing-guide.md).

Mineflayer remains the production default. Node 22+ is required; CI covers Node 22/24. Follow/path movement must not dig or place blocks; manual testing section 6.4 distinguishes initial path errors from continuous movement failures and covers recovery. Conventions and validation commands are in [eslint.config.js](eslint.config.js), [tsconfig.json](tsconfig.json), and [test/README.md](test/README.md).

---
type: chore
scope: workspace
audience: developer
summary: Add workspace Git ignore hygiene and VS Code extension recommendations
breaking: false
demo_ready: false
tests: git check-ignore -v moony-mcbot/node_modules/.package-lock.json moony-mcbot/dist/main.js moony-mcbot/.env
artifacts:
  - ../.gitignore
  - .vscode/extensions.json
---

## What changed

Added ignore coverage for generated dependencies, build outputs, environment files, logs, and coverage artifacts so the first Git commit does not include local runtime/build noise. Also added VS Code extension recommendations for GitHub workflow and TypeScript editing.

## Why it matters

The repository was initialized one directory above the project and had staged `node_modules` and `dist`, which made commit/push unnecessarily large and fragile. The recommendations file gives VS Code a lightweight way to prompt for useful project extensions without making them mandatory.

## Demo posture / limitations

This is workspace hygiene only. It does not change bot runtime behavior, does not publish anything to GitHub, and does not configure a remote repository URL.

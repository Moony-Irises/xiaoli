# Shared Prompt and Context Memory Plan

This document defines how XiaoLi persona prompts and rolling interaction summaries should be shared by `moony-mcbot`, Voice/TTS, and future livestream modules.

The core rule: stable persona, rolling summaries, and durable facts must stay separate. Mixing them into one free-form prompt will make McBot and Voice pollute each other.

## Goals

- Put XiaoLi's stable persona in `C:\xiaoli\memory`, not only in McBot's local config.
- Let Voice and livestream code read the same persona and recent context without parsing McBot runtime files.
- Let Minecraft chat and livestream danmaku summarize independently, then merge into one compact cross-channel context.
- Avoid storing secrets, raw long-term chat logs, or joke claims as durable facts.

## Recommended Layout

```text
C:\xiaoli\memory
├─ persona
│  ├─ xiaoli-profile.json
│  └─ xiaoli-profile.md
├─ context
│  ├─ context-pack.json
│  ├─ interaction-summary-state.json
│  ├─ interaction-summaries.jsonl
│  └─ source-states
│     ├─ mcbot-chat.json
│     └─ voice-live.json
├─ players.json
├─ places.json
├─ preferences.json
└─ episodes.jsonl
```

## Stable Persona

File: `C:\xiaoli\memory\persona\xiaoli-profile.json`

This is the shared source for identity, tone, speaking constraints, aliases, and reusable local scene lines.

Suggested shape:

```json
{
  "version": 1,
  "updatedAt": "2026-07-08T00:00:00.000Z",
  "source": "Human",
  "profileId": "xiaoli-main",
  "identity": {
    "name": "小狸",
    "age": 18,
    "world": "Minecraft",
    "owner": "Judy",
    "role": "Judy 在 Minecraft 世界里的朋友"
  },
  "speech": {
    "tone": "cool_short_dry",
    "averageLengthHint": "around_10_chinese_chars",
    "avoid": [
      "flattery",
      "customer_service_tone",
      "over_explaining",
      "overusing_player_name",
      "romance_or_devotion"
    ],
    "styleRules": [
      "短句优先",
      "可以冷幽默、反讽、装傻",
      "不知道就说不知道",
      "不要编造没看到的事情"
    ]
  },
  "sceneLines": {
    "nearPlayer": ["嗯？", "说。", "怎么了。"],
    "idleMurmur": ["发呆中。", "有点安静。"],
    "followStart": ["知道了，跟着。", "别走太快。"]
  },
  "promptFragments": {
    "core": "你叫小狸，18岁，是 Judy 在 Minecraft 世界里的朋友。",
    "style": "回复短、自然、偏冷，不奉承，不客服腔。",
    "safety": "没看到的事就说不知道，不要把玩笑当事实。"
  }
}
```

`xiaoli-profile.md` may exist for human editing, but runtime code should prefer the JSON file.

## Per-Source Pending Buffers

Each module owns its own short-term pending buffer.

- McBot: `C:\xiaoli\memory\context\source-states\mcbot-chat.json`
- Voice/live: `C:\xiaoli\memory\context\source-states\voice-live.json`

Suggested shape:

```json
{
  "version": 1,
  "source": "Voice",
  "pendingLimit": 20,
  "pending": [
    {
      "time": "2026-07-08T00:00:00.000Z",
      "channel": "bilibili_danmaku",
      "speaker": "viewer_name",
      "text": "弹幕内容",
      "tags": ["live", "chat"]
    }
  ],
  "lastSummaryId": "voice-live-0001",
  "updatedAt": "2026-07-08T00:00:00.000Z"
}
```

Pending buffers are working memory. Normal reply generation should not read them directly.

## Cross-Channel Summary

File: `C:\xiaoli\memory\context\interaction-summary-state.json`

This file merges Minecraft chat summaries and Voice/live summaries.

```json
{
  "version": 1,
  "updatedAt": "2026-07-08T00:00:00.000Z",
  "lastSummary": {
    "id": "cross-0007",
    "source": "CrossChannelSummarizer",
    "text": "McBot: ... Voice: ... Cross-channel: ...",
    "players": ["Judy"],
    "topics": ["minecraft", "live_chat"],
    "replyGuidance": [
      "对 Judy 保持短句、偏冷、少奉承",
      "直播弹幕多时优先回应清晰问题",
      "不要把弹幕玩笑写成稳定事实"
    ]
  },
  "previousSummaryId": "cross-0006"
}
```

The cross-channel summarizer should read the previous merged summary plus new source summaries, then write this file and append to `interaction-summaries.jsonl`.

## Context Pack

File: `C:\xiaoli\memory\context\context-pack.json`

This is the convenient single read target for McBot, Voice, and livestream modules before calling an LLM.

```json
{
  "version": 1,
  "generatedAt": "2026-07-08T00:00:00.000Z",
  "personaProfilePath": "C:\\xiaoli\\memory\\persona\\xiaoli-profile.json",
  "persona": {
    "name": "小狸",
    "owner": "Judy",
    "systemPrompt": "你叫小狸... 回复短、自然、偏冷..."
  },
  "context": {
    "rollingSummary": "最近 Judy 在游戏和直播里都在和小狸闲聊。Judy 语气轻松，喜欢逗小狸。小狸应短句回应，避免奉承。",
    "replyGuidance": ["短句", "偏冷", "不客服腔", "不把玩笑当事实"],
    "recentTopics": ["minecraft", "live_chat"],
    "importantFacts": []
  },
  "limits": {
    "maxPromptChars": 1200,
    "rawPendingIncluded": false
  }
}
```

Read priority for Voice/live modules:

1. `context/context-pack.json`
2. `persona/xiaoli-profile.json` plus `context/interaction-summary-state.json`
3. Local module defaults

McBot is game-only by default and should not load the Voice/live `context-pack.json` as its chat system prompt. McBot reads its own prompt profile and may separately read McBot-owned chat summaries.

## Migration Path

Current McBot prompt profile:

```text
%LOCALAPPDATA%\moony-mcbot\config\prompt-profile.json
```

Recommended McBot loading priority:

1. `MCBOT_PROMPT_PROFILE_PATH`, if explicitly set
2. `XIAOLI_MEMORY_DIR\prompts\mcbot-prompt-profile.json`
3. `%LOCALAPPDATA%\moony-mcbot\config\prompt-profile.json` as one-time migration source if the shared file is missing
4. Built-in default

Recommended Voice/live loading priority:

1. `XIAOLI_MEMORY_DIR\context\context-pack.json`
2. `XIAOLI_MEMORY_DIR\persona\xiaoli-profile.json`
3. Voice local default

## Safety Rules

- Do not store API keys, account passwords, stream tokens, cookies, or auth state in shared memory.
- Do not put raw pending buffers into `context-pack.json`.
- Mark source names explicitly: `McBot`, `Voice`, `Pic`, `CrossChannelSummarizer`.
- Treat danmaku, jokes, roleplay, and teasing as non-facts unless confirmed.
- Stable files should use JSON with `version`; append-only history should use JSONL.

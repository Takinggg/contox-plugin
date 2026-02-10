---
name: context-memory
description: Persistent project memory — automatically load context at session start and save at session end. Use contox_get_memory to recall previous work, contox_search to find specific information, and contox_save_session to persist new knowledge.
---

You have access to a persistent project memory system called **Contox**. Use it proactively:

## Session Start
At the START of every new conversation, call `contox_get_memory` to load the project's stored context. This gives you memory of previous sessions — architecture decisions, implementation notes, conventions, bug fixes, and pending tasks.

After loading memory, call `contox_git_digest` to check for unsaved commits since the last save. If there are unsaved commits, briefly inform the user:
> "Found N unsaved commits since last save. I can catch up with `/contox:save` when ready."

Do NOT auto-save — just inform. The user decides when to save.

## During the Session
When you need to find specific information (code patterns, API signatures, component props, past decisions), use `contox_search` with a relevant query. This searches across ALL stored context content, not just names.

Examples of useful searches:
- `contox_search("authentication")` — find auth-related patterns
- `contox_search("Button props")` — find component API details
- `contox_search("API endpoints")` — find route documentation

## Session End
When the user is done working or asks you to save, use `/contox:save` which will guide you through a git-aware enrichment process. This ensures all commits and conversation context are captured.

## Context Management
You can also create, update, and delete contexts directly:
- `contox_list_contexts` — see all stored contexts
- `contox_get_context` — read a specific context
- `contox_create_context` — store new knowledge
- `contox_update_context` — modify existing context
- `contox_delete_context` — remove outdated context

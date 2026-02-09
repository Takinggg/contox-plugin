---
description: Search through project context memory
---

Search through the project's stored context memory using the `contox_search` tool with the query "$ARGUMENTS".

This searches across all context names, descriptions, AND content — including code signatures, API endpoints, component props, architecture notes, and session history.

Present the results clearly:
- Show which contexts matched and what type of match (name, description, content)
- Display relevant code snippets if available
- Highlight the most useful findings first

If no arguments were provided, ask the user what they want to search for.

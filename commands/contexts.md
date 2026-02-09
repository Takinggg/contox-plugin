---
description: List and manage project contexts
---

Use the `contox_list_contexts` tool to show all contexts for the current project.

Display them in a clear, organized format:
- Group by hierarchy (parent → children)
- Show name, token count, and last updated date
- Highlight [Memory] vs [Scan] sub-contexts

If $ARGUMENTS contains:
- "create <name>" → Use `contox_create_context` to create a new context with that name
- "delete <id>" → Use `contox_delete_context` to delete the context (confirm with user first)
- "get <id>" → Use `contox_get_context` to show the full content of that context
- Otherwise → Just list all contexts

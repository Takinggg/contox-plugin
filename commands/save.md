---
description: Save this session's work into persistent project memory
---

Save the current session's work into persistent project memory. Follow these steps IN ORDER:

## Step 1: Git Digest
Call `contox_git_digest` to get all commits since the last save plus any WIP (work-in-progress).

If the tool errors (e.g., not a git repo), skip to Step 2 and proceed with conversation-only analysis.

## Step 2: Analyze & Enrich
Cross-reference the git digest with the full conversation history.

### For each commit from the digest:

1. **Categorize** using the commit prefix and diff content:
   - `fix:` → category `bugs` (title = bug description, content = root cause + fix + files)
   - `feat:` → category `implementation` (title = feature name, content = what was built + key files + patterns)
   - `refactor:` → category `decisions` or `conventions` (title = what changed, content = why + rationale)
   - `chore:`/`docs:`/`style:` → category `conventions` or skip if trivial
   - No prefix → infer from diff content and conversation context

2. **Enrich** with conversation context:
   - Add the WHY (from discussion), not just the WHAT (from diff)
   - Include file paths, function names, patterns discovered
   - Note any failed approaches or alternatives that were considered
   - Reference specific architectural decisions made during discussion

### For non-committed work:

3. **Capture work not in any commit** from the conversation:
   - Decisions discussed but not reflected in code
   - Conventions established verbally (coding patterns, naming rules)
   - Bugs discovered but not yet fixed → `todo`
   - If WIP evidence exists in the digest, note what's in progress → `todo`

## Step 3: Self-Validation Checklist
Before calling save, mentally verify:
- Every commit SHA from the digest has at least 1 corresponding entry
- Every decision discussed in conversation is captured
- Every new convention/pattern is recorded
- Pending/unfinished work is in `todo`
- The summary covers ALL work done, not just the most recent task

## Step 4: Save
Call `contox_save_session` with:
- `summary`: 1-3 sentences covering ALL work in this session
- `changes`: ALL enriched entries from Step 2
- `headCommitSha`: the `headSha` from the git digest (omit if no git digest)

If $ARGUMENTS is not empty, use "$ARGUMENTS" as additional context for the summary.

Be specific — include file paths, function names, and concrete details that will be useful in future sessions.

## Step 5: Verify
Confirm the save succeeded. Report to the user: entries created, categories affected, commits processed.

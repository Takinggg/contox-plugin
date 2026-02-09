---
description: Configure Contox credentials for this project
---

Help the user set up Contox for their project. Follow these steps:

## Step 1: Check existing configuration

First, check if the required environment variables are already set by trying to call `contox_list_contexts`. If it works, tell the user "Contox is already configured!" and show the number of contexts found.

If it fails (missing API key error), continue with setup:

## Step 2: Guide the user

Tell the user:

**You need 3 things to connect Contox:**

1. **API Key** — Get it at https://contox.dev/dashboard/keys
2. **Team ID** — Found in your dashboard URL or settings
3. **Project ID** — Found in your project settings

Then ask the user to provide these values. Use the AskUserQuestion tool to collect:
- Their API key (starts with `ctx_`)
- Their Team ID
- Their Project ID

## Step 3: Create configuration

Once you have all 3 values, create a `.contox.json` file in the project root:

```json
{
  "teamId": "<their_team_id>",
  "projectId": "<their_project_id>"
}
```

Then tell the user to set their API key as an environment variable. Provide commands for their OS:

**Linux/macOS (add to ~/.bashrc or ~/.zshrc):**
```bash
export CONTOX_API_KEY="ctx_their_key_here"
```

**Windows (PowerShell):**
```powershell
[Environment]::SetEnvironmentVariable("CONTOX_API_KEY", "ctx_their_key_here", "User")
```

Also tell them they can set all vars at once:
```bash
export CONTOX_API_KEY="ctx_..."
export CONTOX_TEAM_ID="their_team_id"
export CONTOX_PROJECT_ID="their_project_id"
```

## Step 4: Verify

After setup, try calling `contox_list_contexts` again to verify the connection works. If successful, tell the user they're all set and suggest running `/contox:memory` to load their project context.

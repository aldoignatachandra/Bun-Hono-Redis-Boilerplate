# MCP Environment Variables Setup Guide

This guide explains how to securely configure MCP servers in Trae IDE without exposing API keys in your public repository.

## 🔒 Security Architecture

**Three-Layer Security Model:**

| Layer | File                | Purpose                                        | Git Status                                 |
| ----- | ------------------- | ---------------------------------------------- | ------------------------------------------ |
| 1️⃣    | `.env`              | Your actual API keys                           | ❌ **Ignored** (personal, never committed) |
| 2️⃣    | `.mcp.json`         | Your local Trae MCP config with personal paths | ❌ **Ignored** (IDE-specific)              |
| 3️⃣    | `.mcp.json.example` | Template for other developers                  | ✅ **Committed** (safe to share)           |

**Why This Approach?**

- Trae IDE's `.mcp.json` cannot automatically read from `.env` files
- `.mcp.json` contains personal file paths and local development preferences
- Each developer needs their own configuration (not shared in repo)

## 📝 Step-by-Step Setup

### Step 1: Get Your API Keys

#### GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Configure the token:
   - **Note**: `Trae MCP - bun-hono-kafkajs-boilerplate`
   - **Expiration**: Choose your preference (90 days recommended)
   - **Scopes** (check these boxes):
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
     - ✅ `issues` (Read and write issues)
     - ✅ `pull_requests` (Read and write pull requests)
4. Click **"Generate token"**
5. **Copy the token immediately** (you won't see it again!)

#### Brave Search API Key

1. Go to: https://brave.com/search/api/
2. Sign up for a free account
3. Generate an API key
4. Copy the API key

### Step 2: Create Your Local `.mcp.json`

Since `.mcp.json` is gitignored (IDE-specific configuration), create your own local copy:

```bash
# Copy the example template to create your local config
cp .mcp.json.example .mcp.json
```

Then edit [`.mcp.json`](../.mcp.json) and update:

1. **File paths** (replace `/path/to/your/project` with your actual project path):

   ```json
   "filesystem": {
     "command": "npx",
     "args": ["@modelcontextprotocol/server-filesystem", "/Users/ignata/Desktop/Self Project/Project-Javascript/bun-hono-kafkajs-boilerplate"]
   }
   ```

2. **PostgreSQL launcher path**:

   ```json
   "postgres": {
     "command": "/Users/ignata/.config/claude-code/postgres-mcp-launcher.sh",
     "args": []
   }
   ```

3. **API keys** (from your `.env` file):
   ```json
   "github": {
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-github"],
     "env": {
       "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_ACTUAL_GITHUB_TOKEN_HERE"
     }
   },
   "brave-search": {
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-brave-search"],
     "env": {
       "BRAVE_API_KEY": "YOUR_ACTUAL_BRAVE_API_KEY_HERE"
     }
   }
   ```

### Step 3: Update Trae's Global MCP Configuration

Since Trae's security restrictions prevent automated edits, follow these steps:

1. Open Trae's global MCP configuration:
   - **macOS**: `/Users/ignata/Library/Application Support/Trae/User/mcp.json`
   - The file should already be open in Finder from the previous step

2. Update the `env` sections for GitHub and Brave Search with your actual API keys:

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_ACTUAL_GITHUB_TOKEN_HERE"
  }
},
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "YOUR_ACTUAL_BRAVE_API_KEY_HERE"
  }
}
```

3. Save the file

4. **Restart Trae IDE** to load the new configuration

### Step 4: Verify MCP Servers Are Working

After restarting Trae IDE:

1. Open a new chat in Trae
2. Ask: "List all available MCP tools"
3. You should see tools from:
   - **GitHub MCP** (e.g., `github_create_pull_request`, `github_create_issue`)
   - **Brave Search MCP** (e.g., `brave_web_search`)
   - **Command Execution MCP** (e.g., `command_execution_run`)

## 🔐 Security Best Practices

### What's Already Secured ✅

- [`.gitignore`](../.gitignore) includes `.env`, so your API keys won't be committed to Git
- [`.env.example`](../.env.example) has empty placeholders, no real secrets
- Trae's global `mcp.json` is stored in your local user directory (not in the project)

### Additional Recommendations 🛡️

1. **Never commit `.env`** - Already handled by `.gitignore`
2. **Use short-lived tokens** - Set GitHub token expiration to 90 days
3. **Rotate keys regularly** - Update tokens every few months
4. **Use separate tokens per project** - Don't reuse the same GitHub token across multiple projects
5. **Monitor usage** - Check GitHub token usage periodically at: https://github.com/settings/tokens

## 🚀 Team Collaboration

If you're working with a team:

### For Each Developer:

1. Clone the repository
2. Copy [`.env.example`](../.env.example) to `.env`
3. Add their own API keys to `.env`
4. Copy [`.mcp.json.example`](../.mcp.json.example) to `.mcp.json`
5. Update file paths and API keys in `.mcp.json`
6. Follow Steps 1-4 above to configure Trae MCP
7. Each developer has their own Trae MCP configuration (not shared)

**Important Files:**

- `.env` - Local only (gitignored)
- `.mcp.json` - Local only (gitignored)
- `.env.example` - Committed (safe to share)
- `.mcp.json.example` - Committed (safe to share)

### For CI/CD:

- Do NOT add MCP API keys to CI/CD environment variables
- MCP servers are for local development only (IDE integration)
- Use GitHub Actions with GitHub App or GitHub PAT with appropriate scopes for automation

## 🔍 Troubleshooting

### Issue: MCP servers not showing up

**Solution**: Restart Trae IDE after updating `mcp.json`

### Issue: GitHub MCP returns 401 errors

**Solution**: Verify your GitHub token has the required scopes (`repo`, `workflow`, `issues`, `pull_requests`)

### Issue: Brave Search returns quota exceeded

**Solution**: The free tier has limits. Consider upgrading to a paid plan for heavy usage

### Issue: `.mcp.json` in project not being used

**Solution**: Trae uses global `mcp.json` by default. Project-level `.mcp.json` requires Trae to support project-specific MCP servers (check Trae documentation for updates)

## 📚 Additional Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [GitHub Personal Access Tokens Guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Brave Search API Documentation](https://brave.com/search/api/documentation/)
- [GITIGNORE_SECURITY_SUMMARY.md](./GITIGNORE_SECURITY_SUMMARY.md) - Complete security guide

---

**Remember**: Your `.env` file is local and gitignored. Only you have access to your API keys. Never commit secrets to version control!

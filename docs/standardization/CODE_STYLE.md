# Code Style Guide

This project uses Prettier to maintain consistent code formatting across all files. The configuration is defined in `.prettierrc` at the root of the project.

## Formatting Rules

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required at the end of statements
- **Trailing Commas**: ES5 compatible (trailing commas in multi-line structures)
- **Line Width**: Maximum 100 characters
- **Arrow Function Parentheses**: Omit when possible (arrowParens: "avoid")
- **End of Line**: LF (Unix style)

## Setup

1. Install the dependencies:

   ```bash
   bun install
   ```

2. Install the Prettier extension for your editor:
   - VSCode: [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

3. Configure your editor to use the project's Prettier configuration:
   - VSCode users can use the provided `.vscode/settings.json` which automatically configures the editor.

4. Setup git hooks to automatically check formatting before commits:
   ```bash
   bun run setup:hooks
   ```

## Usage

### Format all files

```bash
bun run format
```

### Check formatting without changing files

```bash
bun run format:check
```

### Editor Integration

The project includes editor configuration files:

- `.editorconfig`: Ensures consistent basic editor settings (indentation, line endings, etc.)
- `.vscode/settings.json`: VSCode-specific settings for Prettier and other tools
- `.vscode/extensions.json`: Recommended extensions for VSCode

## Pre-commit Hooks

This project includes a simple pre-commit hook that checks code formatting before allowing commits. To set it up:

```bash
bun run setup:hooks
```

This will create a symbolic link from `.git/hooks/pre-commit` to our custom script that runs `bun run format:check`. If formatting issues are found, the commit will be blocked with instructions to fix them.

If you prefer to use Husky for more advanced git hooks, you can install it separately:

```bash
# Install Husky and lint-staged
bun add -D husky lint-staged

# Add to package.json
{
  "lint-staged": {
    "*.{ts,js,json,md}": "prettier --write"
  }
}
```

## File Exclusions

Some files are excluded from formatting as defined in `.prettierignore`:

- Dependencies (`node_modules/`)
- Build outputs (`dist/`, `build/`)
- Generated files (`*.generated.ts`, `*.generated.js`)
- Environment files (`.env*`)
- Logs (`*.log`)
- Database files (`*.db`, `*.sqlite`)
- IDE files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Package manager lock files (`package-lock.json`, `yarn.lock`)
- Coverage reports (`coverage/`, `.nyc_output/`)
- Temporary files (`tmp/`, `temp/`)
- Minified files (`*.min.js`, `*.min.css`)
- Drizzle migrations (`packages/drizzle/migrations/`)

## Why Consistent Formatting Matters

1. **Reduced Cognitive Load**: Developers don't need to think about formatting, allowing them to focus on code logic.
2. **Cleaner Diffs**: Changes in code reviews are easier to read when only functional changes are highlighted.
3. **Automated Enforcement**: With pre-commit hooks, formatting is automatically enforced.
4. **Team Consistency**: All developers follow the same style, regardless of personal preferences.
5. **Easier Onboarding**: New developers can quickly adapt to the project's style.

## Troubleshooting

### Prettier not formatting files

1. Ensure your editor is configured to use the project's Prettier configuration.
2. Check that the file extension is included in the format script (`**/*.{ts,js,json,md}`).
3. Verify the file is not listed in `.prettierignore`.

### Conflicts with other tools

If you're using ESLint or other linting tools that have formatting rules, consider:

1. Using `eslint-config-prettier` to disable conflicting rules.
2. Running Prettier after ESLint in your linting pipeline.

### Editor-specific issues

For VSCode users:

1. Install the recommended extensions from `.vscode/extensions.json`.
2. Ensure the workspace settings are being applied (check for workspace-specific overrides).
3. Reload the window if formatting isn't working after configuration changes.

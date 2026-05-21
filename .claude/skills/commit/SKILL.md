---
description: Stage and commit changes with a conventional commit message
---

## Steps

### 1. Inspect current state

Run these in parallel:

```bash
git status
git diff
git log --oneline -5
```

### 2. Determine what changed

Analyze the diff and categorize:

| Prefix | When to use |
|--------|-------------|
| `feat` | New feature or endpoint |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `chore` | Dependencies, config, tooling |
| `docs` | README, CLAUDE.md, comments only |
| `test` | Adding or fixing tests |
| `migration` | New TypeORM migration |

### 3. Stage files

Stage specific files — never `git add -A` or `git add .` blindly.
Never stage: `.env`, any file with secrets or credentials.

```bash
git add <specific files>
```

### 4. Commit

Use conventional commit format: `<prefix>: <short description in English>`

- Subject line: max 72 chars, imperative mood ("add", not "added")
- No period at the end

```bash
git commit -m "$(cat <<'EOF'
<prefix>: <short description>

<optional body — only if the why is non-obvious>

Co-Authored-By: Claude <MODEL_NAME> <noreply@anthropic.com>
EOF
)"
```

> **`<MODEL_NAME>`** — каждая модель подставляет своё актуальное имя и версию.
> Примеры: `Claude Sonnet 4.6`, `Claude Opus 4.7`, `Claude Haiku 4.5`.
> Никогда не оставлять плейсхолдер как есть — всегда подставлять имя модели, создающей коммит.

### 5. Verify

```bash
git log --oneline -3
```

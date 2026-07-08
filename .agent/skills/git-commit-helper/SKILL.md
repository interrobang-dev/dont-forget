---
name: git-commit-helper
description: Review local code changes (staged and unstaged), suggest a single-line English commit message following Conventional Commits format, iterate based on user feedback, and execute git commit upon explicit user approval. Trigger this skill whenever the user mentions "commit", "git commit", "커밋", "커밋해줘", "변경 사항 커밋", or "커밋 메시지 제안".
---

# Git Commit Helper Skill

This skill guides the agent through a structured, interactive workflow to review local file changes, propose a high-quality commit message, refine it based on user feedback, and safely perform the commit.

---

## Safety Guardrails
- **NO AUTOMATIC COMMIT**: Under no circumstances should the agent execute a `git commit` command automatically or implicitly.
- **EXPLICIT USER CONFIRMATION REQUIRED**: The commit command must only be executed after the user has explicitly typed a final approval keyword (e.g., "승인", "commit", "진행해줘") in response to a specific commit message draft.
- **MESSAGE-ONLY BY DEFAULT**: If the user only asks to "generate a commit message" or "review changes", the agent must only display the message and STOP. Do not assume approval to perform the commit.

## Workflow Steps

### Step 1: Detect Code Changes
1. Run `git status` and `git diff` (or `git diff --staged` if changes are already staged) to understand which files have been modified and analyze the exact code diffs.
2. Formulate a precise mental model of what architectural and functional changes were made.

### Step 2: Propose Commit Message Draft
1. Propose **exactly one single-line English commit message** following the Conventional Commits specification.
2. **CRITICAL CONSTRAINT**: Do NOT output Korean translations, bulleted lists, detailed descriptions, or multi-line messages UNLESS the user explicitly requests them. The initial proposal must be a clean, single-line string in English.
3. Use the correct type prefix:
   - `feat`: A new feature or functional addition.
   - `fix`: A bug fix.
   - `docs`: Documentation-only changes.
   - `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
   - `refactor`: A code change that neither fixes a bug nor adds a feature.
   - `perf`: A code change that improves performance.
   - `test`: Adding missing tests or correcting existing tests.
   - `chore`: Changes to the build process or auxiliary tools and libraries.

### Step 3: Iterate based on User Feedback
1. Present the single-line English proposal to the user.
2. Ask the user for approval or feedback.
3. If the user provides feedback (e.g., "emphasize mobile CSS changes", "change verb to improve"), adjust the message accordingly and present the updated single-line English draft.
4. Continue this feedback loop until the user gives explicit approval (e.g., "승인", "commit", "진행해줘").

### Step 4: Perform the Commit
1. Once the user explicitly approves the message, announce the execution.
2. Run `git add` for the relevant files (if not already staged) and execute `git commit -m "<approved-message>"`.
3. Inform the user of the successful commit.
4. **CRITICAL WARNING**: NEVER automatically commit or push code without the user's explicit final approval in the chat.

---

## Reference Examples

### Example 1 (Simple Bug Fix):
* **Input (Diff)**: Typo correction in variable name that caused a crash.
* **Output Proposal**: `fix: correct typo in auth middleware variable name`

### Example 2 (Feature Addition):
* **Input (Diff)**: Adding a new theme toggle button and hook.
* **Output Proposal**: `feat: add theme toggle button and dark mode support`

### Example 3 (Style and Refactoring):
* **Input (Diff)**: Adjusting CSS padding margins without changing logic.
* **Output Proposal**: `style: refine mobile layout paddings and spacing`

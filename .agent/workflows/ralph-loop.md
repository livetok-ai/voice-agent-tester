---
description: Ralph Loop - Iterative AI development with persistent iteration until task completion
---

# Ralph Loop Workflow

This workflow implements the Ralph Loop (Ralph Wiggum) technique for iterative, autonomous coding.

## Usage

Invoke with: `/ralph-loop <task description>`

Or provide detailed options:
```
/ralph-loop "Build feature X" --max-iterations 30 --completion-promise "COMPLETE"
```

## Workflow Steps

1. **Read the Ralph Loop skill instructions**
   - View the skill file at `.gemini/skills/ralph-loop/SKILL.md`
   - Understand the iteration pattern and best practices

2. **Parse the user's task**
   - Identify the main objective
   - Extract success criteria
   - Set max iterations (default: 30)
   - Set completion promise (default: "COMPLETE")

3. **Enter the loop**
   - Execute the task iteratively
   - Self-correct on failures
   - Track progress
   - Continue until success criteria met or max iterations reached

4. **Report completion**
   - Summarize accomplishments
   - Output the completion promise
   - List any remaining issues

## Quick Commands

- **Start a loop**: `/ralph-loop "Your task here"`
- **Cancel loop**: Say "stop", "cancel", or "abort"
- **Check skill docs**: View `.gemini/skills/ralph-loop/SKILL.md`

## Examples

### Feature Implementation
```
/ralph-loop "Implement user authentication with JWT tokens. Requirements: login/logout endpoints, password hashing, token refresh. Tests must pass."
```

### Bug Fix
```
/ralph-loop "Fix the 404 error when importing VAPI assistants. Add retry logic with exponential backoff."
```

### Refactoring
```
/ralph-loop "Refactor the CLI options to be more provider-agnostic. All existing tests must pass."
```

---
name: ralph-loop
description: Ralph Loop - AI Loop Technique for iterative, autonomous coding. Implements persistent iteration until task completion with self-correction patterns.
---

# Ralph Loop - AI Loop Technique

The Ralph Loop (also known as "Ralph Wiggum") is an iterative AI development methodology. It embodies the philosophy of **persistent iteration despite setbacks**.

## Core Philosophy

1. **Iteration > Perfection**: Don't aim for perfect on first try. Let the loop refine the work.
2. **Failures Are Data**: Deterministically bad means failures are predictable and informative.
3. **Operator Skill Matters**: Success depends on writing good prompts, not just having a good model.
4. **Persistence Wins**: Keep trying until success. Handle retry logic automatically.

---

## How to Use This Skill

When the user invokes this skill (e.g., `/ralph-loop` or asks for iterative development), follow these instructions:

### Step 1: Understand the Task

Parse the user's request and identify:
- **The main objective** - What needs to be built/fixed/refactored
- **Success criteria** - How to know when it's complete
- **Max iterations** - Safety limit (default: 30)
- **Completion promise** - The signal word (default: "COMPLETE")

### Step 2: Enter the Ralph Loop

Execute the following loop pattern:

```
ITERATION = 1
MAX_ITERATIONS = [specified or 30]
COMPLETION_PROMISE = [specified or "COMPLETE"]

WHILE (ITERATION <= MAX_ITERATIONS) AND (NOT COMPLETED):
    1. Assess current state
    2. Identify next step toward goal
    3. Execute the step (write code, run tests, fix bugs, etc.)
    4. Evaluate results
    5. If success criteria met → output COMPLETION_PROMISE → EXIT LOOP
    6. If not complete → increment ITERATION → CONTINUE
    7. If blocked → document issue → try alternative approach
END WHILE

IF MAX_ITERATIONS reached without completion:
    - Document what was accomplished
    - List blocking issues
    - Suggest next steps
```

### Step 3: Self-Correction Pattern

During each iteration, follow this TDD-inspired pattern:

1. **Plan** - Identify what needs to happen next
2. **Execute** - Make the change (code, config, etc.)
3. **Verify** - Run tests, check results, validate
4. **If failing** - Debug and fix in the same iteration if possible
5. **If passing** - Move to next requirement
6. **Refactor** - Clean up if needed before proceeding

### Step 4: Report Progress

After each significant iteration, briefly report:
- Current iteration number
- What was attempted
- Result (success/failure/partial)
- Next step

### Step 5: Completion

When all success criteria are met:
1. Summarize what was accomplished
2. List any tests/validations that passed
3. Output the completion promise: `<promise>COMPLETE</promise>`

---

## Prompt Templates

### Feature Implementation

```
Implement [FEATURE_NAME].

Requirements:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

Success criteria:
- All requirements implemented
- Tests passing with >80% coverage
- No linter errors
- Documentation updated

Output <promise>COMPLETE</promise> when done.
```

### TDD Development

```
Implement [FEATURE] using TDD.

Process:
1. Write failing test for next requirement
2. Implement minimal code to pass
3. Run tests
4. If failing, fix and retry
5. Refactor if needed
6. Repeat for all requirements

Requirements: [LIST]

Output <promise>DONE</promise> when all tests green.
```

### Bug Fixing

```
Fix bug: [DESCRIPTION]

Steps:
1. Reproduce the bug
2. Identify root cause
3. Implement fix
4. Write regression test
5. Verify fix works
6. Check no new issues introduced

After 15 iterations if not fixed:
- Document blocking issues
- List attempted approaches
- Suggest alternatives

Output <promise>FIXED</promise> when resolved.
```

### Refactoring

```
Refactor [COMPONENT] for [GOAL].

Constraints:
- All existing tests must pass
- No behavior changes
- Incremental commits

Checklist:
- [ ] Tests passing before start
- [ ] Apply refactoring step
- [ ] Tests still passing
- [ ] Repeat until done

Output <promise>REFACTORED</promise> when complete.
```

---

## Advanced Patterns

### Multi-Phase Development

For complex projects, chain multiple loops:

```
Phase 1: Core implementation → <promise>PHASE1_DONE</promise>
Phase 2: API layer → <promise>PHASE2_DONE</promise>
Phase 3: Frontend → <promise>PHASE3_DONE</promise>
```

### Incremental Goals

Break large tasks into phases:

```
Phase 1: User authentication (JWT, tests)
Phase 2: Product catalog (list/search, tests)
Phase 3: Shopping cart (add/remove, tests)

Output <promise>COMPLETE</promise> when all phases done.
```

---

## Best Practices for Writing Prompts

### ❌ Bad Prompt
```
Build a todo API and make it good.
```

### ✅ Good Prompt
```
Build a REST API for todos.

When complete:
- All CRUD endpoints working
- Input validation in place
- Tests passing (coverage > 80%)
- README with API docs

Output: <promise>COMPLETE</promise>
```

---

## When to Use Ralph Loop

### ✅ Good For:
- Feature implementation with clear requirements
- Bug fixing with reproducible issues
- Refactoring with existing test coverage
- TDD-style development
- Tasks that benefit from iteration

### ❌ Not Good For:
- Exploratory research without clear goals
- Tasks requiring human judgment at each step
- Real-time interactive sessions
- Tasks with no verifiable success criteria

---

## Cancellation

The user can cancel the loop at any time by:
- Saying "stop", "cancel", or "abort"
- Providing new instructions that supersede the current task

---

## Attribution

Based on the Ralph Wiggum technique from [Awesome Claude](https://awesomeclaude.ai/ralph-wiggum) and the official Claude plugins marketplace (`ralph-loop@claude-plugins-official`).

Agent Rules – TypeScript Project

1. Explicit Action vs. Query / Planning
   - The user will clearly separate:
     - Repository queries: reading, searching, explaining existing code.
     - Planning: proposing changes, architecture, risk analysis, or design alternatives.
     - Explicit actions: actual code edits (writing, modifying, deleting).
   - Never edit code unless explicitly told to do so (for example, "apply this", "do it", "implement"). Until then, all proposals are drafts.

2. No Type Second‑Guessing
   - Never assume or infer a type from context alone.
   - Always read the actual source files (interfaces, definitions, return types) to know the exact shape before writing any code.

3. No Explicit Casting
   - Never use `as` or `<Type>` casts.
   - If types do not align, refactor the logic or adjust the type definitions properly instead of forcing a cast.

4. Equality Comparison Discipline
   - Always use double equals (`==`) for equality comparisons.
   - Do not use triple equals (`===`).
   - Reason: In TypeScript, comparing values of different types results in a compile‑time error, so the additional safety of `===` is unnecessary and only adds noise. Use `==` consistently.

5. Function Creation Discipline (DRY)
   - Inline logic unless the exact same code block appears more than once (2 or more repetitions).
   - No premature DRY – single‑use logic stays inline, even if verbose. Only extract when reuse is proven.

6. No Compilation‑Based Validation
   - Never run `tsc`, `npm run type-check`, or any other compilation/type‑checking command to validate changes – these are time‑consuming and unnecessary.
   - Determine type correctness by reading the relevant source files and reasoning locally (static analysis).
   - If you are unsure about a type, read the file again or ask the user – never run a build.

7. Dynamic Scope Decision – Lazy vs. Careful Mode
   Before any action, assess the scope:

   - Lazy Mode (use when the task touches only one file or a very localised function):
     - No repo‑wide searches – only read that specific file/function.
     - No architecture plans – state the exact line(s) to change.
     - No risk essays – give the simplest, most direct edit.
     - Minimal verbosity – provide short explanations (for example, "Change line 42 from X to Y").
     - Still: do not edit until the user says "do it", but do not overthink.

   - Careful Mode (use when the task spans multiple files, touches shared logic, or scope is unclear):
     - List all files or modules affected.
     - Identify risks (breaking changes, type mismatches, side effects).
     - Pause and ask for the user's confirmation before proposing a concrete plan or writing any code.

8. Fallback – Always Apply
   - When in doubt, default to Careful Mode and ask for clarification.
   - Never hide uncertainty – if you do not know something (for example, an external type, a library detail, a project‑specific pattern), state it clearly and ask.
   - Always explain your reasoning when proposing changes, especially when choosing between trade‑offs (performance, readability, maintainability).
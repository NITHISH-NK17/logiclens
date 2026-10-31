> [!IMPORTANT]
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on 's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to  and show up in
> the editor, so keep the branch in a working state.

- Circuit simulation, fault, ATPG and VCD logic lives in `src/lib/engine.ts` as pure TS, independent of React — keeps it testable and reusable by every tool page.
- Project data persists client-side via a zustand `persist` store (`src/lib/store.ts`, skipHydration); page content renders only after rehydration in AppShell to avoid SSR hydration mismatches.
- tsconfig has `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` disabled — the engine is index-heavy and these produced noise without catching real bugs.

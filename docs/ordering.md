# Ordering and concurrent moves

Flowboard stores card order as dense integers: every column holds positions `0..n-1` with no gaps, enforced by a `UNIQUE (columnId, position)` constraint. Columns use the same scheme on `(boardId, position)`. This note explains what happens when two people drag cards at the same moment, and why I chose this scheme over fractional keys.

## The race

A move is a read followed by writes. It loads the column, splices the card into a new index, then rewrites positions. Postgres runs at `READ COMMITTED` by default. If two moves in the same column start together, both read the same order. The second one blocks on row locks until the first commits, then applies its writes against a snapshot that is now stale. The outcome is one of these:

- The unique constraint fires and the request fails with a 500.
- A card that the first move brought in is missing from the second move's list. The temporary offset gets applied to it and never reset, so it ends up at position 100000-something.

Either way the column stops being contiguous. `src/tasks/task-concurrency.spec.ts` reproduces this. With the locks removed, the same-column test fails consistently.

## The fix: lock the parent row, in a fixed order

Each write that shifts positions begins its transaction by locking the parent rows:

```sql
SELECT id FROM "Column" WHERE id = $1 FOR UPDATE;  -- task create, delete, move
SELECT id FROM "Board"  WHERE id = $1 FOR UPDATE;  -- column create, delete, move
```

- **Serialization.** A second writer on the same column waits at the lock. It does not wait halfway through its updates. Under `READ COMMITTED`, every statement takes a fresh snapshot, so its reads after the lock see the committed result of the first move.
- **No deadlocks.** A cross-column move locks two columns, always sorted by id. If A→B and B→A happen at the same time, both try to take the same lock first, so neither ends up waiting on the other.
- **Re-read under the lock.** The task's column is read again after the lock is held. If someone else moved the card in the meantime, the API returns `409 Conflict`. The board then refetches and tells the user a teammate moved the card first. It does not silently put the card back where it was.
- **Scope.** The lock covers one column, or one board for column reordering. Moves on other columns and boards don't wait on each other.

I considered `SERIALIZABLE` isolation as well. It is also correct, but conflicts surface as serialization failures that the client has to retry, and the app would need a retry loop around every move. A row lock does the waiting inside Postgres, so the code stays a plain transaction.

## Dense integers vs fractional indexing / LexoRank

| | Dense integers (this repo) | Fractional index / LexoRank |
| --- | --- | --- |
| **Write cost per move** | O(n) rows in the affected column(s) | 1 row: a key between the neighbours |
| **Contention** | Writers to the same column serialize on one lock | Two inserts into the same gap can pick the same key. They need a tiebreaker or unique-retry |
| **Order invariant** | Always `0..n-1`. The DB constraint makes it checkable | Keys grow and drift. LexoRank needs periodic rebalancing, which is itself a bulk rewrite |
| **API** | `destinationIndex` maps directly to a position | Client or server converts index → neighbour keys |
| **Debuggability** | `position` reads as a list index | Opaque strings like `0|hzzzzz:` |

**Why dense integers here.** Columns in a Kanban board hold tens of cards, not tens of thousands. Rewriting 30 rows inside one transaction costs less than a network round-trip. In exchange I get an invariant I can assert in a test (`positions == [0..n-1]`) and a unique constraint the database enforces for me. A board is also a small team working in one place, so contention is bursty and local. One short lock per column fits that.

**When I would switch.** I would switch if a single list grew large (thousands of items) or if moves arrived at high rates from many writers, for example a public backlog or a realtime collaborative list. Then the O(n) rewrite and the per-column lock would become the bottleneck. Fractional keys make each move one row, at the cost of rebalancing and a weaker invariant.

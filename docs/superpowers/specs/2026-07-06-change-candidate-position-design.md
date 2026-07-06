# Change Candidate Position

**Date:** 2026-07-06
**Status:** Approved

## Problem

A candidate who applies to position X sometimes needs to be moved to position Y. Today the only way is the Position dropdown buried in the Edit Candidate dialog, and using it leaves stale data: `jobAppliedTo` keeps the old position text and no audit trail is written.

## Design

### Quick action on the pipeline card

In `candidate-pipeline.tsx`, add a swap icon to the hover actions on each candidate card (next to delete and next-stage). Clicking it opens a small dropdown listing all other positions; picking one calls `updateCandidate(id, { positionId })` and refreshes. Since the recruitment page groups pipelines by `positionId`, the card moves to the new position's pipeline.

### Backend fix inside updateCandidate

In `candidates.ts`, when `updateCandidate` receives a `positionId` different from the current one:

1. Also set `jobAppliedTo` to the new position's title, keeping text-based filters and displays consistent.
2. Write an audit entry `candidate.position.changed` with from/to titles, matching the existing status-change audit pattern.

The Edit Candidate dialog routes through the same action, so it is fixed for free.

### Explicitly out of scope

- `CandidateApplication` rows are NOT touched. They are history of what the candidate actually applied to and keep pointing at the original position.
- No schema changes.

## Files

- `src/lib/actions/candidates.ts` (updateCandidate)
- `src/components/cv/candidate-pipeline.tsx` (card quick action)

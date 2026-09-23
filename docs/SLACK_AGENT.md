# Avi, CALATRAVA's Slack teammate

The dedicated Avi app helps Coastal Debt's HR team understand CALATRAVA, discuss
improvements, and prepare code changes. Its service source is in the private
`barcoastal/avi-hr-agent` repository. This replaces the earlier native Codex Slack
pilot, which stalled during cloud startup.

## Conversation

Mention the dedicated `Avi` app in private `#hris-project`, then continue in that
thread. Follow-ups do not need another mention. Members of that HR channel can
also DM Avi. He uses conversation history received by the dedicated app; history
from the earlier native integration is not automatically transferred.

For example:

> @Avi Can we talk through making onboarding easier?

> The biggest issue is knowing which new hires still have tasks left.

> What would you suggest?

> Build that version and prepare it for review.

Avi answers ordinary conversation directly. Product claims should be verified
against the current repository and include compact source links. Discussion does
not start a build. A specific change can be prepared as a proposal with a **Build
this change** button; its requester starts that proposal. The resulting draft PR
is for human review. Nothing is merged or deployed automatically by Avi.

## Build workflow

`.github/workflows/avi-build.yml` receives a bounded, synthetic technical
specification from Avi's service through `workflow_dispatch`. Raw Slack history,
employee details, attachments, and production credentials are not build inputs.

The coding job checks out `main`, installs locked dependencies, and runs the
official Codex GitHub Action with workspace permissions. It runs unit tests,
type checking, an application build, and a diff check. Actual CI outcomes are
reported, including failures and environment limitations.

A separate publishing job receives only the patch and report. It does not execute
the proposed product code. It rejects changes to workflows, agent instructions,
dependency manifests, data exports, symlinks, and new executable files. Accepted
changes are pushed to a unique `avi/<proposal-id>` branch and opened as a draft PR.
Only the publishing job receives a GitHub token with write permissions.

The runtime polls the real workflow result and updates the originating Slack
thread. A failed or missing runner must be reported as a failure, not as a
completed product change. Schema proposals do not authorize database migrations.
Follow AGENTS.md for development and validation constraints.

## Activation checklist

- Dedicated Slack app installed and added to `#hris-project`.
- Railway service deployed from `barcoastal/avi-hr-agent`, with one replica and a
  persistent volume for conversation and build state.
- Dedicated Coastal Debt OpenAI API credentials configured in Railway and as the
  HR repository Actions secret `AVI_OPENAI_API_KEY`.
- Runtime GitHub token limited to HR: Contents read, Actions read/write, Pull
  requests read. The runtime does not need product-code write permission.
- GitHub repository setting allows Actions to create pull requests.
- Build workflow installed on `main`, then `BUILD_ENABLED=true` in Avi's service.
- Verify a real support conversation and one small build through a draft PR.

These files describe the implementation; their presence does not establish that
credentials, deployment, Slack delivery or build completion are working. Confirm
live results before telling the team Avi is ready.

## Product references

- Product: https://hr.coastaldebt-tools.com
- Repository: `barcoastal/HR`
- Product guide: `src/app/(dashboard)/guide/page.tsx`
- Product instructions: `AGENTS.md`
- Synthetic development guidance: `docs/SANDBOX.md`
- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)
- [Dedicated Slack bot reference](https://developers.openai.com/cookbook/examples/agents_api/apps/slack_bot/readme)

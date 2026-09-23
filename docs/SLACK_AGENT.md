# CALATRAVA agent in Slack

## What the team gets

Use `@Codex` in Coastal Debt's private `#hris-project` channel to ask about CALATRAVA, investigate product problems, propose improvements, and request code changes. Include `barcoastal/HR` in the request to select this repository explicitly.

This uses the native Codex Slack integration. No additional Railway bot service is needed for this pilot. GitHub and Slack must first be connected to Codex, and an HR cloud environment must be available to the requester. These files configure repository behavior; adding them does not by itself install or activate the Slack integration.

## Example requests

**Product support**

> @Codex in barcoastal/HR, explain how to customize onboarding checklists for a department. Check current code, give the exact steps and required role, and link to the relevant sources.

**Feedback into a proposal**

> @Codex in barcoastal/HR, review this feedback thread and propose the smallest useful improvement. Explain the problem, current behavior, proposed behavior, and acceptance criteria. Identify anything you could not verify.

**Investigate a bug**

> @Codex in barcoastal/HR, investigate why editing a person's email can stay on “Saving…”. Trace the UI and server action, explain the likely cause with evidence, and suggest a fix. Use synthetic examples.

**Build a change**

> @Codex in barcoastal/HR, build a fix so saving an employee profile always ends in either a success state or a useful error message. Preserve permission checks, add appropriate regression coverage, and return a reviewable change with test results.

**Improve the workflow**

> @Codex in barcoastal/HR, inspect the onboarding tracker and recommend three concrete usability improvements. Explain who benefits and how we could check whether each improvement helped.

These examples are templates. The reported save issue is a candidate investigation, not a verified diagnosis or an implemented fix.

## Setup

1. In [Codex connections](https://chatgpt.com/codex/settings/connectors), connect the GitHub account with access to `barcoastal/HR`. Select only the repository access needed for this project when that choice is available.
2. Create a Codex cloud environment for `barcoastal/HR`. Use the normal default branch after these instructions are merged, or a supported branch selection for testing this branch before merge. Confirm which branch the task actually uses.
3. Configure setup to run `npm ci`. Prisma client generation is already included in `postinstall`. Provide only synthetic development configuration. Code-reading and unit-test tasks do not need production HR data or Railway credentials.
4. Connect the native Codex Slack app to the **Coastal Debt** workspace. Review the actual OAuth scopes before approving; installation can require a workspace admin.
5. Add the app to **#hris-project** using Slack's app management. Keep the pilot in this channel and use explicit mentions. This is an operational choice, not a claim that the native app's OAuth permissions are restricted to one channel.
6. Confirm each intended requester's Codex, GitHub, environment, and Slack access according to the installed integration's requirements.
7. Run one support task and one small build task. Confirm replies appear in the intended thread, source links are accurate, and the build yields a reviewable artifact.

Connecting the Slack plugin in a Codex desktop conversation is a different connection from installing the native `@Codex` Slack app. Neither substitutes for the other's setup.

## Pilot task to run after connection

> @Codex in barcoastal/HR, read AGENTS.md and docs/SLACK_AGENT.md. Explain how HR can edit onboarding checklists, including role restrictions and the difference between changing a template and an existing employee's tasks. Cite the relevant code. This is a support question; return an explanation.

Then use a separate thread for an explicit, small build request. A person reviewing the change should see its acceptance criteria, actual test results, and any missing validation. Merge and production release follow the team's existing process.

## Implementation notes

- Source repository: `https://github.com/barcoastal/HR`.
- Product: `https://hr.coastaldebt-tools.com`.
- Railway project: `30c55835-89e8-4176-9c25-7d89a068e564`.
- Production HR service: `41a66383-5ea7-4f8c-95df-624395fe40ce`.
- Slack workspace/channel: Coastal Debt / `#hris-project`.
- Repository instructions: `AGENTS.md`.
- Product guide source: `src/app/(dashboard)/guide/page.tsx`.
- Sandbox reference: `docs/SANDBOX.md`. Verify the database and individual integrations before running interactive tests.

Source inspection, instructions, and code review do not prove the Slack integration is connected. Complete and observe the pilot tasks before describing the agent as live.

## Official reference

[Use Codex in Slack](https://learn.chatgpt.com/docs/third-party/slack) describes installation, repository selection, thread context, cloud task replies, and connection troubleshooting.

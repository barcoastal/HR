"""Validate an untrusted patch in a fresh job; publish a draft without executing its code."""

import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

from prepare import validate


def run(*args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, **kwargs).stdout


def allowed_path(path):
    p = PurePosixPath(path)
    if p.is_absolute() or ".." in p.parts or any(x.startswith(".") for x in p.parts):
        return False
    if p.parts[0] not in {"src", "tests", "test", "docs", "prisma"}:
        return False
    if path in {"docs/SLACK_AGENT.md", "docs/SANDBOX.md"} or "AGENTS.md" in p.parts:
        return False
    if re.search(r"credential|secret|private.key|(?:^|/)(?:uploads|exports|logs)(?:/|$)", path, re.I):
        return False
    if p.parts[0] == "prisma" and path != "prisma/schema.prisma":
        return False
    return p.suffix in {".ts", ".tsx", ".js", ".jsx", ".css", ".md", ".prisma"}


def checked_paths():
    files = run("git", "diff", "--cached", "--name-only", "-z").decode().split("\0")
    paths = [p for p in files if p]
    if len(paths) > 40 or any(not allowed_path(path) for path in paths):
        raise ValueError("Patch exceeds the product-source boundary; human review is required.")
    for record in run("git", "diff", "--cached", "--raw", "-z").decode().split("\0"):
        if record.startswith(":"):
            old_mode, new_mode = record[1:].split()[:2]
            if old_mode not in {"100644", "100755", "000000"} or new_mode not in {"100644", "000000"}:
                raise ValueError("Symlinks, submodules and new executable files are not allowed.")
    diff = run("git", "diff", "--cached", "--no-ext-diff").decode()
    if re.search(r"sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]+|-----BEGIN .*PRIVATE KEY", diff):
        raise ValueError("Possible credential detected; refusing publication.")
    return paths


def main():
    ident = os.environ["AVI_JOB_ID"]
    spec = validate(ident, os.environ["AVI_SPEC"])
    repo = os.environ["GITHUB_REPOSITORY"]
    branch = f"avi/{ident}"
    existing = json.loads(
        run("gh", "api", f"repos/{repo}/pulls?state=all&head={repo.split('/')[0]}:{branch}")
    )
    if existing:
        print("Draft already exists:", existing[0]["html_url"])
        return
    temp = Path(os.environ["RUNNER_TEMP"]) / "avi-result"
    patch = temp / "change.patch"
    if patch.stat().st_size > 1_000_000:
        raise ValueError("Patch is too large for an automatic draft.")
    if not patch.read_bytes().strip():
        print("No code change was produced. See the avi-result report artifact.")
        return
    run("git", "apply", "--check", "--index", str(patch))
    run("git", "apply", "--index", str(patch))
    paths = checked_paths()
    run("git", "diff", "--cached", "--check")
    report = json.loads((temp / "report.json").read_text())
    checks = report.get("checks", {})
    lines = [f"- {name}: {checks.get(name, 'not reported')}" for name in ("diff", "tests", "types", "build")]
    # The trusted job reports fixed CI outcomes, not model assertions about passing tests.
    body = "\n".join(
        [
            "## Proposed change",
            spec["request"],
            "",
            "## Acceptance criteria",
            *[f"- {item}" for item in spec["acceptance_criteria"]],
            "",
            "## Validation",
            *lines,
            "",
            f"[Build run](https://github.com/{repo}/actions/runs/{os.environ['GITHUB_RUN_ID']})",
            "The avi-result artifact contains the agent's detailed implementation notes.",
            "",
            "Prepared by Avi for human review. This pull request has not been merged or deployed.",
        ]
    )
    run("git", "config", "user.name", "Avi")
    run("git", "config", "user.email", "avi@users.noreply.github.com")
    run("git", "checkout", "-b", branch)
    run("git", "commit", "-m", f"Avi: {spec['summary']}")
    token = base64.b64encode(f"x-access-token:{os.environ['GH_TOKEN']}".encode()).decode()
    # The token exists only in this trusted publishing job, never the coding job.
    push_env = {
        **os.environ,
        "GIT_CONFIG_COUNT": "1",
        "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
        "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: basic {token}",
    }
    try:
        run("git", "push", "origin", f"HEAD:refs/heads/{branch}", env=push_env)
    except subprocess.CalledProcessError:
        # A previously successful push may precede a failed PR request. Never force-push.
        remote = run("git", "ls-remote", "origin", f"refs/heads/{branch}", env=push_env).decode()
        if not remote.strip():
            raise
        head_tree = run("git", "rev-parse", "HEAD^{tree}").decode().strip()
        run("git", "fetch", "origin", branch, env=push_env)
        if run("git", "rev-parse", "FETCH_HEAD^{tree}").decode().strip() != head_tree:
            raise ValueError("Existing branch contains a different change; refusing to overwrite it.")
    payload = {
        "title": f"Avi: {spec['summary']}",
        "body": body,
        "head": branch,
        "base": "main",
        "draft": True,
    }
    result = json.loads(
        run(
            "gh",
            "api",
            "--method",
            "POST",
            f"repos/{repo}/pulls",
            "--input",
            "-",
            input=json.dumps(payload).encode(),
        )
    )
    print(f"Prepared draft for {len(paths)} files:", result["html_url"])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Avoid dumping subprocess arguments, credentials, or untrusted patch contents.
        print(f"Avi publication stopped: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)

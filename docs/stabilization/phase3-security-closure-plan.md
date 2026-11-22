# Phase 3 - Security Closure Plan (WeatherPower Key Exposure)

Date: 2026-11-22  
Scope: **Plan only - no execution.** This document defines exact remaining steps to fully close the WeatherPower key exposure finding.

## Current State

| Area | Status | Evidence |
|---|---|---|
| Hardcoded key removed from working tree | Done | `app/api/sounding/route.ts` reads `WEATHERPOWER_API_KEY` from env; returns 503 DATA UNAVAILABLE when missing (Sprint 1) |
| `.env.example` present | Done | Added Sprint 1 |
| `.env.local` removed from tracking | Done | Sprint 1 |
| Secret scan workflow | Done | `.github/workflows/secret-scan.yml` |
| `.next/` artifacts removed from tracking | Done | Sprint 1 |
| Key rotated/revoked at provider | **Unknown / not confirmed** | Requires WeatherPower/provider admin action outside repo |
| Git history purged | **Not done** | Old commits may contain leaked key (e.g. historical sounding route commit) |
| Forks/clones invalidated | **Not done** | Requires collaborator communication after rewrite |

## Closure Plan (exact steps)

### 1) Rotate/Revoke (provider-side, immediate)

1. Identify the exposed WeatherPower API key in provider dashboard/admin.
2. **Revoke/delete** the exposed key. Do not reuse it.
3. Generate a new key with least privilege/scope required.
4. Store new key only in approved secret stores: local `.env.local` (untracked), deployment environment secrets (Vercel/host), CI secrets if needed. Never commit.
5. Verify old key returns unauthorized/invalid; verify new key works only where intended.
6. Record rotation date, actor, and ticket in internal security log (do not record key value).

### 2) Git History Rewrite (repo maintenance window)

> Requires coordination; force-push rewrites history for all collaborators.

1. Freeze merges to `main` during window; notify collaborators.
2. Create fresh mirror clone: `git clone --mirror <repo>`.
3. Use `git filter-repo` (preferred) or BFG to remove the leaked key string and any `.env.local`/secret blobs from all refs/tags:
   - `git filter-repo --replace-text replacements.txt` where `replacements.txt` maps secret -> `***REMOVED***` (handle file carefully, do not commit).
   - Alternatively remove files containing secret from history.
4. Verify removal: `git log --all -S '<known-secret-fragment>' --` returns nothing; run `gitleaks detect --source . --log-opts="--all"`.
5. Inspect refs/tags: ensure all branches/tags rewritten as intended.
6. Force push rewritten refs: `git push --force --all` and `git push --force --tags`.
7. If using GitHub, contact/support or use settings as needed for cached views; invalidate PR refs if necessary.

### 3) Force Push / Collaborator Actions

1. All collaborators must **not** merge old history back in. After rewrite:
   - preferred: fresh `git clone`
   - or: `git fetch origin --prune && git reset --hard origin/main` (discard local old history carefully)
2. Collaborators must delete local branches containing old commits or rebase onto rewritten main.
3. Any forks must be re-forked or history-rewritten by owners; forks can retain leaked history.
4. CI caches/build caches that may contain old checkout should be cleared.
5. Confirm protected branch rules re-applied after force push if needed.

### 4) Verification / Closeout

1. Run secret scan on full rewritten history.
2. Confirm GitHub secret scanning alert is resolved/closed with rotation+remediation evidence.
3. Confirm no deployment still uses old key.
4. Update security closure report status to CLOSED with dates/evidence (no secrets).

## Risk if Not Completed

- Exposed key in git history remains recoverable by anyone with repo/fork/clone access.
- Unrotated key can be abused at provider until revoked.

## Owner / Dependencies

- **Provider admin:** key rotation/revocation.
- **Repo admin:** history rewrite, force push, branch protection.
- **All collaborators:** re-clone/reset.
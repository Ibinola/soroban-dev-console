# Contributing to Wave Work

This guide covers the Wave-specific contribution workflow for soroban-dev-console.

## Wave Branches

All Wave work follows the branch convention: `wave/<wave-number>/<short-description>`

Example: `wave/5/budget-reservation-tests`

## Before You Start

1. Pull the latest `main` and create your wave branch from it
2. Run `bash setup.sh` to verify your local environment
3. Check the issue for acceptance criteria before writing any code

## Submitting Wave Work

- One branch per issue batch (typically 4 issues per contributor)
- Each PR must link all resolved issues with `Closes #N`
- Request review from the assigned wave reviewer listed in the issue

## Wave Labels

| Label | Meaning |
|-------|---------|
| `wave:5` | Belongs to Wave 5 |
| `wave:review` | Awaiting wave reviewer sign-off |
| `wave:merged` | Merged and counted toward wave progress |

## Getting Help

Open a discussion or ping the wave coordinator in the relevant issue thread.

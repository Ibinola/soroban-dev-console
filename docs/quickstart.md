# Quickstart

Get soroban-dev-console running locally in minutes.

## Prerequisites

- Node.js 20+
- npm 10+
- A Stellar testnet account (or use the built-in Friendbot)

## Setup

Clone and install:

    git clone https://github.com/Ibinola/soroban-dev-console.git
    cd soroban-dev-console
    npm install

Copy environment files:

    cp apps/web/.env.example apps/web/.env.local
    cp apps/api/.env.example apps/api/.env

## Run Locally

    npm run dev

- Web: http://localhost:3000
- API: http://localhost:4000

## Connect a Contract

1. Open http://localhost:3000/contracts
2. Paste a deployed Soroban contract ID
3. Select a method and invoke it from the UI

## Get Testnet Funds

Use the Friendbot button on the wallet page, or run:

    curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"

## Running Tests

    npm test

## VS Code Setup

This repo ships with a `.vscode/` folder that configures the editor automatically.

### Install recommended extensions

Open the Command Palette (`Ctrl+Shift+P`) and run
**"Extensions: Show Recommended Extensions"**, then install all workspace
recommendations. Key extensions:

| Extension | Purpose |
|---|---|
| ESLint (`dbaeumer.vscode-eslint`) | Lint on save |
| Prettier (`esbenp.prettier-vscode`) | Format on save |
| Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`) | Class autocomplete |
| Prisma (`Prisma.prisma`) | Schema formatting |
| rust-analyzer (`rust-lang.rust-analyzer`) | Soroban contract dev |
| Even Better TOML (`tamasfe.even-better-toml`) | Cargo.toml support |

### What the settings do

- **Format on save** via Prettier for all TypeScript / TSX files.
- **ESLint auto-fix** on save for the `apps/web`, `apps/api`, and `packages/ui`
  workspaces.
- `typescript.tsdk` points to the workspace TypeScript so the version stays
  consistent with `package.json`.
- Tailwind IntelliSense is enabled for `.ts` / `.tsx` files and custom
  `cva`/`cx` utility regexes.

### Debug configurations

Open the **Run and Debug** panel (`Ctrl+Shift+D`). Available configurations:

| Configuration | What it starts |
|---|---|
| `Next.js: debug web app` | `npm run dev` in `apps/web` with `--inspect` |
| `NestJS: debug API` | `npm run start:debug` in `apps/api` |
| `Vitest: run web tests` | `npm run test:run` in `apps/web` |
| `Full Stack: web + API` | Compound — starts both servers together |

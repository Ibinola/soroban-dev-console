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

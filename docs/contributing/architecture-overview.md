# Architecture Overview

This project is a React-based development console for Soroban smart contracts, designed to work tightly with the Stellar network.

## Key Components

1. **Frontend**: A Next.js (or Vite/React) web application providing the UI for deploying and interacting with contracts.
2. **Soroban Utils**: A shared library used by the frontend to construct XDR, handle network calls, and parse transaction results.
3. **Rust Contracts**: Local smart contracts used for testing and validation within the console.

If you're new here, we recommend reviewing `docs/contributing/onboarding.md` first.

#!/usr/bin/env bash

set -e

echo "Setting up development environment for soroban-dev-console..."

echo "Checking dependencies..."
if ! command -v pnpm &> /dev/null; then
    echo "pnpm could not be found. Please install it."
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "Rust/cargo could not be found. Please install Rust."
    exit 1
fi

echo "Installing project dependencies..."
pnpm install

echo "Environment setup complete! You can now run 'pnpm dev'."

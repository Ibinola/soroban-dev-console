Write-Output "Setting up development environment for soroban-dev-console..."

Write-Output "Checking dependencies..."
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error "pnpm could not be found. Please install it."
    exit 1
}

if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "Rust/cargo could not be found. Please install Rust."
    exit 1
}

Write-Output "Installing project dependencies..."
pnpm install

Write-Output "Environment setup complete! You can now run 'pnpm dev'."

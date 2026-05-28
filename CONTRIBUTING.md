# Contributing to Soroban DevConsole

Thank you for considering contributing to Soroban DevConsole! This project aims to make Soroban smart contract development more accessible through a comprehensive web-based toolkit.

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Git
- Basic understanding of TypeScript and React

### Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/soroban-dev-console.git
   cd soroban-dev-console
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

4. **Initialize the database**:
   ```bash
   cd apps/api
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   cd ../..
   ```

5. **Start development servers**:
   ```bash
   npm run dev -w web
   npm run dev -w api
   ```

6. Open [http://localhost:3000](http://localhost:3000) to view the application.

## Development Workflow

### Branch Naming

Use descriptive branch names following this pattern:
- `feat/short-description` - New features
- `fix/short-description` - Bug fixes
- `docs/short-description` - Documentation updates
- `refactor/short-description` - Code refactoring
- `test/short-description` - Test additions/updates

Examples:
- `feat/workspace-export`
- `fix/rpc-caching-bug`
- `docs/update-readme`

### Commit Messages

Write clear, descriptive commit messages following conventional commits:

```
type(scope): description

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(workspaces): add export functionality
fix(rpc): correct cache key generation for batch requests
docs(readme): update setup instructions
```

### Code Style

This project uses:
- **TypeScript** strict mode
- **Prettier** for code formatting
- **ESLint** for code quality
- **Shadcn/ui** for UI components

Run linting and formatting before committing:
```bash
npm run lint
npm run format
```

### Testing

Write tests for new features and bug fixes:

```bash
# Run web tests
npm run test:run -w web

# Run API tests
npm run test -w api

# Run contract tests
cargo test --manifest-path contracts/Cargo.toml

# Run drift and integrity checks
node --experimental-strip-types scripts/check-runtime-drift.ts
node --experimental-strip-types scripts/check-dependency-integrity.ts
```

## Project Structure

```
soroban-dev-console/
├── apps/
│   ├── web/              # Next.js frontend (React, TypeScript)
│   └── api/              # NestJS backend (TypeScript, Prisma)
├── contracts/            # Soroban smart contract fixtures (Rust)
├── packages/             # Shared packages
│   ├── api-contracts/    # TypeScript type definitions
│   └── ui/               # Shared UI components
└── docs/                 # Documentation
```

### Frontend (apps/web)

- `/app` - Next.js App Router pages and layouts
- `/components` - Reusable React components
- `/lib` - Utility functions and API clients
- `/store` - Zustand state stores with schema versioning

### Backend (apps/api)

- `/src/modules` - Feature modules (workspaces, rpc, shares, etc.)
- `/src/lib` - Shared utilities and services
- `/src/auth` - Authentication guards
- `/prisma` - Database schema, migrations, and seeds

## Branch Protection and Required Checks

The `main` branch is fully protected. **Direct pushes are rejected** — all changes must go through a pull request.

A PR cannot be merged until all applicable CI jobs pass:

| Job | Runs when |
|-----|-----------|
| `Web` | `apps/web/**` or `packages/ui/**` changed |
| `API` | `apps/api/**` or `packages/api-contracts/**` changed |
| `Package Validation` | `packages/**` changed |
| `Contracts` | `contracts/**` changed |
| `DevOps` | `scripts/**`, `.env.example`, `README.md`, or `docs/architecture.md` changed |
| `E2E Tests` | `apps/web/e2e/**` changed or when `Web` runs |

At least **1 approving review** is required. Reviews are dismissed when new commits are pushed.

See [docs/branch-protection.md](./docs/branch-protection.md) for the full reference including the release process and hotfix workflow.

## Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes** following the code style guidelines

3. **Run tests and linting**:
   ```bash
   npm run test:run -w web
   npm run test -w api
   npm run lint
   npm run typecheck
   ```

4. **Commit your changes** with a descriptive message

5. **Push to your fork**:
   ```bash
   git push origin feat/my-feature
   ```

6. **Open a Pull Request** against the `main` branch:
   - Reference any related issues (e.g., "Fixes #123")
   - Include a clear description of changes
   - Add screenshots for UI changes
   - Note any breaking changes

7. **Address review feedback** promptly

> **Merge strategy**: Squash merge is preferred for feature and fix branches to keep `main` history linear. See [docs/branch-protection.md](./docs/branch-protection.md) for the full merge and release discipline.

## Areas We Need Help

### Frontend Development
- UI/UX improvements
- React component development
- State management optimizations
- Accessibility improvements

### Backend Development
- API endpoint enhancements
- Database optimizations
- Security improvements
- Performance tuning

### Smart Contracts
- Soroban contract development
- Test fixture creation
- Contract interaction patterns

### Documentation
- Tutorials and guides
- API documentation
- Code comments
- Architecture docs

### Testing
- Unit tests
- Integration tests
- End-to-end tests
- Migration verification tests

## Code Review Guidelines

When reviewing PRs, check for:
- Code follows project style guidelines
- Tests are included and passing
- No security vulnerabilities introduced
- Backward compatibility maintained (or breaking changes documented)
- Clear commit messages
- Documentation updated if needed

## Reporting Issues

When reporting bugs or proposing changes, please use the provided **Issue Templates**:
- **Audit Regression**: For reporting functional regressions found during testing.
- **Cleanup-only Work**: For proposing non-functional refactoring or debt reduction.
- **Backlog Gap / Follow-up**: For tracking missing features or audit follow-ups.

Templates include sections for:
- **Context**: Background and Track ID (e.g., [FE-001]).
- **Expected Outcome**: Clear definition of "done".
- **Implementation Notes**: Technical approach or blockers.
- **Acceptance Criteria**: Verification checklist.

If a template doesn't fit, you can still open a regular issue with:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, browser)
- Screenshots if applicable

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors. Please be respectful and inclusive in your interactions.

## Questions?

- Check existing [Issues](https://github.com/Ibinola/soroban-dev-console/issues)
- Start a [Discussion](https://github.com/Ibinola/soroban-dev-console/discussions)
- Join the [Stellar Discord](https://discord.gg/stellardev)

---

Happy coding! 🚀

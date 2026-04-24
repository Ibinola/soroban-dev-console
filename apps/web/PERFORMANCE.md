# Performance Budgets

This document tracks performance budgets for the Soroban Dev Console web application.

## Current Budgets

| Route/Chunk        | Budget | Status |
| ------------------ | ------ | ------ |
| \_app              | 250KB  | ✅     |
| index              | 200KB  | ✅     |
| contracts          | 250KB  | ✅     |
| deploy             | 200KB  | ✅     |
| tools              | 200KB  | ✅     |
| shared chunks      | 300KB  | ✅     |

## How to Check

```bash
# Generate bundle analysis report
npm run analyze

# Validate budgets
npm run check-budget
```

## CI Integration

Performance budgets are automatically checked in CI on every PR. Bundle analysis artifacts are uploaded for review.

## Guidelines

- Keep route chunks under budget
- Split large components with dynamic imports using `next/dynamic`
- Monitor third-party library sizes before adding new dependencies
- Use tree-shaking compatible imports
- Prefer named imports over default imports when possible

## Optimization Strategies

### Code Splitting

```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  ssr: false,
  loading: () => <p>Loading...</p>,
});
```

### Bundle Analysis

After running `npm run analyze`, a visual report will be generated showing:
- Bundle composition by package
- Chunk sizes and dependencies
- Duplicate dependencies
- Opportunities for optimization

### Monitoring

Track bundle size trends over time by reviewing CI artifacts. If budgets are consistently approaching limits, consider:
- Auditing dependencies for lighter alternatives
- Implementing lazy loading for non-critical routes
- Removing unused code and dependencies

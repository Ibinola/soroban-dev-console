import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GlobalError from './error';

describe('GlobalError', () => {
  it('should not expose raw error messages', () => {
    const error = new Error('Super secret technical database failure: 0x8891');
    const reset = vi.fn();
    
    render(<GlobalError error={error} reset={reset} />);
    
    expect(screen.queryByText('Super secret technical database failure: 0x8891')).not.toBeInTheDocument();
  });

  it('should display actionable recovery guidance', () => {
    const error = new Error('Test Error');
    const reset = vi.fn();
    
    render(<GlobalError error={error} reset={reset} />);
    
    expect(screen.getByText(/Please try reloading the page/i)).toBeInTheDocument();
    expect(screen.getByText(/If the problem persists, you can copy the diagnostic report/i)).toBeInTheDocument();
  });
});

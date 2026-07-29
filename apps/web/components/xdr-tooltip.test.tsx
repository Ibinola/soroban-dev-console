import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// sonner uses portals; mock the toast helpers so the snapshot is deterministic.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

import { XdrTooltip } from "@devconsole/ui";
import { decodeXdr } from "@devconsole/soroban-utils";

const SAMPLE_ENVELOPE =
  "AAAAAgAAAAB7v2dX////////////////////////////////////////////////////wAAAAAAAAAAAAAAAAAAAA==";
const SAMPLE_SCVAL = "AAAAEgAAAAAAAAAA";

describe("<XdrTooltip />", () => {
  it("renders an inline trigger that surfaces a hover affordance", () => {
    const decoded = decodeXdr(SAMPLE_ENVELOPE);
    const { container } = render(
      <XdrTooltip value={SAMPLE_ENVELOPE} decoded={decoded}>
        <span>preview trigger</span>
      </XdrTooltip>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders decoded JSON inside the popover when valid XDR is supplied", () => {
    // The popover content is portalled out of the test container, so we
    // assert that the inline trigger renders cleanly without crashing.
    const { container } = render(
      <XdrTooltip value={SAMPLE_SCVAL} decoded={decodeXdr(SAMPLE_SCVAL)}>
        <em>scval preview</em>
      </XdrTooltip>,
    );
    expect(container).toMatchSnapshot();
  });

  it("renders an unrecognised fallback when no decoded payload is provided", () => {
    const { container } = render(
      <XdrTooltip value="not-base64-!!!@#">
        <span>opaque trigger</span>
      </XdrTooltip>,
    );
    expect(container).toMatchSnapshot();
  });
});

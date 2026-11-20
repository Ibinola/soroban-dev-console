# Accessible transaction review guide and supported WASM formats

## Accessible transaction review interaction guide
- The review dialog traps focus; Tab and Shift+Tab cycle within it, Escape closes it.
- On open, focus moves to the dialog heading; on close, focus returns to the control that opened it.
- Each section (source account, operations, fee, footprint) is a labelled region with a heading.
- Status changes (simulating, signing, submitted, failed) are announced through an `aria-live="polite"` region.
- Confirm and Cancel are real buttons with visible focus styles; the primary action is reachable by keyboard in two Tab presses.
- Colour is never the only signal; errors include text and an icon.

## Supported WASM format matrix
| Format | Supported | Notes |
|---|---|---|
| Soroban contract WASM (`.wasm`) | Yes | Standard build output |
| Optimized WASM (`stellar contract optimize`) | Yes | Smaller upload size |
| Contract spec embedded in custom section | Yes | Used to render the method list |
| Non-Soroban WASM modules | No | Rejected at upload |
| WASM above the network size limit | No | Rejected by the network |

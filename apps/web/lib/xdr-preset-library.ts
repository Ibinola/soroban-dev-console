/**
 * Preset library of standard Soroban XDR samples for the XDR tools page. (#928)
 */
export interface XdrSample {
  label: string;
  type: "ScVal" | "LedgerKey";
  value: string;
}

export const SAMPLE_XDR_PRESETS: XdrSample[] = [
  {
    label: "SEP-41 Token Balance Key",
    type: "LedgerKey",
    value: "AAAABgAAAAEAAAAAAAAAAA==",
  },
  {
    label: "Option<Address> None",
    type: "ScVal",
    value: "AAAAAA==",
  },
  {
    label: "Symbol List",
    type: "ScVal",
    value: "AAAAEAAAAAEAAAAPAAAABGxpc3Q=",
  },
];

export function findSamplePreset(label: string): XdrSample | undefined {
  return SAMPLE_XDR_PRESETS.find((sample) => sample.label === label);
}

export function samplePresetLabels(): string[] {
  return SAMPLE_XDR_PRESETS.map((sample) => sample.label);
}

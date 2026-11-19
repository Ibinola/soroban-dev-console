/** Builders for tiny WASM modules used by the section, metadata and import tests. */

export const leb = (n: number): number[] => {
  const out: number[] = [];
  do {
    let b = n & 0x7f;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
};

export const str = (s: string): number[] => {
  const bytes = [...Buffer.from(s, "utf8")];
  return [...leb(bytes.length), ...bytes];
};

export const section = (id: number, payload: number[]): number[] => [id, ...leb(payload.length), ...payload];

export const customSection = (name: string, body: number[]): number[] => section(0, [...str(name), ...body]);

export const module_ = (...sections: number[][]): Uint8Array =>
  new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, ...sections.flat()]);

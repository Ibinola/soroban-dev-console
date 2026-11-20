/**
 * Itemize base fee, resource fee, and refund into a net fee breakdown. (#917)
 */
export interface FeeBreakdown {
  baseFeeXlm: number;
  resourceFeeXlm: number;
  refundXlm: number;
  netFeeXlm: number;
}

const STROOPS_PER_XLM = 10_000_000;

export function stroopsToXlm(stroops: number): number {
  return stroops / STROOPS_PER_XLM;
}

export function computeFeeBreakdown(
  baseFeeStroops: number,
  resourceFeeStroops: number,
  refundStroops: number,
): FeeBreakdown {
  const baseFeeXlm = stroopsToXlm(baseFeeStroops);
  const resourceFeeXlm = stroopsToXlm(resourceFeeStroops);
  const refundXlm = stroopsToXlm(refundStroops);

  return {
    baseFeeXlm,
    resourceFeeXlm,
    refundXlm,
    netFeeXlm: baseFeeXlm + resourceFeeXlm - refundXlm,
  };
}

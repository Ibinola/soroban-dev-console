export interface AbiMatrixCheck {
  specVersion: string;
  isSupported: boolean;
  deprecationDateIso?: string;
  upgradePath?: string;
}

export interface AbiCompatibilityResult {
  contractId: string;
  currentSpec: string;
  matrixChecks: AbiMatrixCheck[];
  isValid: boolean;
}

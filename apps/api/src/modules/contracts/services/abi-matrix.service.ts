import {
  abiCompatibilityResultSchema,
  type AbiCompatibilityResult,
} from '@qyou/shared';

export class AbiMatrixService {
  private readonly SUPPORTED_VERSIONS = ['v20', 'v21', 'v22'];

  public validateCompatibility(contractId: string, currentSpec: string): AbiCompatibilityResult {
    const isSupported = this.SUPPORTED_VERSIONS.includes(currentSpec);
    
    const result: AbiCompatibilityResult = {
      contractId,
      currentSpec,
      isValid: isSupported,
      matrixChecks: [
        {
          specVersion: currentSpec,
          isSupported,
          upgradePath: isSupported ? undefined : 'Upgrade to v21 or v22 for full compatibility.',
        },
      ],
    };

    return abiCompatibilityResultSchema.parse(result);
  }
}

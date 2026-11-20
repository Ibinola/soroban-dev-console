// frontend/services/xdr-converter.service.ts
import { StrKey, xdr } from '@stellar/stellar-sdk';

export function convertAddressToScVal(address: string) {
  try {
    let scVal: xdr.ScVal;

    if (StrKey.isValidEd25519PublicKey(address)) {
      const pubKeyBytes = StrKey.decodeEd25519PublicKey(address);
      scVal = xdr.ScVal.scvAddress(
        xdr.ScAddress.scdAccountId(
          xdr.AccountId.scIdTypeEd25519(pubKeyBytes)
        )
      );
    } else if (StrKey.isValidContract(address)) {
      const contractBytes = StrKey.decodeContract(address);
      scVal = xdr.ScVal.scvAddress(
        xdr.ScAddress.scdContractId(contractBytes)
      );
    } else {
      throw new Error('Invalid Stellar public key (G...) or contract ID (C...) format');
    }

    const xdrString = scVal.toXDR('base64');
    const bytes = scVal.toXDR();

    return {
      success: true,
      xdrString,
      bytes,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to convert address to ScVal XDR',
    };
  }
}
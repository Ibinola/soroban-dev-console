/**
 * Argument preset manager for saving and pre-filling contract function invocation inputs.
 */

export interface FunctionPreset {
  id: string;
  contractId: string;
  functionName: string;
  presetName: string;
  arguments: Record<string, unknown>;
  createdAt: number;
}

export class ArgumentPresetManager {
  private presets: FunctionPreset[] = [];

  public savePreset(contractId: string, functionName: string, presetName: string, args: Record<string, unknown>): FunctionPreset {
    const preset: FunctionPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      contractId,
      functionName,
      presetName,
      arguments: { ...args },
      createdAt: Date.now(),
    };
    this.presets.push(preset);
    return preset;
  }

  public getPresetsForFunction(contractId: string, functionName: string): FunctionPreset[] {
    return this.presets.filter(p => p.contractId === contractId && p.functionName === functionName);
  }
}

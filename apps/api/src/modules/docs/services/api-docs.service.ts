import {
  apiReferenceSpecSchema,
  type ApiReferenceSpec,
  type ApiEndpoint,
} from '@qyou/shared';

export class ApiDocsService {
  private readonly endpoints: ApiEndpoint[] = [];

  public registerEndpoint(endpoint: ApiEndpoint): void {
    this.endpoints.push(endpoint);
  }

  public generateReferenceSpec(version: string): ApiReferenceSpec {
    const spec: ApiReferenceSpec = {
      version,
      endpoints: this.endpoints,
      generatedAtIso: new Date().toISOString(),
    };

    return apiReferenceSpecSchema.parse(spec);
  }
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  required: boolean;
  type: string;
  description: string;
}

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary: string;
  parameters: ApiParameter[];
  responses: Record<string, string>; // statusCode -> description
}

export interface ApiReferenceSpec {
  version: string;
  endpoints: ApiEndpoint[];
  generatedAtIso: string;
}

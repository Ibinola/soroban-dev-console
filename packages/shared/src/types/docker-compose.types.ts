export interface DockerService {
  name: string;
  image: string;
  ports: string[];
  environment: Record<string, string>;
  volumes: string[];
}

export interface DockerComposeConfig {
  version: string;
  services: DockerService[];
  networkMode: string;
}

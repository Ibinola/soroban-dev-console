import {
  dockerComposeConfigSchema,
  type DockerComposeConfig,
} from '@qyou/shared';

export class DockerConfigService {
  public generateDevConfig(): DockerComposeConfig {
    const config: DockerComposeConfig = {
      version: '3.8',
      networkMode: 'bridge',
      services: [
        {
          name: 'postgres',
          image: 'postgres:15-alpine',
          ports: ['5432:5432'],
          environment: {
            POSTGRES_USER: 'dev',
            POSTGRES_PASSWORD: 'dev',
            POSTGRES_DB: 'soroban_dev',
          },
          volumes: ['pgdata:/var/lib/postgresql/data'],
        },
        {
          name: 'api',
          image: 'node:20-alpine',
          ports: ['3001:3001'],
          environment: {
            NODE_ENV: 'development',
            DATABASE_URL: 'postgresql://dev:dev@postgres:5432/soroban_dev',
          },
          volumes: ['./apps/api:/app/apps/api', '/app/node_modules'],
        },
      ],
    };

    return dockerComposeConfigSchema.parse(config);
  }
}

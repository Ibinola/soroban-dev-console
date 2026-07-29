import { z } from 'zod';

export const dockerServiceSchema = z.object({
  name: z.string().min(1),
  image: z.string().min(1),
  ports: z.array(z.string()),
  environment: z.record(z.string()),
  volumes: z.array(z.string()),
});

export const dockerComposeConfigSchema = z.object({
  version: z.string().default('3.8'),
  services: z.array(dockerServiceSchema),
  networkMode: z.string().default('bridge'),
});

export type DockerComposeConfigInput = z.infer<typeof dockerComposeConfigSchema>;

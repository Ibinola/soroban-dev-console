import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DeploymentAssociation {
  network: string;
  contractId: string;
  deployedAt: number;
  deployedBy?: string;
}

export interface ArtifactMetadata {
  hash: string;
  name: string;
  size: number;
  uploadedAt: number;
  deployments: DeploymentAssociation[];
  /** True once the artifact has been synced to the cloud workspace */
  cloudSynced: boolean;
}

const MAX_ARTIFACT_SIZE_BYTES = 512 * 1024; // 512 KB hard limit

interface ArtifactState {
  artifacts: Record<string, ArtifactMetadata>;
  addArtifact: (meta: Omit<ArtifactMetadata, "deployments" | "cloudSynced">) => void;
  removeArtifact: (hash: string) => void;
  addDeployment: (hash: string, deployment: DeploymentAssociation) => void;
  markCloudSynced: (hash: string) => void;
  getArtifact: (hash: string) => ArtifactMetadata | undefined;
}

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set, get) => ({
      artifacts: {},

      addArtifact: (meta) => {
        if (meta.size > MAX_ARTIFACT_SIZE_BYTES) {
          console.warn(
            `Artifact "${meta.name}" (${meta.size}B) exceeds size limit and was not stored.`,
          );
          return;
        }
        set((state) => ({
          artifacts: {
            ...state.artifacts,
            [meta.hash]: { ...meta, deployments: [], cloudSynced: false },
          },
        }));
      },

      removeArtifact: (hash) =>
        set((state) => {
          const next = { ...state.artifacts };
          delete next[hash];
          return { artifacts: next };
        }),

      addDeployment: (hash, deployment) =>
        set((state) => {
          const artifact = state.artifacts[hash];
          if (!artifact) return state;
          return {
            artifacts: {
              ...state.artifacts,
              [hash]: {
                ...artifact,
                deployments: [...artifact.deployments, deployment],
              },
            },
          };
        }),

      markCloudSynced: (hash) =>
        set((state) => {
          const artifact = state.artifacts[hash];
          if (!artifact) return state;
          return {
            artifacts: {
              ...state.artifacts,
              [hash]: { ...artifact, cloudSynced: true },
            },
          };
        }),

      getArtifact: (hash) => get().artifacts[hash],
    }),
    {
      name: "soroban-artifact-storage",
    },
  ),
);

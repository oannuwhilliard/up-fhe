interface EthereumProvider {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    relayerSDK?: {
      initSDK: () => Promise<void>;
      createInstance: (config: Record<string, unknown>) => Promise<any>;
      SepoliaConfig?: Record<string, unknown>;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_PINATA_JWT?: string;
    readonly VITE_PINATA_GATEWAY?: string;
    readonly VITE_PINATA_API_KEY?: string;
    readonly VITE_PINATA_API_SECRET?: string;
    readonly VITE_RELAYER_RPC_URL?: string;
    readonly VITE_RELAYER_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};


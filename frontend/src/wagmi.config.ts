import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { http } from 'viem';

// 自定义 Sepolia 链配置，使用 Infura RPC
const sepoliaWithCustomRpc = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_RELAYER_RPC_URL || 'https://sepolia.infura.io/v3/3ec7c6d21e764c4d9470e4be10f73658'],
    },
    public: {
      http: [import.meta.env.VITE_RELAYER_RPC_URL || 'https://sepolia.infura.io/v3/3ec7c6d21e764c4d9470e4be10f73658'],
    },
  },
};

export const config = getDefaultConfig({
  appName: 'Image Rating dApp',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [sepoliaWithCustomRpc],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_RELAYER_RPC_URL || 'https://sepolia.infura.io/v3/3ec7c6d21e764c4d9470e4be10f73658'),
  },
  ssr: false,
});


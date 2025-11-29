import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { metaMaskWallet, okxWallet } from '@rainbow-me/rainbowkit/wallets';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';

// Only configure injected wallets: MetaMask and OKX
// WalletConnect is not used, so projectId is not needed
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Injected Wallets',
      wallets: [
        metaMaskWallet,  // MetaMask wallet
        okxWallet,       // OKX wallet
      ],
    },
  ],
  {
    appName: 'Image Rating dApp',
    // projectId is not set to disable WalletConnect
  }
);

// Use Infura RPC endpoint
const sepoliaRpcUrl = 'https://sepolia.infura.io/v3/c37e15de76944bc693d9226252fe002c';

export const config = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl),
  },
});


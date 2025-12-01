/**
 * FHEVM Mock Mode Support
 * Auto-detects Hardhat local network and uses mock FHE instance
 */

import { BrowserProvider } from 'ethers';

// Mock mode chains (Chain ID -> RPC URL)
// Support both 31337 (standard Hardhat) and 1337 (alternative)
const MOCK_CHAINS: Record<number, string> = {
  1337: 'http://127.0.0.1:8545',   // Alternative Hardhat chain ID
  31337: 'http://127.0.0.1:8545',  // Standard Hardhat local network
};

/**
 * Check if the current chain should use mock mode
 */
export function isMockChain(chainId: number): boolean {
  return Object.hasOwn(MOCK_CHAINS, chainId);
}

/**
 * Create mock FHE instance for local testing
 * Uses @fhevm/mock-utils instead of real Relayer SDK
 */
export async function createMockFhevmInstance(provider: any, chainId: number) {
  try {
    console.log('[FHEVM Mock] Creating mock instance for chain:', chainId);

    // Dynamically import mock utils to avoid bundling in production
    const { MockFhevmInstance } = await import('@fhevm/mock-utils');

    // Create ethers provider from the wallet provider
    const ethersProvider = new BrowserProvider(provider);

    // Default mock addresses for local Hardhat network
    const mockConfig = {
      aclContractAddress: '0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D',
      chainId: chainId,
      gatewayChainId: 55815,
      inputVerifierContractAddress: '0x901F8942346f7AB3a01F6D7613119Bca447Bb030',
      kmsContractAddress: '0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC',
      verifyingContractAddressDecryption: '0x5ffdaAB0373E62E2ea2944776209aEf29E631A64',
      verifyingContractAddressInputVerification: '0x812b06e1CDCE800494b79fFE4f925A504a9A9810',
    };

    const instance = await MockFhevmInstance.create(
      ethersProvider,
      ethersProvider,
      mockConfig
    );

    console.log('[FHEVM Mock] ✅ Mock instance created successfully');
    return instance;
  } catch (error) {
    console.error('[FHEVM Mock] Failed to create mock instance:', error);
    throw error;
  }
}

/**
 * Initialize FHEVM with automatic mock mode detection
 */
export async function initializeFhevmWithMockSupport(
  provider: any,
  chainId: number
): Promise<any> {
  // Check if we should use mock mode
  if (isMockChain(chainId)) {
    console.log('[FHEVM] 🧪 Using MOCK mode for local testing (Chain ID:', chainId, ')');
    return await createMockFhevmInstance(provider, chainId);
  }

  // Use real Relayer SDK for production chains
  console.log('[FHEVM] 🔐 Using REAL Relayer SDK (Chain ID:', chainId, ')');

  const sdk = (window as any).relayerSDK || (window as any).RelayerSDK;
  if (!sdk) {
    throw new Error('RelayerSDK not loaded. Please include the CDN script.');
  }

  await sdk.initSDK();

  const { SepoliaConfig } = sdk;
  const config = { ...SepoliaConfig, network: provider };

  const instance = await sdk.createInstance(config);
  console.log('[FHEVM] ✅ Real SDK instance created');

  return instance;
}

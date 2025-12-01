/**
 * Auto-add localhost network to wallet
 */

export async function addLocalhostNetwork(provider: any) {
  try {
    console.log('[Network] Requesting to add localhost network...');

    const params = {
      chainId: '0x7A69', // 31337 in hex
      chainName: 'Localhost 8545',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['http://127.0.0.1:8545'],
      blockExplorerUrls: null,
    };

    console.log('[Network] Adding with params:', JSON.stringify(params, null, 2));

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [params],
    });

    console.log('[Network] ✅ Localhost network added successfully');
    return true;
  } catch (error: any) {
    // User rejected or error occurred
    if (error.code === 4001) {
      console.log('[Network] User rejected adding network');
    } else if (error.code === -32602) {
      console.error('[Network] Invalid parameters. Your wallet may not support localhost networks.');
      console.error('[Network] Error details:', error);
      alert('⚠️ Your wallet does not support adding localhost networks automatically.\n\nPlease add manually:\n\nNetwork Name: Localhost 8545\nRPC URL: http://127.0.0.1:8545\nChain ID: 31337\nCurrency: ETH');
    } else {
      console.error('[Network] Failed to add network:', error);
    }
    return false;
  }
}

/**
 * Switch to localhost network
 */
export async function switchToLocalhostNetwork(provider: any) {
  try {
    console.log('[Network] Switching to localhost network...');

    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7A69' }], // 31337
    });

    console.log('[Network] ✅ Switched to localhost network');
    return true;
  } catch (error: any) {
    // Chain not added yet
    if (error.code === 4902) {
      console.log('[Network] Network not added, trying to add it...');
      return await addLocalhostNetwork(provider);
    }

    console.error('[Network] Failed to switch network:', error);
    return false;
  }
}

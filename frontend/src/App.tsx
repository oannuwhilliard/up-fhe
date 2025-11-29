import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import type { Signer } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "./App.css";
import { IMAGE_RATING_ABI, IMAGE_RATING_ADDRESS } from "./constants/contract";
import { ACL_ABI } from "./constants/acl";

type GalleryItem = {
  id: string;
  ipfsCID: string;
  creator: string;
  createdAt: string;
  sum: string;
  count: string;
  gatewayUrl: string;
};

const appendHexPrefix = (hex: string) => (hex.startsWith("0x") ? hex : `0x${hex}`);

const bytesToHex = (bytes: Uint8Array) =>
  `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

const ensureHexPrefixed = (value: unknown): string => {
  if (typeof value === "string") {
    return appendHexPrefix(value);
  }
  if (value instanceof Uint8Array) {
    return bytesToHex(value);
  }
  if (value instanceof ArrayBuffer) {
    return bytesToHex(new Uint8Array(value));
  }
  if (typeof value === "object" && value !== null) {
    const maybeHandle = (value as { handle?: unknown }).handle;
    if (typeof maybeHandle === "string") {
      return appendHexPrefix(maybeHandle);
    }
  }
  if (value === undefined || value === null) {
    throw new Error("Missing required encrypted data.");
  }
  return appendHexPrefix(String(value));
};

const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs";
const PINATA_GATEWAY = (import.meta.env.VITE_PINATA_GATEWAY || DEFAULT_GATEWAY).replace(/\/$/, "");
const buildGatewayUrl = (cid: string) => `${PINATA_GATEWAY}/${cid}`;
const DEFAULT_RPC = "https://sepolia.infura.io/v3/c37e15de76944bc693d9226252fe002c";
const DEFAULT_RELAYER = "https://relayer.testnet.zama.ai";
const RELAYER_RPC_URL = import.meta.env.VITE_RELAYER_RPC_URL || DEFAULT_RPC;
const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || DEFAULT_RELAYER;
const ACL_ADDRESS = import.meta.env.VITE_ACL_ADDRESS || IMAGE_RATING_ADDRESS;
const logDecrypt = (...args: unknown[]) => console.info("[Decrypt]", ...args);

function App() {
  type RelayerSDK = {
    initSDK: () => Promise<void>;
    createInstance: (config: Record<string, unknown>) => Promise<any>;
    SepoliaConfig?: Record<string, unknown>;
  };

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [signer, setSigner] = useState<Signer>();
  const [status, setStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"upload" | "gallery" | "decrypt">("upload");
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageCards, setImageCards] = useState<GalleryItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [decryptedStatsById, setDecryptedStatsById] = useState<
    Record<
      string,
      {
        sum: number;
        count: number;
        average: number;
      }
    >
  >({});
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [fheInstance, setFheInstance] = useState<any>(null);
  const [isInitializingSdk, setIsInitializingSdk] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [ethereumProvider, setEthereumProvider] = useState<any>(null);

  const contract = useMemo(() => {
    if (!signer) return undefined;
    return new Contract(IMAGE_RATING_ADDRESS, IMAGE_RATING_ABI, signer);
  }, [signer]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    if (file) {
      console.log("[Pinata] 已选择文件:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }
  };

  const uploadFileToPinata = async () => {
    const jwt = import.meta.env.VITE_PINATA_JWT;
    const apiKey = import.meta.env.VITE_PINATA_API_KEY;
    const apiSecret = import.meta.env.VITE_PINATA_API_SECRET;
    if (!jwt && (!apiKey || !apiSecret)) {
      throw new Error("Missing Pinata credentials. Please configure JWT or API key/secret.");
    }

    const file = selectedFile;
    if (!file) {
      throw new Error("No image file selected for upload.");
    }

    console.info("[Pinata] Starting upload", {
      usingJwt: Boolean(jwt),
      fileName: file.name,
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "pinataMetadata",
      JSON.stringify({
        name: file.name,
      })
    );

    const headers: Record<string, string> = jwt
      ? { Authorization: `Bearer ${jwt}` }
      : {
          pinata_api_key: apiKey!,
          pinata_secret_api_key: apiSecret!,
        };

    const response = await fetch(PINATA_API_URL, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text();
      console.error("[Pinata] Upload failed, non-2xx response", message);
      throw new Error(message || "Pinata returned an error");
    }

    const data = await response.json();
    const cid = data.IpfsHash as string;
    console.info("[Pinata] Upload successful, CID:", cid);
    return cid;
  };

  // Initialize Provider and Signer when wallet connects
  useEffect(() => {
    if (!isConnected || !address || !walletClient) {
      setSigner(undefined);
      setEthereumProvider(null);
      return;
    }

    const initializeWallet = async () => {
      try {
        setStatus("Initializing wallet connection...");

        // Detect the correct provider based on connected wallet
        // OKX wallet uses window.okxwallet, MetaMask uses window.ethereum
        let ethereumProvider: any = null;
        
        // Check walletClient to determine which wallet is connected
        const walletName = walletClient?.name?.toLowerCase() || '';
        const walletId = walletClient?.id?.toLowerCase() || '';
        const win = window as any;
        
        console.log("[Wallet] Detecting provider", { walletName, walletId, hasOkx: !!win.okxwallet, hasEthereum: !!win.ethereum });
        
        // Check for OKX wallet first (if OKX is connected or available)
        // OKX wallet provider can be at window.okxwallet.ethereum or window.okxwallet
        if (walletName.includes('okx') || walletId.includes('okx') || win.okxwallet) {
          // Try window.okxwallet.ethereum first (most common)
          if (win.okxwallet?.ethereum) {
            ethereumProvider = win.okxwallet.ethereum;
            console.log("[Wallet] Using OKX wallet provider (okxwallet.ethereum)");
          } 
          // Fallback to window.okxwallet directly
          else if (win.okxwallet) {
            ethereumProvider = win.okxwallet;
            console.log("[Wallet] Using OKX wallet provider (okxwallet)");
          }
        }
        
        // Fallback to MetaMask or other injected wallets
        if (!ethereumProvider && win.ethereum) {
          ethereumProvider = win.ethereum;
          console.log("[Wallet] Using window.ethereum provider");
        }
        
        if (!ethereumProvider) {
          throw new Error("No ethereum provider found. Please install MetaMask or OKX wallet.");
        }

        // Save the provider for FHEVM initialization
        setEthereumProvider(ethereumProvider);

        // Create BrowserProvider and Signer
        const newProvider = new BrowserProvider(ethereumProvider as never);
        const newSigner = await newProvider.getSigner();

        setSigner(newSigner);
        setStatus("Wallet connected successfully.");
        console.log("[Wallet] Connected account", address);
      } catch (error) {
        console.error(error);
        setStatus(`Failed to initialize wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };

    initializeWallet();
  }, [isConnected, address, walletClient]);

  const handleUploadImage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatus("Please select an image file to upload.");
      console.warn("[Upload] No file selected, aborting.");
      return;
    }

    if (!signer || !contract) {
      setStatus("Please connect wallet first.");
      console.warn("[Contract] Wallet not connected, cannot upload image.");
      return;
    }

    try {
      setIsPublishing(true);
      setStatus("Step 1/2: Uploading file to Pinata...");
      const cid = await uploadFileToPinata();
      setStatus("Step 2/2: Submitting on-chain transaction...");
      console.info("[Contract] Calling uploadImage, CID:", cid);
      const tx = await contract.uploadImage(cid);
      setStatus(`Transaction sent: ${tx.hash}, waiting for confirmation...`);
      console.log("[Contract] uploadImage tx hash:", tx.hash);
      await tx.wait();
      setStatus("Image uploaded and on-chain successfully!");
      setPreviewUrl(buildGatewayUrl(cid));
      setSelectedFile(null);
      await loadImages();
      console.info("[Contract] uploadImage completed");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Upload process failed";
      setStatus(message);
    } finally {
      setIsPublishing(false);
    }
  };

  const initializeRelayerSdk = useCallback(async (): Promise<boolean> => {
    if (sdkReady) {
      return true;
    }
    if (isInitializingSdk) {
      setStatus("Background service is starting, please wait...");
      return false;
    }
    const sdk = window.relayerSDK as RelayerSDK | undefined;
    if (!sdk) {
      console.warn("[RelayerSDK] CDN script not loaded yet.");
      setStatus("Encryption service not loaded yet. Please try again later or refresh the page.");
      return false;
    }
    try {
      setIsInitializingSdk(true);
      setStatus("Preparing background service...");
      await sdk.initSDK();
      
      // Use the detected provider (OKX or MetaMask) instead of RPC URL
      // This ensures FHEVM uses the correct wallet provider
      const networkProvider = ethereumProvider || window.ethereum || RELAYER_RPC_URL;
      
      const instance = await sdk.createInstance({
        ...(sdk.SepoliaConfig || {}),
        network: networkProvider,
        relayerUrl: RELAYER_URL,
      });
      setFheInstance(instance);
      setSdkReady(true);
      setStatus("Background service is ready.");
      console.info("[RelayerSDK] Initialization completed", {
        network: networkProvider === RELAYER_RPC_URL ? "RPC URL" : "Provider object",
        relayerUrl: RELAYER_URL,
        usingProvider: !!ethereumProvider,
      });
      return true;
    } catch (error) {
      console.error("[RelayerSDK] Initialization failed:", error);
      const message =
        error instanceof Error ? error.message : "Service initialization failed, please try again later.";
      setStatus(message);
      return false;
    } finally {
      setIsInitializingSdk(false);
    }
  }, [isInitializingSdk, sdkReady, ethereumProvider]);

  useEffect(() => {
    if (address) {
      initializeRelayerSdk();
    }
  }, [address, initializeRelayerSdk]);

  const loadImages = useCallback(async () => {
    if (!contract) {
      return;
    }
    try {
      setIsLoadingImages(true);
      const total = Number(await contract.getTotalImages());
      const ids = Array.from({ length: total }, (_, i) => i);
      const cards: GalleryItem[] = await Promise.all(
        ids.map(async (id) => {
          const [ipfsCID, creator, createdAtBn] = await contract.getImageInfo(id);
          const [sum, count] = await contract.getEncryptedStats(id);
          return {
            id: id.toString(),
            ipfsCID,
            creator,
            createdAt: new Date(Number(createdAtBn) * 1000).toLocaleString(),
            sum,
            count,
            gatewayUrl: buildGatewayUrl(ipfsCID),
          };
        })
      );
      setImageCards(cards.reverse());
    } catch (error) {
      console.error("[Images] Load failed", error);
    } finally {
      setIsLoadingImages(false);
    }
  }, [contract]);

  useEffect(() => {
    if (contract) {
      loadImages();
    }
  }, [contract, loadImages]);

  const encryptRatingViaSDK = async (rating: number) => {
    if (!fheInstance || !signer) {
      throw new Error("Background service is not ready yet. Please wait or refresh and try again.");
    }
    const userAddress = await signer.getAddress();
    const encryptedInput = fheInstance.createEncryptedInput(IMAGE_RATING_ADDRESS, userAddress);
    encryptedInput.add32(rating);
    const { handles, inputProof } = await encryptedInput.encrypt();
    if (!handles || handles.length === 0) {
      throw new Error("Background service did not return valid encrypted data.");
    }
    return {
      encryptedRating: handles[0],
      inputProof,
    };
  };

  const handleUserDecrypt = async (imageId: string, sumHandle: string, countHandle: string) => {
    logDecrypt("Start decrypt flow", { imageId, sumHandle, countHandle });
    if (!contract || !signer) {
      setStatus("Please connect wallet first.");
      console.warn("[Decrypt] Wallet not connected");
      return;
    }
    if (!sdkReady) {
      const ready = await initializeRelayerSdk();
      if (!ready) {
        return;
      }
    }
    if (!fheInstance) {
      const ready = await initializeRelayerSdk();
      if (!ready || !fheInstance) {
        setStatus("Background service is not ready yet, cannot decrypt temporarily.");
        console.error("[Decrypt] fheInstance missing after init attempt");
        return;
      }
    }
    if (!ACL_ADDRESS) {
      setStatus("ACL contract address not configured, cannot decrypt.");
      console.warn("[Decrypt] Missing ACL address");
      return;
    }
    try {
      setIsDecrypting(true);
      setStatus("Preparing decryption...");
      logDecrypt("Step 1: resolve user address");
      const userAddress = await signer.getAddress();
      const handles = [sumHandle, countHandle];
      logDecrypt("Step 2: ACL authorize handles", { handles, acl: ACL_ADDRESS });
      const acl = new ethers.Contract(ACL_ADDRESS, ACL_ABI, signer);
      for (const handle of handles) {
        const authorized = await acl.persistAllowed(handle, IMAGE_RATING_ADDRESS);
        logDecrypt("ACL persistAllowed result", { handle, authorized });
        if (!authorized) {
          logDecrypt("Calling allow()", { handle });
          const tx = await acl.allow(handle, IMAGE_RATING_ADDRESS);
          await tx.wait();
          logDecrypt("allow tx confirmed");
        }
      }
      logDecrypt("Step 3: generate keypair");
      const keypair = fheInstance.generateKeypair();
      const timestamp = Math.floor(Date.now() / 1000).toString();
      logDecrypt("Step 4: create EIP712", { timestamp });
      const eip712 = fheInstance.createEIP712(
        keypair.publicKey,
        [IMAGE_RATING_ADDRESS],
        timestamp,
        "10"
      );
      logDecrypt("Step 5: sign typed data");
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      const handlePairs = handles.map((handle) => ({
        handle,
        contractAddress: IMAGE_RATING_ADDRESS,
      }));
      setStatus("Requesting decryption from Relayer...");
      logDecrypt("Step 6: call userDecrypt");
      const result = await fheInstance.userDecrypt(
        handlePairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        [IMAGE_RATING_ADDRESS],
        userAddress,
        timestamp,
        "10"
      );
      logDecrypt("userDecrypt result", result);
      const resolveValue = (handle: string) => {
        if (result.clearValues && result.clearValues[handle] !== undefined) {
          return result.clearValues[handle];
        }
        if (result[handle] !== undefined) {
          return result[handle];
        }
        return undefined;
      };
      const clearSum = Number(resolveValue(sumHandle));
      const clearCount = Number(resolveValue(countHandle));
      if (Number.isNaN(clearSum) || Number.isNaN(clearCount)) {
        throw new Error("Decryption result is invalid, please try again.");
      }
      const average = clearCount > 0 ? clearSum / clearCount : 0;
      setDecryptedStatsById((prev) => ({
        ...prev,
        [imageId]: {
          sum: clearSum,
          count: clearCount,
          average,
        },
      }));
      setStatus("Decryption completed.");
      logDecrypt("Success", { clearSum, clearCount, average });
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error ? error.message : "Decryption failed, please check console for details."
      );
      setDecryptedStatsById((prev) => {
        const next = { ...prev };
        delete next[imageId];
        return next;
      });
    } finally {
      logDecrypt("End decrypt flow");
      setIsDecrypting(false);
    }
  };

  const handleQuickRating = async (imageId: string, rating: number) => {
    if (!sdkReady) {
      const ready = await initializeRelayerSdk();
      if (!ready) {
        console.warn("[RelayerSDK] Not ready yet.");
        return;
      }
    }
    if (!contract) {
      setStatus("Please connect wallet first.");
      console.warn("[Contract] Wallet not connected, cannot submit rating.");
      return;
    }

    try {
      setIsSubmittingRating(true);
      setStatus("Preparing encrypted rating...");
      console.info("[Rating] Target imageId:", imageId, "Stars:", rating);
      const { encryptedRating, inputProof } = await encryptRatingViaSDK(rating);
      const parsedId = BigInt(imageId);
      const ratingHex = ensureHexPrefixed(encryptedRating);
      const proofHex = ensureHexPrefixed(inputProof);
      setStatus("Rating encrypted, submitting transaction...");
      console.info("[Contract] submitRating parameters", {
        imageId: parsedId.toString(),
        ratingHex,
        proofHexLength: proofHex.length,
      });
      const tx = await contract.submitRating(parsedId, ratingHex, proofHex);
      setStatus(`Rating transaction sent: ${tx.hash}, waiting for confirmation...`);
      console.log("[Contract] submitRating tx hash:", tx.hash);
      await tx.wait();
      setStatus("Rating submitted successfully.");
      console.info("[Contract] submitRating completed");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to submit rating, please verify your input.";
      setStatus(message);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <p className="eyebrow">Image Rating dApp</p>
          <h1>Privacy Rating Panel</h1>
          <p className="subtitle">
            Contract Address: <span className="mono">{IMAGE_RATING_ADDRESS}</span>
          </p>
        </div>
        <ConnectButton />
      </header>

      <div className="tab-nav">
        <button
          className={activeTab === "upload" ? "tab active" : "tab"}
          onClick={() => setActiveTab("upload")}
        >
          Upload Image
        </button>
        <button
          className={activeTab === "gallery" ? "tab active" : "tab"}
          onClick={() => setActiveTab("gallery")}
        >
          Image Gallery
        </button>
        <button
          className={activeTab === "decrypt" ? "tab active" : "tab"}
          onClick={() => setActiveTab("decrypt")}
        >
          My Decryption
        </button>
      </div>

      <section className={`card ${activeTab === "upload" ? "" : "hidden-card"}`}>
        <h2>Upload and On-Chain</h2>
        <p className="section-desc">
          Select an image and click the button below. The frontend will first upload to Pinata, then automatically call the contract `uploadImage`.
        </p>
        <form onSubmit={handleUploadImage} className="form">
          <label htmlFor="file-upload" className="upload-area">
            {selectedFile ? (
              <>
                <span className="upload-title">{selectedFile.name}</span>
                <span className="upload-subtitle">Click to reselect image</span>
              </>
            ) : (
              <>
                <span className="upload-icon">+</span>
                <span className="upload-title">Click to upload image</span>
                <span className="upload-subtitle">Supports PNG / JPG / GIF</span>
              </>
            )}
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          <button className="primary" type="submit" disabled={isPublishing}>
            {isPublishing ? "Processing..." : "Upload and On-Chain"}
          </button>
        </form>
        {previewUrl && (
          <div className="preview-card">
            <span className="label">Latest On-Chain Image</span>
            <img src={previewUrl} alt="Latest image" />
            <a href={previewUrl} target="_blank" rel="noreferrer">
              View on IPFS Gateway
            </a>
          </div>
        )}
      </section>

      <section
        className={`card ${activeTab === "gallery" ? "" : "hidden-card"}`}
      >
        <h2>Image Gallery</h2>
        <p className="section-desc">All on-chain images will be displayed automatically. You can rate or decrypt directly here.</p>
        {isLoadingImages && <p>Loading images...</p>}
        <div className="image-list">
          {imageCards.map((image) => {
            const decrypted = decryptedStatsById[image.id];
            return (
              <div className="gallery-card" key={image.id}>
                <img src={image.gatewayUrl} alt={`image-${image.id}`} />
                <div>
                  <span className="label">Image ID</span>
                  <p className="mono">#{image.id}</p>
                </div>
                <div className="rating-buttons">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={`${image.id}-${value}`}
                      className="rating-button"
                      type="button"
                      disabled={isSubmittingRating}
                      onClick={() => handleQuickRating(image.id, value)}
                    >
                      {value} ⭐
                    </button>
                  ))}
                </div>
                <button
                  className="secondary"
                  type="button"
                  disabled={isDecrypting}
                  onClick={() => handleUserDecrypt(image.id, image.sum, image.count)}
                >
                  {isDecrypting ? "Decrypting..." : "Decrypt My Rating"}
                </button>
                {decrypted && (
                  <div className="stats-card">
                    <div>
                      <span className="label">Total Score</span>
                      <p>{decrypted.sum}</p>
                    </div>
                    <div>
                      <span className="label">Count</span>
                      <p>{decrypted.count}</p>
                    </div>
                    <div>
                      <span className="label">Average</span>
                      <p>{decrypted.average.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!isLoadingImages && imageCards.length === 0 && (
          <p className="hint">No images yet. Please upload a work first.</p>
        )}
      </section>

      <section className={`card ${activeTab === "decrypt" ? "" : "hidden-card"}`}>
        <h2>My Decryption</h2>
        <p className="section-desc">
          Decrypt your own works. Only entries you have initiated decryption for will be displayed.
        </p>
        {Object.keys(decryptedStatsById).length === 0 && (
          <p className="hint">No works decrypted yet.</p>
        )}
        <div className="image-list">
          {imageCards
            .filter((image) => decryptedStatsById[image.id])
            .map((image) => {
              const decrypted = decryptedStatsById[image.id];
              if (!decrypted) return null;
              return (
                <div className="gallery-card" key={`decrypt-${image.id}`}>
                  <img src={image.gatewayUrl} alt={`image-${image.id}`} />
                  <div>
                    <span className="label">Image ID</span>
                    <p className="mono">#{image.id}</p>
                  </div>
                  <div className="stats-card">
                    <div>
                      <span className="label">Total Score</span>
                      <p>{decrypted.sum}</p>
                    </div>
                    <div>
                      <span className="label">Count</span>
                      <p>{decrypted.count}</p>
                    </div>
                    <div>
                      <span className="label">Average</span>
                      <p>{decrypted.average.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {status && <footer className="status-bar">{status}</footer>}
    </div>
  );
}

export default App;

# Image Rating dApp with FHEVM

去中心化图片打分系统，使用 Zama FHEVM 实现加密评分。

## 功能特性

- ✅ **上传图片**：任何人都可以上传图片（IPFS CID 存储在链上）
- ✅ **加密打分**：所有人都能对图片打分（1-5星），评分使用 FHE 加密
- ✅ **持续打分**：没有时间限制，可以一直有人打分
- ✅ **隐私保护**：只有图片上传者才能解密总分和评分数量
- ✅ **累积计分**：每次有新人打分，总分会累积增加

## 合约架构

### 核心功能

```solidity
// 上传图片（存储 IPFS CID）
function uploadImage(string calldata ipfsCID) external returns (uint256)

// 提交加密评分（1-5星）
function submitRating(
    uint256 imageId,
    externalEuint32 encryptedRating,
    bytes calldata inputProof
) external

// 获取加密统计数据（创建者解密）
function getEncryptedStats(uint256 imageId)
    external view
    returns (euint32 sum, euint32 count)
```

### 数据结构

```solidity
struct Image {
    uint256 id;
    string ipfsCID;              // IPFS CID
    address creator;             // 创建者
    euint32 encryptedSum;        // 加密的总分
    euint32 encryptedCount;      // 加密的评分数量
    uint256 createdAt;           // 创建时间
    bool exists;                 // 是否存在
}
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写：

```bash
cp .env.example .env
```

编辑 `.env`：
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

### 3. 编译合约

```bash
npm run compile
```

### 4. 部署到 Sepolia

```bash
npm run deploy:sepolia
```

### 5. 启动前端 (Vite + React)

```bash
cd frontend
npm install
npm run dev
```

前端会自动加载 `src/constants/contract.ts` 中配置的合约地址（当前为 `0x4447501cc7e490B370bf91E2F4FD1874BdFCd841`）与 ABI，可直接连接钱包进行交互。

### 6. （可选）配置 Pinata 上传

前端支持直接把本地图片上传到 Pinata 并自动填充 CID。需要在 `frontend` 目录下创建 `.env` 文件并写入：

```env
VITE_PINATA_JWT=你的_Pinata_JWT            # 推荐。若使用 JWT，可不填 key/secret
VITE_PINATA_API_KEY=你的PinataKey         # 如果没有 JWT，就使用 key/secret
VITE_PINATA_API_SECRET=你的PinataSecret
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs
VITE_RELAYER_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_RELAYER_URL=https://relayer.testnet.zama.ai
```

JWT 可在 Pinata Dashboard 的 API Keys 页面创建 Bare Token。`VITE_PINATA_GATEWAY` 可换成你自定义的 Dedicated Gateway。

前端在“提交评分”页会自动调用 `window.relayerSDK`：

1. 在 `frontend/index.html` 中注入 Zama 官方 CDN
2. 确保有有效的 Sepolia RPC / Relayer URL（默认指向官方测试网，可按需覆盖）
3. 点击评分按钮前保持钱包已连接，SDK 初始化完成后状态栏会提示“Relayer SDK 已初始化”

## 工作流程

### 上传图片

1. 用户上传图片到 IPFS（例如 Pinata）
2. 获得 IPFS CID（例如：`QmX...abc`）
3. 调用 `uploadImage(ipfsCID)` 将 CID 存储到链上

### 打分

1. 用户选择 1-5 星评分
2. 前端使用 FHEVM SDK 加密评分
3. 调用 `submitRating(imageId, encryptedRating, proof)`
4. 合约将加密评分累加到 `encryptedSum`，计数 +1

### 解密（仅创建者）

1. 创建者调用 `getEncryptedStats(imageId)`
2. 获得 `encryptedSum` 和 `encryptedCount` 句柄
3. 使用 FHEVM SDK 的 EIP-712 签名解密
4. 计算平均分：`averageRating = sum / count`

## 技术栈

- **Solidity 0.8.24** - 智能合约语言
- **Hardhat 2.26.0** - 开发环境
- **FHEVM 0.9.1** - Zama 全同态加密
- **TypeScript** - 类型安全
- **Hardhat Deploy** - 部署脚本管理

## 合约地址

部署后，合约地址会显示在控制台。

## License

MIT

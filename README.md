# Image Rating dApp with FHEVM

去中心化图片打分系统，使用 Zama FHEVM 实现加密评分。
youtube-video：https://www.youtube.com/watch?v=Rvqi5jBTNjg
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

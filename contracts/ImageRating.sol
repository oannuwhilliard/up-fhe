// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ImageRating
 * @notice Decentralized image rating system with FHE encrypted ratings
 * @dev Users upload images (IPFS CID), others rate them (1-5 stars encrypted)
 * @dev Only image creator can decrypt the total ratings
 */
contract ImageRating is ZamaEthereumConfig {
    // ============ State Variables ============

    uint256 private _imageIdCounter;

    // Mapping from imageId to Image data
    mapping(uint256 => Image) private _images;

    // Mapping to track if address has rated a specific image
    mapping(uint256 => mapping(address => bool)) private _hasRated;

    // ============ Structs ============

    struct Image {
        uint256 id;
        string ipfsCID;              // IPFS CID of the uploaded image
        address creator;             // Image uploader
        euint32 encryptedSum;        // FHE encrypted sum of all ratings
        euint32 encryptedCount;      // FHE encrypted count of ratings
        uint256 createdAt;           // Timestamp when image was uploaded
        bool exists;                 // Check if image exists
    }

    // ============ Events ============

    event ImageUploaded(
        uint256 indexed imageId,
        address indexed creator,
        string ipfsCID,
        uint256 timestamp
    );

    event RatingSubmitted(
        uint256 indexed imageId,
        address indexed rater,
        uint256 timestamp
    );

    // ============ Constructor ============

    constructor() {
        _imageIdCounter = 0;
    }

    // ============ Upload Functions ============

    /**
     * @notice Upload a new image (store IPFS CID on-chain)
     * @param ipfsCID The IPFS CID of the uploaded image
     * @return imageId The ID of the newly created image
     */
    function uploadImage(string calldata ipfsCID) external returns (uint256) {
        require(bytes(ipfsCID).length > 0, "IPFS CID cannot be empty");

        uint256 imageId = _imageIdCounter;
        _imageIdCounter++;

        // Initialize encrypted sum and count to 0
        euint32 zero = FHE.asEuint32(0);

        _images[imageId] = Image({
            id: imageId,
            ipfsCID: ipfsCID,
            creator: msg.sender,
            encryptedSum: zero,
            encryptedCount: zero,
            createdAt: block.timestamp,
            exists: true
        });

        // Grant decryption permission to creator
        FHE.allow(zero, msg.sender);
        FHE.allow(zero, address(this));

        emit ImageUploaded(imageId, msg.sender, ipfsCID, block.timestamp);

        return imageId;
    }

    // ============ Rating Functions ============

    /**
     * @notice Submit an encrypted rating for an image (1-5 stars)
     * @param imageId The ID of the image to rate
     * @param encryptedRating The encrypted rating (externalEuint32)
     * @param inputProof The proof for the encrypted input
     */
    function submitRating(
        uint256 imageId,
        externalEuint32 encryptedRating,
        bytes calldata inputProof
    ) external {
        require(_images[imageId].exists, "Image does not exist");
        require(!_hasRated[imageId][msg.sender], "Already rated this image");

        Image storage image = _images[imageId];

        // Convert external encrypted input to euint32
        euint32 rating = FHE.fromExternal(encryptedRating, inputProof);

        // Add encrypted rating to sum: encryptedSum += rating
        image.encryptedSum = FHE.add(image.encryptedSum, rating);

        // Increment encrypted count: encryptedCount += 1
        euint32 one = FHE.asEuint32(1);
        image.encryptedCount = FHE.add(image.encryptedCount, one);

        // Mark as rated
        _hasRated[imageId][msg.sender] = true;

        // Grant decryption permissions
        FHE.allow(image.encryptedSum, image.creator);
        FHE.allow(image.encryptedSum, address(this));
        FHE.allow(image.encryptedCount, image.creator);
        FHE.allow(image.encryptedCount, address(this));

        emit RatingSubmitted(imageId, msg.sender, block.timestamp);
    }

    // ============ Query Functions ============

    /**
     * @notice Get image information (public data)
     * @param imageId The image ID to query
     * @return ipfsCID IPFS CID of the image
     * @return creator Address of the creator
     * @return createdAt Timestamp when created
     */
    function getImageInfo(uint256 imageId)
        external
        view
        returns (
            string memory ipfsCID,
            address creator,
            uint256 createdAt
        )
    {
        require(_images[imageId].exists, "Image does not exist");

        Image memory image = _images[imageId];

        return (
            image.ipfsCID,
            image.creator,
            image.createdAt
        );
    }

    /**
     * @notice Get encrypted rating statistics (for creator to decrypt)
     * @param imageId The image ID to query
     * @return sum Encrypted sum of ratings
     * @return count Encrypted count of ratings
     */
    function getEncryptedStats(uint256 imageId)
        external
        view
        returns (
            euint32 sum,
            euint32 count
        )
    {
        require(_images[imageId].exists, "Image does not exist");

        Image memory image = _images[imageId];

        return (
            image.encryptedSum,
            image.encryptedCount
        );
    }

    /**
     * @notice Check if an address has rated a specific image
     * @param imageId The image ID
     * @param rater The address to check
     * @return True if the address has rated, false otherwise
     */
    function hasRated(uint256 imageId, address rater)
        external
        view
        returns (bool)
    {
        return _hasRated[imageId][rater];
    }

    /**
     * @notice Get total number of images uploaded
     * @return Total count of images
     */
    function getTotalImages() external view returns (uint256) {
        return _imageIdCounter;
    }

    /**
     * @notice Check if an image exists
     * @param imageId The image ID to check
     * @return True if exists, false otherwise
     */
    function imageExists(uint256 imageId) external view returns (bool) {
        return _images[imageId].exists;
    }
}

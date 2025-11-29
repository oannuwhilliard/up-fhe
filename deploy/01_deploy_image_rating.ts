import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployImageRating: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying ImageRating with account:", deployer);

  const imageRating = await deploy("ImageRating", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: hre.network.name === "sepolia" ? 6 : 1,
  });

  console.log("ImageRating deployed to:", imageRating.address);

  // Verify contract on Etherscan if on Sepolia
  if (hre.network.name === "sepolia" && process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute

    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: imageRating.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

export default deployImageRating;
deployImageRating.tags = ["ImageRating"];

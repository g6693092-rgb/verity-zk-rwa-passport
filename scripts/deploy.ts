import { ethers } from 'hardhat';

async function main() {
  console.log('Deploying RootRegistry...');
  const RootRegistry = await ethers.getContractFactory('RootRegistry');

  // If using a network configured with hardhat, the first signer will be the deployer
  const deployer = (await ethers.getSigners())[0];
  console.log('Deployer address:', deployer.address);

  const contract = await RootRegistry.deploy();
  await contract.deployed();

  console.log('RootRegistry deployed at:', contract.address);
  console.log('To verify anchor status, set ROOT_REGISTRY to this address in your env and run the verifier script.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

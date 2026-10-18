require('@nomiclabs/hardhat-ethers');
require('dotenv').config();

module.exports = {
  solidity: '0.8.17',
  networks: {
    vechainTestnet: {
      url: process.env.VECHAIN_TESTNET_RPC || 'https://rpc-testnet.vechain.energy',
      chainId: 100010,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    vechainMainnet: {
      url: process.env.VECHAIN_MAINNET_RPC || 'https://rpc-mainnet.vechain.energy',
      chainId: 100009,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

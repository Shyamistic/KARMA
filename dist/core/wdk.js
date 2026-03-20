"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KarmaWallet = void 0;
exports.getWallet = getWallet;
const wdk_wallet_evm_1 = __importDefault(require("@tetherto/wdk-wallet-evm"));
const ethers_1 = require("ethers");
const config_1 = require("../lib/config");
const USDT = {
    arbitrum: ['0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'],
    arbitrum_sepolia: ['0x51ed00f93Eda4A08Ee90C38fEda23A84949aAbeC'],
    sepolia: [
        '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Tether Official
        '0xb38e0ba5aea889652b64ad38d624848896dcb089', // Bitaps Faucet USDT
        '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' // Circle USDC (Reliable Backup)
    ],
};
const CHAIN_CONFIG = {
    arbitrum_sepolia: {
        chainId: 421614,
        provider: 'https://sepolia-rollup.arbitrum.io/rpc',
    },
    arbitrum: {
        chainId: 42161,
        provider: 'https://arb1.arbitrum.io/rpc',
    },
    sepolia: {
        chainId: 11155111,
        provider: 'https://ethereum-sepolia.publicnode.com',
    }
};
class KarmaWallet {
    wallet = null;
    account = null;
    address = '';
    async init() {
        const chainConfig = CHAIN_CONFIG[config_1.config.WDK_CHAIN];
        this.wallet = new wdk_wallet_evm_1.default(config_1.config.WDK_SEED_PHRASE, chainConfig);
        this.account = await this.wallet.getAccount(0);
        this.address = await this.account.getAddress();
        console.log(`[WDK] Karma EOA wallet: ${this.address} on ${config_1.config.WDK_CHAIN}`);
    }
    async getAddress() { return this.address; }
    async getTokenBalance() {
        try {
            const addresses = USDT[config_1.config.WDK_CHAIN] || USDT.sepolia;
            let totalRaw = 0n;
            for (const addr of addresses) {
                try {
                    const raw = await this.account.getTokenBalance(ethers_1.ethers.getAddress(addr));
                    totalRaw += BigInt(raw);
                }
                catch { }
            }
            return (Number(totalRaw) / 1_000_000).toFixed(2);
        }
        catch (err) {
            return '0.00';
        }
    }
    async getEthBalance() {
        try {
            const balance = await this.account.getBalance();
            return ethers_1.ethers.formatEther(balance);
        }
        catch {
            return '0.0000';
        }
    }
    async sendToken(to, amount) {
        const addresses = USDT[config_1.config.WDK_CHAIN] || USDT.sepolia;
        const tokenAddress = addresses[0];
        const amountUnits = Math.floor(amount * 1_000_000).toString();
        // Check ETH balance for gas
        const balance = await this.account.getBalance();
        if (BigInt(balance) === 0n) {
            const faucet = config_1.config.WDK_CHAIN === 'arbitrum_sepolia'
                ? ' (Get some from: https://www.alchemy.com/faucets/arbitrum-sepolia)'
                : '';
            throw new Error(`Insufficient ETH for gas on ${config_1.config.WDK_CHAIN}. Please fund ${this.address}${faucet}`);
        }
        const tx = await this.account.transfer({
            token: tokenAddress,
            recipient: to,
            amount: BigInt(amountUnits)
        });
        return tx.hash || tx.transactionHash || String(tx);
    }
    getExplorerUrl(txHash) {
        const base = config_1.config.WDK_CHAIN === 'arbitrum'
            ? 'https://arbiscan.io/tx/'
            : config_1.config.WDK_CHAIN === 'sepolia'
                ? 'https://sepolia.etherscan.io/tx/'
                : 'https://sepolia.arbiscan.io/tx/';
        return base + txHash;
    }
}
exports.KarmaWallet = KarmaWallet;
let instance = null;
async function getWallet() {
    if (!instance) {
        instance = new KarmaWallet();
        await instance.init();
    }
    return instance;
}

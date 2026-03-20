# Karma

Autonomous USDT Reward Agent built on Tether WDK.

Karma evaluates open source contributions on GitHub to determine their value across four dimensions (Technical Complexity, Impact, Effort, Community Reception) and sends an instantaneous USDT tip link to the contributor. 

No wallet address needed upfront; the contributor connects their EVM wallet on the claim link to receive funds via ERC-4337 gasless transfer.

## Tech Stack
- Express.js (Node.js/TypeScript)
- Anthropic Claude 3.5 Sonnet
- Tether WDK (Wallet-EVM-ERC-4337)
- Better SQLite3

## Getting Started

1. Set up the repo:
   ```bash
   npm install
   ```

2. Generate your WDK Seed Phrase:
   ```bash
   node -e "const WDK = require('@tetherto/wdk'); console.log(WDK.getRandomSeedPhrase(24))"
   ```

3. Rename `.env.example` to `.env` and fill in:
   - Your Anthropic API key
   - WDK seed phrase
   - GitHub Token

4. Start the development server:
   ```bash
   npm run dev
   ```

## Workflow
A GitHub webhook configured to hit `/webhook/github` triggers Karma on PR merges. Karma will then process the contribution and act autonomously. You can view progress at `localhost:3000`.

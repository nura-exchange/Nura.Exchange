import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import {
  mainnet, base, arbitrum, optimism, bsc, polygon,
  unichain, linea, zksync, scroll, blast, ink, worldchain, soneium, abstract, mode,
} from 'viem/chains'

export const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['/api/rpc'] },
    public: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
  testnet: false,
}

export const NATIVE = '0x0000000000000000000000000000000000000000'
export const USDG_ADDRESS = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'
export const WETH_ADDRESS = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'
export const EXPLORER = 'https://robinhoodchain.blockscout.com'
export const txUrl = (hash) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (addr) => `${EXPLORER}/address/${addr}`

// Where money can come from — Robinhood Chain first (chain list modeled on Quoro, MIT).
const src = (key, chain, name, rpcUrl, explorer, native = 'ETH') => ({ key, chain, name, rpc: rpcUrl, explorer, native })

export const SOURCE_CHAINS = [
  src('ethereum', mainnet, 'Ethereum', 'https://ethereum-rpc.publicnode.com', 'https://etherscan.io'),
  src('base', base, 'Base', 'https://base-rpc.publicnode.com', 'https://basescan.org'),
  src('arbitrum', arbitrum, 'Arbitrum', 'https://arbitrum-one-rpc.publicnode.com', 'https://arbiscan.io'),
  src('optimism', optimism, 'Optimism', 'https://optimism-rpc.publicnode.com', 'https://optimistic.etherscan.io'),
  src('bnb', bsc, 'BNB Chain', 'https://bsc-rpc.publicnode.com', 'https://bscscan.com', 'BNB'),
  src('polygon', polygon, 'Polygon', 'https://polygon-bor-rpc.publicnode.com', 'https://polygonscan.com', 'POL'),
  src('unichain', unichain, 'Unichain', 'https://unichain-rpc.publicnode.com', 'https://uniscan.xyz'),
  src('linea', linea, 'Linea', 'https://linea-rpc.publicnode.com', 'https://lineascan.build'),
  src('zksync', zksync, 'ZKsync', 'https://mainnet.era.zksync.io', 'https://explorer.zksync.io'),
  src('scroll', scroll, 'Scroll', 'https://scroll-rpc.publicnode.com', 'https://scrollscan.com'),
  src('blast', blast, 'Blast', 'https://blast-rpc.publicnode.com', 'https://blastscan.io'),
  src('ink', ink, 'Ink', 'https://rpc-gel.inkonchain.com', 'https://explorer.inkonchain.com'),
  src('worldchain', worldchain, 'World Chain', 'https://worldchain-mainnet.g.alchemy.com/public', 'https://worldscan.org'),
  src('soneium', soneium, 'Soneium', 'https://rpc.soneium.org', 'https://soneium.blockscout.com'),
  src('abstract', abstract, 'Abstract', 'https://api.mainnet.abs.xyz', 'https://abscan.org'),
  src('mode', mode, 'Mode', 'https://mainnet.mode.network', 'https://modescan.io'),
]

export const ALL_CHAINS = [robinhoodChain, ...SOURCE_CHAINS.map(s => s.chain)]

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const transports = {
  [robinhoodChain.id]: http('/api/rpc'),
  ...Object.fromEntries(SOURCE_CHAINS.map(s => [s.chain.id, http(s.rpc)])),
}

export const config = getDefaultConfig({
  appName: 'Nura Exchange',
  projectId: walletConnectProjectId || '00000000000000000000000000000000',
  chains: ALL_CHAINS,
  transports,
})

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

// up. — native ve(3,3) DEX on Robinhood Chain (Aerodrome fork): v2 AMM + Slipstream CLAMM.
export const UP_TOKEN_ADDRESS = '0x57C0E45cB534413D1C20A4240955d6bB250BB4F1'
export const UP = {
  v2Factory: '0xFA5429AEBa338BEa2BFcc1b9a889862Ee395bc28',
  v2Router: '0xf5198743240fAC98db71868F34c70139b1eb0474',
  clFactory: '0x1ac9dB4a2608ba45D6127B1737949b51Bb54B7F3',
  swapRouter: '0xC062b870E813fcA720f1e002c234369Ab3aB9415',
  quoterV2: '0x03983AB2C057a2eac211ff01738a1e49ff325B49',
}
export const UP_SUBGRAPHS = {
  v2: 'https://api.goldsky.com/api/public/project_cmhef02640198x7p2cz2w70u8/subgraphs/up-robinhood-v2-mainnet/0.1.0/gn',
  v3: 'https://api.goldsky.com/api/public/project_cmhef02640198x7p2cz2w70u8/subgraphs/up-robinhood-v3-mainnet/0.1.1/gn',
}
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

// Chainlink price feeds on Robinhood Chain (chain 4663).
// Source: Chainlink's feed list for Robinhood Chain, addresses cross-checked
// on-chain (symbol() + latestRoundData) — the same verified set Prix publishes
// under MIT. Feed decimals are 8 for every entry.
export const CHAINLINK_FEEDS = [
  { symbol: 'AAPL', token: '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9', feed: '0x6b22a786baa607d76728168703a39ea9c99f2cd0' },
  { symbol: 'AMD', token: '0x86923f96303d656e4aa86d9d42d1e57ad2023fdc', feed: '0x943a29e7ae51a4798823ca9eed2ed533b2a22c72' },
  { symbol: 'AMZN', token: '0x12f190a9f9d7d37a250758b26824b97ce941bf54', feed: '0xd5a1508ced74c084ebf3cbe853e2c968fb2a651c' },
  { symbol: 'COIN', token: '0x6330d8c3178a418788df01a47479c0ce7ccf450b', feed: '0xa3a468a452940b7d6b69991207b508c609a98ef2' },
  { symbol: 'CRCL', token: '0xdf0992e440dd0be65bd8439b609d6d4366bf1cb5', feed: '0x6652edf64ba3731c4f2d3ce821a0fb1f1f6b482a' },
  { symbol: 'GME', token: '0x1b0e319c6a659f002271b69db8a7df2f911c153e', feed: '0x27c71df6a64fb476468edf256cf72c038bab5b67' },
  { symbol: 'GOOGL', token: '0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3', feed: '0xf6f373a037c30f0e5010d854385ca89185ae638b' },
  { symbol: 'INTC', token: '0xc72b96e0e48ecd4dc75e1e45396e26300bc39681', feed: '0x3f390c5c24628ac7c489515402235fead71d1913' },
  { symbol: 'META', token: '0xc0d6457c16cc70d6790dd43521c899c87ce02f35', feed: '0x7c38c00c30bee9378381e7b6135d7283356d71b1' },
  { symbol: 'MSFT', token: '0xe93237c50d904957cf27e7b1133b510c669c2e74', feed: '0x45c3c877c15e6ba2ebb19ea114ea508d14c1af2e' },
  { symbol: 'MSTR', token: '0xec262a75e413fafd0df80480274532c79d42da09', feed: '0x396118bdfb181e6240e74d243f266b061c0edc3d' },
  { symbol: 'MU', token: '0xff080c8ce2e5feadaca0da81314ae59d232d4afd', feed: '0x425eefdcf05ed6526c3ce61af99429a228a6d596' },
  { symbol: 'NVDA', token: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec', feed: '0x379ec4f7c378f34a1b47e4f3cbebcbac3e8e9f15' },
  { symbol: 'PLTR', token: '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a', feed: '0x820abedff239034956b7a9d2f0a331f9f075eb4c' },
  { symbol: 'QQQ', token: '0xd5f3879160bc7c32ebb4dc785f8a4f505888de68', feed: '0x80901d846d5d7b030f26b480776ee3b29374c2ae' },
  { symbol: 'SGOV', token: '0x92fd66527192e3e61d4ddd13322aa222de86f9b5', feed: '0xa0df4ee0fff975306345875e3548fcc519577a11' },
  { symbol: 'SPCX', token: '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea', feed: '0xb265810950ba6c5c0ff821c9963014a56fd8bffb' },
  { symbol: 'SPY', token: '0x117cc2133c37b721f49de2a7a74833232b3b4c0c', feed: '0x319724394d3a0e3669269846abe664cd621f9f6a' },
  { symbol: 'TSLA', token: '0x322f0929c4625ed5bad873c95208d54e1c003b2d', feed: '0x4a1166a659a55625345e9515b32adecea5547c38' },
  { symbol: 'USO', token: '0xa30fa36db767ad9ed3f7a60fc79526fb4d56d344', feed: '0x75a9c76ef439e2c7c2e5a34ab105ecfe3766431c' },
  { symbol: 'BTC', token: null, feed: '0xa2c5184bf03d373dc9de4876eb4bce595b460251' },
  { symbol: 'ETH', token: null, feed: '0x78f3556b67e17df817d51ef5a990cdaf09e8d3a9' },
]

export const FEED_DECIMALS = 8

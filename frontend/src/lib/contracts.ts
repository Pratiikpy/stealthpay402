// Contract addresses by chain ID
export const CONTRACT_ADDRESSES: Record<number, Record<string, string>> = {
  // Polygon Amoy Testnet
  80002: {
    USDC: "0x6a06aeD671156A3C133AAe0EEc7f93f679a3eC4c",
    StealthAnnouncer: "0x2314F19Bc7Fc8e3cAFEC8D8bC157402b0DF8025C",
    StealthMetaRegistry: "0x9d0cDD13239b8ce12A8F07e62315aBd96605127a",
    FeeVault: "0x5e41d2A5F67bCaaf187FFF5E727790e60B93AEe4",
    AgentRegistry: "0x7F657448444456e8E878f8575822ef7268d6b5e3",
    ComplianceGate: "0x0C3F48c3e863f13b9F7e1dEF0F77A94a073b2D0F",
    StealthPaymentRouter: "0x505285860b5ECdAb4aaf1EB822e1c1FFb3836729",
    CrossChainRouter: "0x8ACB1d549915eE2d5eAcb844d971C58767590833",
  },
  // Polygon Mainnet
  137: {
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    StealthAnnouncer: "",
    StealthMetaRegistry: "",
    FeeVault: "",
    AgentRegistry: "",
    ComplianceGate: "",
    StealthPaymentRouter: "",
  },
};

export const ROUTER_ABI = [
  "function processPayment(tuple(address from, uint256 amount, bytes32 nonce, uint256 validAfter, uint256 validBefore, address stealthAddress, bytes ephemeralPubKey, uint8 viewTag, bytes signature) params) external",
  "function platformFeeBps() view returns (uint256)",
  "function processed(bytes32) view returns (bool)",
  "event PaymentProcessed(address indexed from, address indexed stealthAddress, uint256 amount, uint256 fee, bytes32 nonce)",
];

export const ANNOUNCER_ABI = [
  "event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)",
  "function announcementCount() view returns (uint256)",
];

export const AGENT_REGISTRY_ABI = [
  "function registerAgent(bytes32 metadataHash) payable external",
  "function getAgent(address agent) view returns (tuple(address owner, bytes32 metadataHash, uint256 dailySpendLimit, uint256 spentToday, uint256 lastResetTimestamp, uint256 reputationScore, uint256 totalTransactions, uint256 totalVolume, bool isActive, uint256 registeredAt))",
  "function isRegistered(address agent) view returns (bool)",
  "function totalAgents() view returns (uint256)",
  "event AgentRegistered(address indexed agent, bytes32 metadataHash)",
];

export const META_REGISTRY_ABI = [
  "function registerKeys(uint256 schemeId, bytes stealthMetaAddress) external",
  "function stealthMetaAddressOf(address registrant, uint256 schemeId) view returns (bytes)",
];

export const FEE_VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
  "function treasury() view returns (address)",
];

export const MOCK_USDC_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

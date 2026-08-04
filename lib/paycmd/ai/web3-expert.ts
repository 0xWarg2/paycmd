import type { KnowledgeRoute, KnowledgeTopic } from "./knowledge-types.ts";

const PAYNA_PATTERN = /\b(?:hey\s*payna|payna|paycmd|ask\s*payna|askpayna)\b/i;
const CIRCLE_PATTERN = /\b(?:circle|cctp|gateway|circle\s+wallets?|programmable\s+wallets?|circle\s+mint|eurc|usyc)\b/i;
const ARC_PATTERN = /\b(?:arc(?:\s+(?:network|chain|blockchain|testnet|mainnet|rpc|scan))?|arcscan)\b/i;
const WEB3_PATTERN = /\b(?:web3|blockchain|crypto|bitcoin|btc|ethereum|eth|solana|monad|sui|aptos|avalanche|cosmos|polygon|arbitrum|optimism|base|bnb|cardano|near|tron|ton|hyperliquid|l1|l2|layer\s*[12]|evm|rollups?|consensus|defi|dex|amm|token|stablecoin|smart\s+contracts?|bridges?|gas|staking|tvl|airdrops?|protocols?|pectra)\b/i;
const LIVE_PATTERN = /\b(?:latest|newest|current|currently|today|news|recent|price|market|hôm\s+nay|mới\s+nhất|hiện\s+tại|tin\s+mới|giá)\b/i;
const SECRET_PATTERN = /\b(?:seed\s+phrase|mnemonic|private\s+key|recovery\s+phrase|cụm\s+từ\s+khôi\s+phục|khóa\s+riêng|khoá\s+riêng)\b/i;
const TX_HASH_PATTERN = /\b0x[a-fA-F0-9]{64}\b/g;
const WALLET_ADDRESS_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;

export function classifyKnowledgeRequest(input: string): KnowledgeRoute {
  const topics: KnowledgeTopic[] = [];
  const hasPayna = PAYNA_PATTERN.test(input);
  const hasCircle = CIRCLE_PATTERN.test(input);
  const hasArc = ARC_PATTERN.test(input);
  const hasWeb3 = WEB3_PATTERN.test(input);
  const live = LIVE_PATTERN.test(input);

  if (hasPayna) topics.push("payna");
  if (hasCircle) topics.push("circle");
  if (hasArc) topics.push("arc");

  // Circle and Arc already have official specialist sources. Tavily is added only when the
  // question also names a broader chain/topic, or when neither specialist route applies.
  if (hasWeb3 && (!hasCircle && !hasArc || /\b(?:ethereum|solana|bitcoin|btc|eth|l1|l2|layer\s*[12]|rollups?|defi|dex|tvl|pectra)\b/i.test(input))) {
    topics.push("web3");
  }
  if (live && (hasWeb3 || hasCircle || hasArc)) topics.push("live");

  return { topics, requiresKnowledge: topics.length > 0, live: topics.includes("live") };
}

export function buildSafeSearchQuery(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (SECRET_PATTERN.test(normalized)) return { query: "", blocked: true, redacted: false };

  let redacted = false;
  const query = normalized
    .replace(TX_HASH_PATTERN, () => {
      redacted = true;
      return "[transaction-hash]";
    })
    .replace(WALLET_ADDRESS_PATTERN, () => {
      redacted = true;
      return "[wallet-address]";
    })
    .slice(0, 400);

  return { query, blocked: false, redacted };
}

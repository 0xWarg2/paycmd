export type KnowledgeTopic = "payna" | "circle" | "arc" | "web3" | "live";
export type KnowledgeSource = "payna" | "circle" | "arc" | "web";
export type GroundingStatus = "verified" | "partial" | "unavailable" | "not_applicable";
export type WalletContextStatus = "verified" | "partial" | "unavailable";

export type KnowledgeRoute = {
  topics: KnowledgeTopic[];
  requiresKnowledge: boolean;
  live: boolean;
};

export type GroundedDocument = {
  source: KnowledgeSource;
  title: string;
  url?: string;
  content: string;
  score?: number;
  publishedAt?: string;
};

export type GroundedCitation = {
  title?: string;
  url?: string;
  source?: KnowledgeSource;
  publishedAt?: string;
};

export type SourceRetrieval = {
  source: KnowledgeSource;
  documents: GroundedDocument[];
  available: boolean;
  error?: "not_configured" | "blocked" | "timeout" | "rate_limited" | "unauthorized" | "upstream";
};

export type KnowledgeBundle = {
  route: KnowledgeRoute;
  documents: GroundedDocument[];
  citations: GroundedCitation[];
  sources: KnowledgeSource[];
  status: GroundingStatus;
};

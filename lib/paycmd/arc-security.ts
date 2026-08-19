import { isAddress, type Address, type PublicClient } from "viem";

import { arcPublicClient, ARC_TESTNET_CHAIN_ID } from "./arc-rpc.ts";
import { web3Chains } from "./web3-chains.ts";

const arcUsdcBlocklistAbi = [{
  type: "function",
  name: "isBlacklisted",
  stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "bool" }],
}] as const;

export class ArcAddressSafetyError extends Error {
  readonly code: "ARC_ADDRESS_BLOCKLISTED" | "ARC_BLOCKLIST_CHECK_UNAVAILABLE";
  readonly status: number;

  constructor(
    code: "ARC_ADDRESS_BLOCKLISTED" | "ARC_BLOCKLIST_CHECK_UNAVAILABLE",
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "ArcAddressSafetyError";
    this.code = code;
    this.status = status;
  }
}

type ArcSafetyClient = Pick<PublicClient, "getChainId" | "readContract">;

export async function assertArcAddressTransferable(
  value: string,
  client: ArcSafetyClient = arcPublicClient,
) {
  if (!isAddress(value)) {
    throw new ArcAddressSafetyError(
      "ARC_BLOCKLIST_CHECK_UNAVAILABLE",
      "Arc recipient is not a valid EVM address.",
      400,
    );
  }

  try {
    const chainId = await client.getChainId();
    if (chainId !== ARC_TESTNET_CHAIN_ID) {
      throw new Error(`Arc RPC returned chain ID ${chainId}; expected ${ARC_TESTNET_CHAIN_ID}.`);
    }
    const blocked = await client.readContract({
      address: web3Chains.arcTestnet.usdcAddress,
      abi: arcUsdcBlocklistAbi,
      functionName: "isBlacklisted",
      args: [value as Address],
    });
    if (blocked) {
      throw new ArcAddressSafetyError(
        "ARC_ADDRESS_BLOCKLISTED",
        "The destination address is blocked by Arc USDC and cannot receive this transfer.",
        422,
      );
    }
  } catch (error) {
    if (error instanceof ArcAddressSafetyError) throw error;
    throw new ArcAddressSafetyError(
      "ARC_BLOCKLIST_CHECK_UNAVAILABLE",
      `HeyPayna could not verify the Arc USDC blocklist: ${error instanceof Error ? error.message : "unknown error"}`,
      503,
    );
  }
}

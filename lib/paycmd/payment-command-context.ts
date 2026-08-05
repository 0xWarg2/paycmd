import { chainCommandAlias, type PayCmdChain } from "./chains.ts";
import {
  parsePayCmd,
  type CommandLocale,
  type ParsedCommand,
} from "./commands.ts";

type RecentMessage = {
  role: string;
  text: string;
};

export function paymentWaitingForChains(
  input: string,
  locale: CommandLocale = "en",
): ParsedCommand | null {
  const draft = parsePayCmd(input, locale);
  if (
    draft.command !== "pay" ||
    !draft.fields.amount ||
    !draft.fields.recipient ||
    !draft.missingFields.includes("sourceChain") ||
    !draft.missingFields.includes("destinationChain")
  ) {
    return null;
  }
  return draft;
}

export function completePaymentChainFollowUp(
  input: string,
  recentMessages: RecentMessage[],
  locale: CommandLocale = "en",
): ParsedCommand | null {
  const chainReply = parsePayCmd(`/transfer 1 ${input}`, locale);
  const sourceChain = chainReply.fields.sourceChain as PayCmdChain | undefined;
  const destinationChain = chainReply.fields.destinationChain as PayCmdChain | undefined;
  if (!sourceChain || !destinationChain) return null;

  const pendingPay = [...recentMessages]
    .reverse()
    .filter((message) => message.role === "user" && message.text.trim() !== input.trim())
    .map((message) => parsePayCmd(message.text, locale))
    .find(
      (draft) =>
        draft.command === "pay" &&
        Boolean(draft.fields.amount) &&
        Boolean(draft.fields.recipient) &&
        draft.missingFields.some((field) => field === "sourceChain" || field === "destinationChain"),
    );

  if (!pendingPay) return null;

  const manualSuffix = pendingPay.fields.mintGasMode === "manual" ? " manual" : "";
  return parsePayCmd(
    `/pay ${pendingPay.fields.amount} to ${pendingPay.fields.recipient} on ${chainCommandAlias(destinationChain)} from ${chainCommandAlias(sourceChain)}${manualSuffix}`,
    locale,
  );
}

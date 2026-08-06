import { notFound } from "next/navigation";

import { UnifiedGatewaySourceSelectorPreview } from "@/components/unified-gateway-source-selector-preview";

export default async function UnifiedGatewayPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ delegate?: string }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.PAYNA_UI_FIXTURE !== "1") {
    notFound();
  }

  const params = await searchParams;
  return <UnifiedGatewaySourceSelectorPreview delegateRequired={params.delegate === "1"} />;
}

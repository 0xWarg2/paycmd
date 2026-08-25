import { notFound } from "next/navigation";

import { PendingDepositsPreview } from "./preview";

// The gate stays in the server component: `PAYNA_UI_FIXTURE` is not a NEXT_PUBLIC_ var, so it
// reads as undefined inside a client component and the fixture would 404 everywhere.
export default function PendingDepositsPreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.PAYNA_UI_FIXTURE !== "1") {
    notFound();
  }

  return <PendingDepositsPreview />;
}

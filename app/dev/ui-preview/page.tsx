import { notFound } from "next/navigation";

import { CommandCenterPreview } from "@/components/paycmd/command-center-preview";

export default function UiPreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.PAYNA_UI_FIXTURE !== "1") {
    notFound();
  }

  return <CommandCenterPreview />;
}

import { LandingPage } from "@/components/landing-page";
import { PublicPlatformMetrics } from "@/components/public-platform-metrics";

export default function Home() {
  return <LandingPage metricsSlot={<PublicPlatformMetrics />} />;
}

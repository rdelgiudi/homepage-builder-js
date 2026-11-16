import SitePage from "@/components/SitePage";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Home() {
  return <SitePage config={getConfig()} preview={false} />;
}

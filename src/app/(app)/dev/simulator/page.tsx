import { notFound } from "next/navigation";
import { SimulatorTool } from "@/components/dev/SimulatorTool";
import { simulatorEnabled } from "@/server/channels/registry";

export const dynamic = "force-dynamic";

/** Công cụ giả lập khách nhắn tin (chỉ khi ENABLE_SIMULATOR=true). */
export default function SimulatorPage() {
  if (!simulatorEnabled()) notFound();
  return <SimulatorTool />;
}

import { Suspense } from "react";
import { ChannelsSettings } from "@/components/settings/ChannelsSettings";

export default function ChannelsPage() {
  return (
    <Suspense>
      <ChannelsSettings />
    </Suspense>
  );
}

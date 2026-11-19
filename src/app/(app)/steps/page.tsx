import { QaPanel } from "@/components/steps/QaPanel";
import { StepsPage } from "@/components/steps/StepsPage";

export default function Page() {
  return <StepsPage qa={<QaPanel />} />;
}

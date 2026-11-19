import type { PlatformKey } from "./platforms";
import type { StepKey } from "./steps";
import type { StudentStatus, UserRef } from "./types";

export type StudentSummary = {
  id: string;
  name: string;
  source: string | null;
  avatarUrl: string | null;
  note: string | null;
  status: StudentStatus;
  statusSource: "auto" | "manual";
  autoCreated: boolean;
  lastActivityAt: string;
  stepsDone: number;
  trial: { date: string; slot: string } | null;
  classSlotCount: number;
};

export type StudentDetail = StudentSummary & {
  steps: {
    step: StepKey;
    label: string;
    done: boolean;
    doneBy: UserRef | null;
    doneAt: string | null;
  }[];
  classSlots: { weekday: number; slot: string }[];
  conversations: { id: string; customerName: string; platform: PlatformKey }[];
};

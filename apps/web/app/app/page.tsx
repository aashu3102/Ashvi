import { AshviShell } from "@/components/ashvi/layout/AshviShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ashvi — Living Intelligence Workspace",
  description: "Personal intelligence system workspace",
};

export default function AppPage() {
  return <AshviShell />;
}

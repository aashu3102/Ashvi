import { AuthGate } from "@/components/auth-gate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ashvi — Living Intelligence Workspace",
  description: "Personal intelligence system workspace",
};

export default function AppPage() {
  return <AuthGate />;
}

import type { Metadata } from "next";
import { AuthenticationPage } from "@/components/auth/AuthenticationPage";

export const metadata: Metadata = {
  title: "Ashvi — Private Entrance",
  description: "Private Intelligence System Secure Access",
};

export default function AuthRoutePage() {
  return <AuthenticationPage />;
}

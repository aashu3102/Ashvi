import { proxyToAshviCore } from "@/lib/ashvi-core-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return proxyToAshviCore(request, "/health");
}

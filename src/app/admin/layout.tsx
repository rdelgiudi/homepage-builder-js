import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminEnabled } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site admin",
  robots: { index: false, follow: false },
};

/** Guard for everything under /admin: the panel in `(panel)/` and the draft preview in `preview/`. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Without an admin password (or with APP_ROLE=public) none of it exists.
  if (!adminEnabled()) notFound();
  return children;
}

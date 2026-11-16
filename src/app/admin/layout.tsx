import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminEnabled } from "@/lib/admin/auth";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Without an admin password (or with APP_ROLE=public) the panel does not exist.
  if (!adminEnabled()) notFound();
  return <div className="adm">{children}</div>;
}

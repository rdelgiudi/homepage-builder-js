import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin/auth";
import AdminApp from "@/components/admin/AdminApp";

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");
  return <AdminApp />;
}

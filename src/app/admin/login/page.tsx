import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin/auth";
import LoginForm from "@/components/admin/LoginForm";

export default async function LoginPage() {
  if (await isAdminSession()) redirect("/admin");
  return <LoginForm />;
}

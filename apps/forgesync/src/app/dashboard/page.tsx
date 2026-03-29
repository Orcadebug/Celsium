import { getSupabase } from "../api/agent/_supabase";
import { DashboardHome } from "./_components/dashboard-home";
import { getSessionUser } from "@/lib/session-user";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const db = getSupabase();
  const { data: projects } = await db
    .from("projects")
    .select("id, name, repo_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <DashboardHome email={user.email} appUrl={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"} initialProjects={projects || []} />;
}

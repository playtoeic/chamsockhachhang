import { redirect } from "next/navigation";
import { ChannelAlert } from "@/components/ChannelAlert";
import { Nav } from "@/components/Nav";
import { UserProvider } from "@/components/UserContext";
import { signOut } from "@/server/auth/config";
import { getCurrentUser } from "@/server/auth/current";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <UserProvider user={user}>
      <div className="app">
        <Nav logout={logout} />
        <ChannelAlert />
        <main className="main">{children}</main>
      </div>
    </UserProvider>
  );
}

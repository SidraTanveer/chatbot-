"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bot, LoaderCircle, MessageSquare, RefreshCw, Users } from "lucide-react";
import Link from "next/link";

type AdminData = {
  stats: { users: number; conversations: number; messages: number };
  conversations: Array<{
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
    email: string | null;
    message_count: number;
  }>;
  users: Array<{
    id: string;
    email: string | null;
    display_name: string | null;
    preferred_tone: string;
    preferred_style: string;
    updated_at: string;
  }>;
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchDashboard() {
    const response = await fetch("/api/admin", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load admin dashboard.");
    return result as AdminData;
  }

  async function refreshDashboard() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboard());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load admin dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-dvh bg-[#f7f7f5] px-4 py-6 text-[#252525] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-[#777770] hover:text-[#252525]">
              <ArrowLeft size={16} /> Back to chat
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">Admin dashboard</h1>
            <p className="mt-1 text-sm text-[#777770]">Users and conversation activity</p>
          </div>
          <button onClick={() => void refreshDashboard()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:border-black/20 disabled:opacity-50">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </header>

        {loading && !data ? (
          <div className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#777770]">
            <LoaderCircle size={18} className="animate-spin" /> Loading dashboard…
          </div>
        ) : error ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold">Dashboard unavailable</h2>
            <p className="mt-2 text-sm text-amber-900">{error}</p>
            {error.includes("ADMIN_EMAIL") && (
              <p className="mt-3 text-sm text-amber-900">
                Add <code>ADMIN_EMAIL=your-signup-email</code> to <code>.env.local</code>, restart the dev server, then sign in with that account.
              </p>
            )}
          </section>
        ) : data ? (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Users", value: data.stats.users, icon: Users },
                { label: "Conversations", value: data.stats.conversations, icon: MessageSquare },
                { label: "Messages", value: data.stats.messages, icon: Bot },
              ].map(({ label, value, icon: Icon }) => (
                <article key={label} className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-sm text-[#777770]">
                    {label}<Icon size={18} />
                  </div>
                  <p className="mt-3 text-3xl font-semibold">{value.toLocaleString()}</p>
                </article>
              ))}
            </section>

            <section className="mb-8 overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
              <div className="border-b border-black/[0.06] px-5 py-4">
                <h2 className="font-semibold">Recent conversations</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#f7f7f5] text-xs uppercase tracking-wide text-[#777770]">
                    <tr><th className="px-5 py-3">Title</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Messages</th><th className="px-5 py-3">Last activity</th></tr>
                  </thead>
                  <tbody>
                    {data.conversations.map((conversation) => (
                      <tr key={conversation.id} className="border-t border-black/[0.05]">
                        <td className="max-w-[360px] truncate px-5 py-3">{conversation.title || "New conversation"}</td>
                        <td className="px-5 py-3 text-[#666660]">{conversation.email || "Anonymous"}</td>
                        <td className="px-5 py-3">{Number(conversation.message_count)}</td>
                        <td className="px-5 py-3 text-[#777770]">{new Date(conversation.updated_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {data.conversations.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-[#777770]">No conversations yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
              <div className="border-b border-black/[0.06] px-5 py-4">
                <h2 className="font-semibold">Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#f7f7f5] text-xs uppercase tracking-wide text-[#777770]">
                    <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Tone</th><th className="px-5 py-3">Style</th><th className="px-5 py-3">Updated</th></tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.id} className="border-t border-black/[0.05]">
                        <td className="px-5 py-3">{user.display_name || "—"}</td>
                        <td className="px-5 py-3 text-[#666660]">{user.email || "Anonymous"}</td>
                        <td className="px-5 py-3">{user.preferred_tone}</td>
                        <td className="px-5 py-3">{user.preferred_style}</td>
                        <td className="px-5 py-3 text-[#777770]">{new Date(user.updated_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {data.users.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#777770]">No users yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

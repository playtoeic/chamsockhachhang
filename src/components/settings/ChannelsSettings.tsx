"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { useEvents } from "@/lib/use-events";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";

type Connection = {
  id: string;
  platform: PlatformKey;
  displayName: string;
  status: "connected" | "disconnected";
  lastError: string | null;
  connectedAt: string;
};

type Data = { platforms: { platform: PlatformKey; label: string }[]; items: Connection[] };

export function ChannelsSettings() {
  const { data, reload } = useData<Data>("/api/channels");
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  useEvents({ "channel.updated": reload }, reload);

  const connect = async (platform: PlatformKey) => {
    setError(null);
    try {
      const { redirectUrl } = await api<{ redirectUrl: string }>(
        `/api/channels/${platform}/connect`,
        { method: "POST" },
      );
      window.location.assign(redirectUrl);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const disconnect = async (c: Connection) => {
    if (!confirm(`Ngắt kết nối ${c.displayName}? Lịch sử tin nhắn vẫn được giữ lại.`)) return;
    try {
      await api(`/api/channels/${c.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!data) return <p className="muted">Đang tải…</p>;

  return (
    <section className="panel pad" aria-label="Kênh nhắn tin">
      <h2>Kênh nhắn tin</h2>
      {params.get("error") && <p className="error">{params.get("error")}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Kênh</th>
            <th>Tài khoản</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.platforms.map(({ platform, label }) => {
            const conns = data.items.filter((c) => c.platform === platform);
            if (conns.length === 0)
              return (
                <tr key={platform}>
                  <td>{label}</td>
                  <td className="muted">Chưa kết nối</td>
                  <td />
                  <td>
                    <button
                      className="primary"
                      onClick={() => connect(platform)}
                      aria-label={`Kết nối ${label}`}
                    >
                      Kết nối
                    </button>
                  </td>
                </tr>
              );
            return conns.map((c) => (
              <tr key={c.id}>
                <td>{PLATFORMS[c.platform].label}</td>
                <td>{c.displayName}</td>
                <td>
                  {c.status === "connected" ? (
                    <span className="ok">Đang kết nối</span>
                  ) : (
                    <span className="error">
                      Mất kết nối{c.lastError ? `: ${c.lastError}` : ""}
                    </span>
                  )}
                </td>
                <td className="actions">
                  {c.status === "connected" ? (
                    <button className="danger" onClick={() => disconnect(c)}>
                      Ngắt kết nối
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => connect(c.platform)}
                      aria-label={`Kết nối lại ${label}`}
                    >
                      Kết nối lại
                    </button>
                  )}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </section>
  );
}

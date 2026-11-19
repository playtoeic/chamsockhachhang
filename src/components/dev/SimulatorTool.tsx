"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";

type State = {
  rejectWith: string | null;
  outbox: { threadId: string; text: string; messageId: string; at: string }[];
};

const REJECT_OPTIONS = [
  ["", "Không (gửi bình thường)"],
  ["window_expired", "Quá thời hạn trả lời"],
  ["disconnected", "Mất kết nối"],
  ["rate_limited", "Vượt hạn mức"],
  ["rejected", "Nền tảng từ chối"],
  ["unknown", "Lỗi khác"],
] as const;

export function SimulatorTool() {
  const { data: state, reload } = useData<State>("/api/dev/simulator");
  const [name, setName] = useState("Khách A");
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"text" | "image" | "video" | "sticker">("text");
  const [avatar, setAvatar] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>, done: string) => {
    setNotice(null);
    try {
      await api("/api/dev/simulator", { method: "POST", body });
      setNotice(done);
      reload();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  return (
    <div className="sim">
      <h1>Kênh giả lập</h1>
      <p className="muted">
        Chỉ dùng khi phát triển và test. Kết nối kênh &quot;Giả lập&quot; ở trang Kênh trước khi gửi tin.
      </p>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <section className="panel pad">
        <h2>Khách nhắn tin</h2>
        <label>
          Tên khách
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Kiểu tin
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="text">Văn bản</option>
            <option value="image">Ảnh</option>
            <option value="video">Video (không hiển thị được)</option>
            <option value="sticker">Sticker (không hiển thị được)</option>
          </select>
        </label>
        <label>
          Nội dung
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={avatar} onChange={(e) => setAvatar(e.target.checked)} />
          Khách có ảnh đại diện
        </label>
        <div className="row">
          <button
            className="primary"
            onClick={() => post({ action: "customerMessage", customerName: name, text, kind, avatar }, "Đã gửi tin của khách")}
          >
            Gửi tin của khách
          </button>
          <button
            onClick={() =>
              post({ action: "nativeReply", customerName: name, text }, "Đã gửi câu trả lời từ ứng dụng gốc")
            }
            disabled={!text.trim()}
          >
            Gửi câu trả lời từ ứng dụng gốc
          </button>
        </div>
      </section>

      <section className="panel pad">
        <h2>Khi website gửi trả lời</h2>
        <label>
          Từ chối tin gửi
          <select
            value={state?.rejectWith ?? ""}
            onChange={(e) =>
              post({ action: "settings", rejectWith: e.target.value || null }, "Đã lưu cài đặt giả lập")
            }
          >
            {REJECT_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <table className="table" aria-label="Hộp thư đi">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Cuộc trò chuyện</th>
              <th>Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {state?.outbox.map((m) => (
              <tr key={m.messageId}>
                <td>{new Date(m.at).toLocaleTimeString("vi-VN")}</td>
                <td>{m.threadId}</td>
                <td>{m.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

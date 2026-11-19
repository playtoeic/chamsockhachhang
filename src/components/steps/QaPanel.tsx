"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/components/UserContext";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { useEvents } from "@/lib/use-events";

type Entry = { id: string; question: string; answer: string; updatedAt: string };

/** Phần Q&A trong mục Các bước (FR-028): tìm, đọc, sao chép; chủ thêm, sửa, xoá. */
export function QaPanel() {
  const me = useCurrentUser();
  const isOwner = me.role === "owner";
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const [form, setForm] = useState({ question: "", answer: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data, reload } = useData<{ items: Entry[] }>(
    `/api/qa${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  );
  useEvents({ "qa.updated": reload }, reload);

  const copy = async (e: Entry) => {
    await navigator.clipboard.writeText(e.answer);
    setCopied(e.id);
    setTimeout(() => setCopied((c) => (c === e.id ? null : c)), 2000);
  };

  const startEdit = (e: Entry | "new") => {
    setError(null);
    setEditing(e);
    setForm(
      e === "new" ? { question: "", answer: "" } : { question: e.question, answer: e.answer },
    );
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    try {
      if (editing === "new") await api("/api/qa", { method: "POST", body: form });
      else if (editing) await api(`/api/qa/${editing.id}`, { method: "PATCH", body: form });
      setEditing(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (e: Entry) => {
    if (!confirm(`Xoá câu hỏi "${e.question}"?`)) return;
    try {
      await api(`/api/qa/${e.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel pad qa-panel" aria-label="Hỏi – đáp">
      <div className="row qa-head">
        <h2>Hỏi – đáp</h2>
        {isOwner && !editing && (
          <button type="button" className="primary" onClick={() => startEdit("new")}>
            + Thêm câu hỏi
          </button>
        )}
      </div>
      <input
        type="search"
        placeholder="Tìm theo từ khoá"
        aria-label="Tìm hỏi đáp"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {isOwner && editing && (
        <form className="edit-form qa-form" onSubmit={save}>
          <label className="field">
            Câu hỏi
            <input
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              required
            />
          </label>
          <label className="field">
            Câu trả lời mẫu
            <textarea
              rows={4}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              required
            />
          </label>
          <div className="row">
            <button className="primary" type="submit">
              Lưu
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              Huỷ
            </button>
          </div>
        </form>
      )}
      <ul className="qa-list">
        {data?.items.map((e) => (
          <li key={e.id} aria-label={e.question}>
            <strong>{e.question}</strong>
            <p className="qa-answer">{e.answer}</p>
            <div className="row">
              <button type="button" onClick={() => void copy(e)}>
                {copied === e.id ? "Đã sao chép" : "Sao chép câu trả lời"}
              </button>
              {isOwner && (
                <>
                  <button type="button" onClick={() => startEdit(e)}>
                    Sửa
                  </button>
                  <button type="button" className="danger" onClick={() => void remove(e)}>
                    Xoá
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {data && data.items.length === 0 && <li className="muted">Chưa có câu hỏi nào.</li>}
      </ul>
    </section>
  );
}

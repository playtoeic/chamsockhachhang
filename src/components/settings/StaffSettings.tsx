"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import type { ActiveUser } from "@/lib/types";

export function StaffSettings() {
  const { data, reload } = useData<{ items: ActiveUser[] }>("/api/users");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const u = await api<ActiveUser>("/api/users", { method: "POST", body: { email } });
      setNotice(`Đã thêm ${u.email}. Người này đăng nhập bằng tài khoản Google tương ứng.`);
      setEmail("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (u: ActiveUser) => {
    if (!confirm(`Gỡ quyền của ${u.name ?? u.email}? Người này bị đăng xuất ngay.`)) return;
    setError(null);
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      setNotice(`Đã gỡ ${u.email}.`);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel pad" aria-label="Nhân viên">
      <h2>Nhân viên</h2>
      <form className="row" onSubmit={add}>
        <input
          type="email"
          required
          placeholder="ten.nhanvien@gmail.com"
          aria-label="Địa chỉ Gmail của nhân viên"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="primary" type="submit">
          Thêm nhân viên
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}
      <table className="table" aria-label="Danh sách người dùng">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Gmail</th>
            <th>Vai trò</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.items.map((u) => (
            <tr key={u.id}>
              <td>{u.name ?? <span className="muted">Chưa đăng nhập lần nào</span>}</td>
              <td>{u.email}</td>
              <td>{u.role === "owner" ? "Chủ" : "Nhân viên"}</td>
              <td>
                {u.role === "staff" && (
                  <button className="danger" onClick={() => remove(u)} aria-label={`Gỡ ${u.email}`}>
                    Gỡ
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

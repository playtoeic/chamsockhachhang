# Hộp thư trung tâm

Website cho trung tâm gom tin nhắn Facebook, Instagram và Zalo về một hộp thư chung, để chủ và nhân
viên (đăng nhập bằng Google):

- trả lời khách ngay trên website (câu trả lời hiện cả trong ứng dụng gốc);
- tự có hồ sơ học sinh cho mỗi khách mới, phân loại theo 4 trạng thái có màu;
- xếp lịch học thử (theo từng tuần) và lịch học (tuần lặp lại) bằng kéo thả;
- theo dõi 5 bước tuyển sinh và tra cứu câu trả lời mẫu (Q&A).

Đặc tả, kế hoạch và danh sách việc nằm trong [`specs/001-unified-inbox-crm/`](specs/001-unified-inbox-crm/).

## Chạy trên máy cá nhân

Cần Node.js 20 trở lên. Có Docker thì dùng `docker compose up -d db`; không có Docker thì dùng
PostgreSQL nhúng đi kèm dự án.

```bash
npm install
cp .env.example .env            # rồi điền các giá trị bên dưới
npm run db:local                # cửa sổ riêng: PostgreSQL nhúng ở cổng 54329 (hoặc docker compose up -d db)
npx prisma migrate deploy
npm run dev                     # http://localhost:3000
```

Đăng nhập lần đầu bằng tài khoản Google trùng `OWNER_EMAIL`; tài khoản đó trở thành chủ. Sau đó chủ
thêm nhân viên ở **Cài đặt → Nhân viên**.

Để thử mà chưa có tài khoản nền tảng: giữ `ENABLE_SIMULATOR=true`, vào **Cài đặt → Kênh** kết nối
"Giả lập", rồi mở `/dev/simulator` để đóng vai khách nhắn tin.

### Biến môi trường

| Biến | Ý nghĩa |
|------|---------|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `OWNER_EMAIL` | Gmail của chủ trung tâm |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ứng dụng OAuth của Google (loại Web). Redirect URI: `<APP_URL>/api/auth/callback/google` |
| `AUTH_SECRET` | Chuỗi ngẫu nhiên dài (`npx auth secret`) |
| `CREDENTIALS_KEY` | 32 byte base64 để mã hoá thông tin truy cập kênh: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Mất khoá này thì phải kết nối lại mọi kênh |
| `APP_URL` | Địa chỉ công khai của website, ví dụ `https://inbox.trungtam.vn` |
| `UPLOAD_DIR` | Thư mục lưu ảnh khách gửi và ảnh đại diện |
| `ENABLE_SIMULATOR` | `true` chỉ khi dev/test. **Phải là `false` khi chạy thật** |
| `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` | Ứng dụng Meta cho Facebook và Instagram |
| `META_HUMAN_AGENT` | Bật (`true`) sau khi Meta duyệt quyền "human agent": trả lời được trong 7 ngày thay vì 24 giờ |
| `META_GRAPH_VERSION` | Phiên bản Graph API, mặc định `v23.0` |
| `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_SECRET_KEY` | Ứng dụng Zalo và khoá bí mật của OA |
| `ZALO_REPLY_WINDOW_HOURS` | Thời hạn trả lời Zalo, mặc định 48 (cần xác nhận với Zalo) |

## Kiểm thử

```bash
npm run lint
npm run typecheck
npm test              # unit, contract, integration (tự chạy PostgreSQL nhúng nếu không có TEST_DATABASE_URL)
npm run test:e2e      # Playwright; lần đầu chạy: npx playwright install chromium
npm run perf          # đo hiệu năng ở quy mô SC-009 (cần npm run db:local đang chạy)
```

Mọi thay đổi phải có test và qua review trước khi merge; xem [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Triển khai

Ứng dụng chạy **đúng một bản** (bộ phát sự kiện thời gian thực và tác vụ "tự chuyển đã học thử" mỗi
phút nằm trong tiến trình), sau HTTPS công khai.

```bash
cp .env.example .env.production   # điền giá trị thật, thêm POSTGRES_PASSWORD, ENABLE_SIMULATOR=false
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Ứng dụng nghe ở `127.0.0.1:3000`; đặt một reverse proxy HTTPS (Caddy, Nginx) phía trước. Sao lưu
định kỳ volume `pgdata` (cơ sở dữ liệu) và `uploads` (ảnh).

## Kết nối kênh thật (dành cho chủ trung tâm)

Các nền tảng chỉ gửi tin tới địa chỉ HTTPS công khai, nên làm sau khi đã triển khai.

### Facebook và Instagram (một ứng dụng Meta dùng chung)

1. Vào [developers.facebook.com](https://developers.facebook.com), tạo ứng dụng loại **Business**,
   thêm sản phẩm **Messenger** và **Instagram**.
2. Ở **Facebook Login → Settings**, thêm Valid OAuth Redirect URI:
   `<APP_URL>/api/channels/facebook/callback` và `<APP_URL>/api/channels/instagram/callback`.
3. Ở phần Webhooks của Messenger: Callback URL `<APP_URL>/api/webhooks/facebook`, Verify token =
   `META_VERIFY_TOKEN`, đăng ký trường `messages` và `message_echoes`. Làm tương tự cho Instagram
   với `<APP_URL>/api/webhooks/instagram`.
4. Điền `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, khởi động lại ứng dụng.
5. Vào **Cài đặt → Kênh**, bấm **Kết nối Facebook** (hoặc Instagram) và cấp quyền cho Trang. Website
   kết nối Trang đầu tiên tài khoản quản lý (Instagram: tài khoản chuyên nghiệp đầu tiên liên kết
   với một Trang).
6. Nộp **App Review** cho các quyền `pages_messaging`, `pages_manage_metadata`,
   `instagram_manage_messages` và tính năng **Human Agent**. Trước khi được duyệt, chỉ tài khoản có
   vai trò trong ứng dụng mới nhắn thử được. Khi Human Agent được duyệt, đặt `META_HUMAN_AGENT=true`.

### Zalo Official Account

1. Khi OA được duyệt, vào [developers.zalo.me](https://developers.zalo.me), tạo ứng dụng, liên kết
   với OA.
2. Callback URL đăng nhập: `<APP_URL>/api/channels/zalo/callback`. Webhook: `<APP_URL>/api/webhooks/zalo`,
   bật các sự kiện người dùng gửi tin (`user_send_*`) và OA gửi tin (`oa_send_*`). Xác minh tên miền
   theo hướng dẫn của Zalo.
3. Điền `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_SECRET_KEY`, rồi **Kết nối Zalo** ở trang Kênh.
4. Định dạng chữ ký webhook, thời hạn trả lời và mã lỗi của Zalo trong mã nguồn dựa trên tài liệu
   chưa xác minh được (xem `specs/001-unified-inbox-crm/research.md`, mục R1). Hãy thử một tin
   thật, kiểm tra nhật ký máy chủ, và chỉnh `ZALO_REPLY_WINDOW_HOURS` nếu cần.

Threads và TikTok chưa kết nối được trong bản này: nhân viên tạo hồ sơ học sinh thủ công và ghi
nguồn.

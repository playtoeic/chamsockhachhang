# Quickstart: chạy và kiểm chứng

**Date**: 2026-11-16 | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

Hướng dẫn này dùng kênh giả lập (`simulator`) nên không cần tài khoản nền tảng thật. Các lệnh dưới
đây là lệnh dự kiến; chúng có hiệu lực sau khi phần cài đặt dự án trong `tasks.md` hoàn thành.

## Chuẩn bị

- Node.js bản LTS và npm
- Docker (để chạy PostgreSQL cục bộ)
- Một ứng dụng OAuth của Google (client id và secret) cho đăng nhập

## Cài đặt

```bash
npm install
cp .env.example .env        # điền DATABASE_URL, OWNER_EMAIL, GOOGLE_CLIENT_ID/SECRET, AUTH_SECRET, CREDENTIALS_KEY
docker compose up -d db
npx prisma migrate dev
npm run dev                 # http://localhost:3000
```

Đặt `ENABLE_SIMULATOR=true` trong `.env` để bật kênh giả lập và trang `/dev/simulator`.

## Chạy test

```bash
npm test                    # unit + integration + contract (cần PostgreSQL đang chạy)
npm run test:e2e            # end-to-end bằng Playwright
```

Kỳ vọng: toàn bộ test đạt. Đây là cổng bắt buộc trước khi merge (Hiến pháp, Nguyên tắc I).

## Kịch bản kiểm chứng

Mỗi kịch bản tương ứng một user story trong [spec.md](./spec.md).

### 1. Hộp thư chung (US1)

1. Đăng nhập bằng tài khoản Google trùng `OWNER_EMAIL`.
2. Ở trang Kênh, kết nối kênh giả lập.
3. Ở `/dev/simulator`, gửi một tin văn bản với tên khách "Khách A".
4. Mở mục Tin nhắn. **Kỳ vọng**: cuộc trò chuyện "Khách A" hiện trên cùng, đánh dấu chưa đọc.
5. Mở cuộc trò chuyện, gửi câu trả lời. **Kỳ vọng**: `/dev/simulator` hiện câu trả lời; lịch sử ghi
   tên người gửi.
6. Ở `/dev/simulator`, bật "từ chối tin gửi", gửi câu trả lời nữa. **Kỳ vọng**: tin hiện "gửi thất
   bại" kèm lý do và nút gửi lại.
7. Ở `/dev/simulator`, gửi một "câu trả lời từ ứng dụng gốc". **Kỳ vọng**: tin hiện trong lịch sử
   kèm nhãn "gửi từ ứng dụng gốc", đúng một lần; câu trả lời ở bước 5 cũng chỉ hiện một lần.

### 2. Nhân viên (US2)

1. Bằng tài khoản chủ, thêm một địa chỉ Gmail ở trang Nhân viên.
2. Ở trình duyệt khác, đăng nhập bằng Gmail đó. **Kỳ vọng**: thấy 4 mục; không thấy trang Nhân viên
   và trang Kênh.
3. Thử đăng nhập bằng một Gmail chưa được thêm. **Kỳ vọng**: bị từ chối.
4. Bằng tài khoản chủ, gỡ nhân viên. **Kỳ vọng**: trình duyệt của nhân viên bị đăng xuất trong vòng
   5 giây.

### 3. Học sinh, trạng thái, 5 bước (US3)

1. Mở mục Các bước. **Kỳ vọng**: "Khách A" (từ kịch bản 1) đã tự có hồ sơ với ảnh đại diện, nguồn
   "Giả lập", trạng thái "đang tham khảo", ô tên đỏ, 0/5 bước.
2. Tạo thủ công học sinh "Khách B" với nguồn "Threads". **Kỳ vọng**: ô tên hiện chữ cái đầu và dòng
   nguồn "Threads".
3. Bấm vào "Khách A" và tick "làm test đầu vào". **Kỳ vọng**: thanh tiến độ 1/5.
4. Đổi trạng thái sang "đã đăng ký". **Kỳ vọng**: ô tên chuyển xanh dương; bảng chú thích hiện đủ 4
   màu.

### 4. Lịch học thử (US4)

1. Mở mục Học thử. **Kỳ vọng**: lưới tuần hiện tại, 6 cột có ngày tháng, 4 khung giờ; danh sách
   chưa xếp có cả "Khách A" và "Khách B", tìm được theo tên.
2. Kéo một học sinh đỏ vào một khung. **Kỳ vọng**: bước "xếp lịch học thử" tự được tick.
3. Chuyển sang tuần sau, kéo cùng học sinh vào một khung. **Kỳ vọng**: học sinh không còn ở tuần này.
4. Kéo học sinh vào một khung đã qua. **Kỳ vọng**: ô tên chuyển xanh lá ngay khi thả.
5. Đổi trạng thái về "đang tham khảo" bằng tay, chờ hơn 1 phút. **Kỳ vọng**: ô tên vẫn đỏ.

### 5. Lịch xếp học (US5)

1. Mở mục Xếp lịch học, kéo một học sinh vào 3 khung khác nhau. **Kỳ vọng**: ô tên hiện ở cả 3;
   bước "xếp lịch học thật" tự được tick.
2. Thả lại vào một khung đã có. **Kỳ vọng**: không nhân đôi.
3. Gỡ một khung. **Kỳ vọng**: 2 khung còn lại giữ nguyên.
4. Mở cùng trang ở trình duyệt thứ hai và lặp lại bước 1. **Kỳ vọng**: trình duyệt kia cập nhật
   trong vòng 5 giây mà không tải lại trang.

### 6. Q&A (US6)

1. Bằng tài khoản chủ, thêm một cặp hỏi–đáp.
2. Bằng tài khoản nhân viên, tìm theo từ khoá và sao chép câu trả lời. **Kỳ vọng**: tìm thấy, sao
   chép được, không có nút sửa/xoá.

## Kiểm chứng với nền tảng thật

Sau khi đã xác minh quyền truy cập theo [research.md](./research.md) mục R1, lặp lại kịch bản 1 cho
từng kênh thật (Facebook, Instagram, rồi Zalo khi OA được duyệt) bằng một tài khoản khách thử nghiệm. Webhook
cần địa chỉ HTTPS công khai trỏ về `/api/webhooks/{platform}`.

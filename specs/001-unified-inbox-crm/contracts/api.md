# Contract: HTTP API nội bộ

**Date**: 2026-11-16 | **Data model**: [../data-model.md](../data-model.md)

API này chỉ phục vụ giao diện của chính website. Tất cả trao đổi bằng JSON.

## Quy tắc chung

- Mọi điểm cuối dưới `/api/` (trừ `/api/auth/*` và `/api/webhooks/*`) yêu cầu phiên đăng nhập của
  người dùng đang hoạt động. Không có: `401`. Có nhưng không đủ quyền: `403`.
- Cột **Quyền**: `mọi người` = chủ và nhân viên; `chủ` = chỉ chủ.
- Lỗi trả về dạng `{ "error": { "code": "<mã>", "message": "<mô tả tiếng Việt>" } }`.
- Dữ liệu sai: `400` với `code = "validation"`. Không tìm thấy: `404`.

## Người dùng

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/me` | mọi người | Người dùng hiện tại: `id`, `email`, `name`, `role` |
| GET | `/api/users` | mọi người | Danh sách người dùng đang hoạt động (để hiện tên, giao việc) |
| POST | `/api/users` | chủ | Thêm nhân viên. Body: `{ email }`. Email đã có và đang hoạt động: `409` |
| DELETE | `/api/users/{id}` | chủ | Gỡ nhân viên; có hiệu lực ngay. Không gỡ được chủ: `400` |

## Kênh

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/channels` | mọi người | Danh sách kết nối: `platform`, `displayName`, `status`, `lastError`. Không trả `credentials` |
| POST | `/api/channels/{platform}/connect` | chủ | Bắt đầu kết nối; trả `{ redirectUrl }` tới trang cấp quyền của nền tảng. `platform` không thuộc danh sách: `404` |
| GET | `/api/channels/{platform}/callback` | chủ | Nền tảng chuyển hướng về sau khi cấp quyền |
| DELETE | `/api/channels/{id}` | chủ | Ngắt kết nối: `status = disconnected`, xoá `credentials`, giữ bản ghi và lịch sử tin nhắn. Kết nối lại cùng tài khoản qua `connect` cập nhật chính bản ghi này |

## Cuộc trò chuyện và tin nhắn

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/conversations` | mọi người | Danh sách, mới nhất trước. Lọc: `platform`, `unread`, `assignee` (`me` \| `none` \| id), `q` (tên khách), `cursor` |
| GET | `/api/conversations/{id}` | mọi người | Chi tiết kèm học sinh gắn và người phụ trách |
| GET | `/api/conversations/{id}/messages` | mọi người | Tin nhắn theo thời gian; phân trang bằng `cursor`. Tin `outbound` có `sentByUserId` trống là "gửi từ ứng dụng gốc" |
| POST | `/api/conversations/{id}/messages` | mọi người | Gửi trả lời. Body: `{ body }`. Trả tin ở trạng thái `sending`; kết quả đến qua sự kiện |
| POST | `/api/messages/{id}/retry` | mọi người | Gửi lại tin `failed` |
| POST | `/api/conversations/{id}/read` | mọi người | Đánh dấu đã đọc |
| PUT | `/api/conversations/{id}/assignee` | mọi người | Body: `{ userId \| null }`. Nhân viên chỉ được đặt chính mình hoặc bỏ nhận của chính mình; chủ đặt ai cũng được. Sai quyền: `403` |
| PUT | `/api/conversations/{id}/student` | mọi người | Body: `{ studentId \| null }`. Gắn hoặc bỏ gắn học sinh. Hồ sơ tự tạo cũ bị xoá nếu còn trống (data-model.md, Student) và phát `student.deleted` |

## Ảnh

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/media/{name}` | mọi người | Trả một ảnh đã lưu trong `UPLOAD_DIR` (ảnh khách gửi hoặc ảnh đại diện). `name` là tên tệp ngẫu nhiên do máy chủ đặt lúc lưu; chỉ chấp nhận ký tự chữ, số, `-`, `.` (chặn `..` và `/`). Không có: `404`. Header `Cache-Control: private` |

Các trường `mediaPath`, `customerAvatarPath`, `avatarPath` trả về trình duyệt dưới dạng
`/api/media/{name}`.

## Học sinh

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/students` | mọi người | Danh sách kèm `status`, `source`, `avatarUrl`, số bước đã xong. Lọc: `status`, `pendingStep`, `q` |
| POST | `/api/students` | mọi người | Tạo thủ công. Body: `{ name, source?, note?, conversationId? }`. Tạo ở `considering`, `autoCreated = false`; nếu có `conversationId` thì gắn luôn |
| GET | `/api/students/{id}` | mọi người | Chi tiết: 5 bước, buổi học thử, các khung học, các cuộc trò chuyện |
| PATCH | `/api/students/{id}` | mọi người | Body: `{ name?, source?, note?, status? }`. Đổi `status` qua đây luôn ghi `statusSource = manual` |
| DELETE | `/api/students/{id}` | mọi người | Xoá hồ sơ; các cuộc trò chuyện được giữ lại |
| PUT | `/api/students/{id}/steps/{step}` | mọi người | Body: `{ done }`. Ghi người tick và thời điểm |

## Lịch học thử

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/trial-schedule?week=YYYY-MM-DD&q=` | mọi người | `week` là ngày thứ 2 của tuần. Trả các buổi trong tuần và danh sách chưa xếp: mọi học sinh chưa có buổi nào, mọi trạng thái và nguồn, `lastActivityAt` mới nhất trước; `q` lọc theo tên |
| PUT | `/api/students/{id}/trial` | mọi người | Body: `{ date, slot }`. Tạo hoặc chuyển buổi (ghi đè). `date` là Chủ nhật: `400`. Khung đã qua thì áp dụng tự chuyển ngay |
| DELETE | `/api/students/{id}/trial` | mọi người | Gỡ buổi học thử; không đổi trạng thái học sinh |

## Lịch xếp học

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/class-schedule?q=` | mọi người | Toàn bộ lưới tuần và danh sách chưa xếp: mọi học sinh chưa có khung nào, `lastActivityAt` mới nhất trước; `q` lọc theo tên |
| PUT | `/api/students/{id}/class-slots/{weekday}/{slot}` | mọi người | Thêm khung; gọi lặp lại không đổi gì |
| DELETE | `/api/students/{id}/class-slots/{weekday}/{slot}` | mọi người | Gỡ đúng một khung |

## Q&A

| Phương thức | Đường dẫn | Quyền | Mô tả |
|-------------|-----------|-------|-------|
| GET | `/api/qa?q=` | mọi người | Danh sách; `q` lọc theo từ khoá trong câu hỏi hoặc câu trả lời |
| POST | `/api/qa` | chủ | Body: `{ question, answer }` |
| PATCH | `/api/qa/{id}` | chủ | Sửa |
| DELETE | `/api/qa/{id}` | chủ | Xoá |

## Sự kiện thời gian thực

`GET /api/events` (mọi người) — luồng Server-Sent Events. Mỗi sự kiện chỉ mang loại và định danh;
trình duyệt tải lại dữ liệu qua các điểm cuối ở trên.

| Sự kiện | Dữ liệu | Khi nào |
|---------|---------|---------|
| `conversation.updated` | `{ conversationId }` | Tin mới, đổi trạng thái tin, đã đọc, đổi người phụ trách, gắn học sinh |
| `student.updated` | `{ studentId }` | Tạo (kể cả tự tạo từ tin đến), sửa, đổi trạng thái, tick bước |
| `student.deleted` | `{ studentId }` | Xoá hồ sơ |
| `trial-schedule.updated` | `{ studentId }` | Tạo, chuyển, gỡ buổi học thử |
| `class-schedule.updated` | `{ studentId }` | Thêm, gỡ khung học |
| `qa.updated` | `{}` | Thêm, sửa, xoá mục Q&A |
| `channel.updated` | `{ channelId }` | Kết nối, mất kết nối |
| `session.revoked` | `{}` | Người dùng hiện tại bị gỡ; trình duyệt đăng xuất ngay |

## Webhook từ nền tảng

`GET|POST /api/webhooks/{platform}` — không dùng phiên đăng nhập; xác thực bằng chữ ký theo quy định
của từng nền tảng. Chữ ký sai: `401`, không xử lý. Xử lý theo [channel-adapter.md](./channel-adapter.md).
Luôn trả `200` nhanh sau khi đã lưu, kể cả khi sự kiện bị bỏ qua vì trùng.

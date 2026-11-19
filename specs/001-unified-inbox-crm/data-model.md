# Data Model: Hộp thư hợp nhất và theo dõi tuyển sinh

**Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Mọi thời điểm lưu ở UTC; ngày và khung giờ của lịch được hiểu theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).

## Giá trị cố định (enum)

| Enum | Giá trị |
|------|---------|
| `Role` | `owner`, `staff` |
| `Platform` | `facebook`, `instagram`, `zalo`, `simulator` (chỉ dev/test) |
| `ConnectionStatus` | `connected`, `disconnected` |
| `MessageDirection` | `inbound`, `outbound` |
| `MessageKind` | `text`, `image`, `unsupported` |
| `MessageStatus` | `received`, `sending`, `sent`, `failed` |
| `StudentStatus` | `considering` (đang tham khảo – đỏ), `trialed` (đã học thử – xanh lá), `enrolled` (đã đăng ký – xanh dương), `dropped` (ngừng theo – xám) |
| `StatusSource` | `auto`, `manual` |
| `Slot` | `S1` (09–11), `S2` (14–16), `S3` (18–20), `S4` (20–22) |
| `Weekday` | `1`–`6` (thứ 2–thứ 7) |
| `Step` | `trial_scheduled`, `class_scheduled`, `entry_test`, `tuition_paid`, `commitment_signed` |

## Thực thể

### User

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| id | định danh | khoá chính |
| email | văn bản | duy nhất, lưu chữ thường |
| name | văn bản | lấy từ tài khoản Google ở lần đăng nhập đầu; có thể trống trước đó |
| role | `Role` | đúng một `owner` (email trùng `OWNER_EMAIL`) |
| active | boolean | `false` = đã bị gỡ |
| createdAt | thời điểm | |

- Chỉ người có bản ghi `active = true` mới đăng nhập được (FR-009).
- Gỡ nhân viên: đặt `active = false`, xoá mọi phiên đăng nhập, bỏ gán các cuộc trò chuyện họ phụ
  trách (FR-010, Edge Cases). Không xoá bản ghi, để giữ tên trên tin nhắn và bước đã tick.

### ChannelConnection

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| id | định danh | khoá chính |
| platform | `Platform` | |
| externalAccountId | văn bản | duy nhất theo (`platform`, `externalAccountId`) |
| displayName | văn bản | |
| status | `ConnectionStatus` | |
| credentials | văn bản mã hoá | mã hoá khi lưu; không bao giờ trả về trình duyệt |
| lastError | văn bản | trống khi đang kết nối tốt |
| connectedAt | thời điểm | |

- Ngắt kết nối: giữ bản ghi, đặt `status = disconnected` và xoá `credentials`; các cuộc trò chuyện
  và tin nhắn giữ nguyên.
- Kết nối lại cùng tài khoản (cùng `platform`, `externalAccountId`): cập nhật bản ghi cũ (ghi đè
  `credentials`, `status = connected`, xoá `lastError`, cập nhật `connectedAt`), không tạo bản ghi
  mới, nên các cuộc trò chuyện cũ tiếp tục nhận tin.

### Conversation

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| id | định danh | khoá chính |
| channelConnectionId | → ChannelConnection | |
| externalThreadId | văn bản | duy nhất theo (`channelConnectionId`, `externalThreadId`) |
| customerName | văn bản | |
| customerAvatarPath | văn bản | có thể trống; bản sao ảnh đại diện trong `UPLOAD_DIR` |
| studentId | → Student | có thể trống; xoá học sinh thì đặt về trống |
| assigneeUserId | → User | có thể trống; tối đa một người (FR-006a) |
| unread | boolean | `true` khi có tin đến chưa ai mở |
| lastMessageAt | thời điểm | dùng để sắp xếp (FR-005) |
| replyWindowExpiresAt | thời điểm | có thể trống; do adapter tính |

### Message

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| id | định danh | khoá chính |
| conversationId | → Conversation | |
| direction | `MessageDirection` | |
| kind | `MessageKind` | |
| body | văn bản | bắt buộc khi `kind = text` |
| mediaPath | văn bản | bắt buộc khi `kind = image` |
| unsupportedType | văn bản | tên loại nội dung khi `kind = unsupported` |
| externalMessageId | văn bản | duy nhất theo (`conversationId`, `externalMessageId`) khi có giá trị |
| sentByUserId | → User | bắt buộc khi tin `outbound` gửi từ website; trống khi tin `outbound` gửi từ ứng dụng gốc (FR-004a) |
| status | `MessageStatus` | |
| failureReason | văn bản | bắt buộc khi `status = failed` |
| createdAt | thời điểm | |

- Ràng buộc duy nhất trên `externalMessageId` làm cho webhook gửi lặp không tạo tin trùng.
- Tin gửi đi từ website chỉ có `kind = text` trong bản đầu.
- Nền tảng báo lại (echo) mọi tin trung tâm gửi đi. Echo có `externalMessageId` trùng với một tin
  website đã gửi thì bị bỏ qua. Echo không trùng là tin gửi từ ứng dụng gốc: lưu `outbound`,
  `status = sent`, `sentByUserId` trống; không đổi `unread` và `replyWindowExpiresAt`.
- Echo có thể tới trước khi `sendText` trả `externalMessageId`. Để không nhân đôi, khi `sendText`
  trả về mà đã có tin cùng `externalMessageId` không có `sentByUserId`, gộp hai tin: giữ tin của
  website, xoá tin echo.

Chuyển trạng thái tin gửi đi: `sending → sent`, `sending → failed`, `failed → sending` (gửi lại, FR-007).

### Student

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| id | định danh | khoá chính |
| name | văn bản | bắt buộc, không trống |
| source | văn bản | có thể trống; tự tạo thì là tên kênh ("Facebook", "Instagram", "Zalo"); tạo thủ công thì do nhân viên ghi |
| avatarPath | văn bản | có thể trống; tự tạo thì chép từ `Conversation.customerAvatarPath` |
| autoCreated | boolean | `true` khi được tạo tự động từ cuộc trò chuyện (FR-012) |
| note | văn bản | có thể trống |
| status | `StudentStatus` | mặc định `considering` (FR-013) |
| statusSource | `StatusSource` | mặc định `manual` |
| lastActivityAt | thời điểm | thời điểm tin mới nhất của các cuộc trò chuyện gắn với học sinh, hoặc `createdAt`; dùng để sắp xếp danh sách chưa xếp (FR-017) |
| createdAt | thời điểm | |

- Tự tạo (FR-012): khi luồng tin đến tạo một Conversation mới, tạo Student (`name = customerName`,
  `source` = tên kênh, `avatarPath`, `autoCreated = true`) và gắn vào. Chỉ xảy ra lúc tạo
  Conversation, nên xoá học sinh rồi khách nhắn tiếp không tạo lại hồ sơ.
- Gắn lại (FR-012b): khi Conversation được gắn sang học sinh khác, học sinh cũ bị xoá nếu
  `autoCreated = true`, không còn Conversation nào, không có TrialBooking, ClassAssignment, và không
  có StepProgress `done = true`.

Xoá học sinh: xoá kèm TrialBooking, ClassAssignment, StepProgress; các Conversation được giữ lại
với `studentId` trống.

Chuyển trạng thái:

| Từ | Sang | Kích hoạt | `statusSource` sau đó |
|----|------|-----------|-----------------------|
| `considering` | `trialed` | buổi học thử qua giờ kết thúc và `autoMarkedAt` còn trống (FR-014) | `auto` |
| `trialed` (nguồn `auto`) | `considering` | buổi học thử được xếp lại sang thời điểm tương lai (FR-014b) | `auto` |
| bất kỳ | bất kỳ | người dùng chọn bằng tay (FR-014a) | `manual` |

- Tác vụ tự động không bao giờ đụng tới học sinh đang `enrolled` hoặc `dropped`.
- Gỡ buổi học thử không đổi trạng thái học sinh (FR-014b).
- Học sinh `trialed` do chuyển tay (`manual`) không bị đưa về `considering` khi xếp lại buổi học thử.

### TrialBooking

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| studentId | → Student | **duy nhất** — mỗi học sinh tối đa một buổi trên mọi tuần (FR-018, SC-007) |
| date | ngày | phải là thứ 2–thứ 7 |
| slot | `Slot` | |
| autoMarkedAt | thời điểm | trống cho tới khi tác vụ tự động xử lý buổi này |

- Kéo sang khung khác = cập nhật `date`, `slot` và đặt lại `autoMarkedAt` về trống.
- Người dùng chuyển học sinh về `considering` bằng tay không đặt lại `autoMarkedAt`, nên buổi đã qua
  không kích hoạt lần nữa (FR-014a).
- Xếp vào một khung đã qua (ví dụ ghi bù): thao tác xếp tự áp dụng quy tắc tự chuyển ngay trong
  cùng giao dịch, không chờ tác vụ mỗi phút (Edge Cases).

### ClassAssignment

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| studentId | → Student | |
| weekday | `Weekday` | |
| slot | `Slot` | duy nhất theo (`studentId`, `weekday`, `slot`) (FR-019) |

Không gắn ngày tháng: đây là lưới tuần lặp lại (FR-016a). Độc lập với TrialBooking (FR-021).

### StepProgress

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| studentId | → Student | |
| step | `Step` | duy nhất theo (`studentId`, `step`) |
| done | boolean | |
| doneByUserId | → User | trống khi được tick tự động |
| doneAt | thời điểm | |

- Không có bản ghi = bước chưa xong. Tiến độ = số bước `done` trên 5 (FR-024).
- Tick tự động (FR-026): tạo TrialBooking đầu tiên → `trial_scheduled`; tạo ClassAssignment đầu tiên
  → `class_scheduled`. Chỉ tick khi bước đang chưa xong; không tự bỏ tick khi gỡ lịch.

### QaEntry

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| id | định danh | khoá chính |
| question | văn bản | bắt buộc |
| answer | văn bản | bắt buộc |
| updatedByUserId | → User | |
| updatedAt | thời điểm | |

## Quan hệ

```text
ChannelConnection 1 ── n Conversation 1 ── n Message
Conversation n ── 0..1 Student (Student 0..n Conversation: học sinh tạo thủ công có thể không có)
Conversation n ── 0..1 User (người phụ trách)
Message n ── 0..1 User (người gửi phía trung tâm)
Student 1 ── 0..1 TrialBooking
Student 1 ── n ClassAssignment
Student 1 ── 0..5 StepProgress
```

## Quy tắc đồng thời

- Hai người cùng kéo một học sinh trên lịch học thử: ràng buộc duy nhất trên `studentId` cùng thao
  tác ghi đè (upsert) bảo đảm thao tác sau cùng thắng và không bao giờ có hai buổi.
- Thả lại học sinh vào khung đã có trên lịch xếp học: ràng buộc duy nhất làm thao tác thành không
  đổi gì, không báo lỗi.
- Sau mỗi thay đổi, máy chủ phát sự kiện để các trình duyệt khác tải lại phần liên quan.

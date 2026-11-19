# Contract: Channel Adapter

**Date**: 2026-11-16 | **Research**: [../research.md](../research.md)

Mỗi nền tảng nhắn tin được bọc trong một adapter thực hiện cùng một hợp đồng. Phần còn lại của hệ
thống không biết chi tiết của từng nền tảng. Thêm một kênh mới = thêm một adapter.

## Các adapter

| Platform | Trạng thái trong bản đầu |
|----------|--------------------------|
| `facebook` | Làm |
| `instagram` | Làm |
| `zalo` | Làm sau cùng trong ba kênh; kiểm chứng thật khi Zalo OA được duyệt |
| `simulator` | Chỉ dev/test; dùng cho test tự động và chạy thử cục bộ |

Threads và TikTok nằm ngoài phạm vi bản đầu: không có adapter (research R1).

## Hợp đồng

Mỗi adapter cung cấp:

| Thành phần | Đầu vào | Đầu ra | Ghi chú |
|------------|---------|--------|---------|
| `platform` | — | giá trị `Platform` | |
| `replyWindowHours` | — | số giờ hoặc không giới hạn | Thời hạn trả lời sau tin cuối của khách. Facebook/Instagram: 24, hoặc 168 (7 ngày) khi `META_HUMAN_AGENT=true` |
| `beginConnect` | địa chỉ quay về | địa chỉ chuyển hướng tới trang cấp quyền | |
| `completeConnect` | tham số nền tảng trả về | `externalAccountId`, `displayName`, `credentials` | |
| `verifyWebhook` | header và thân thô của yêu cầu | hợp lệ / không hợp lệ | Kiểm tra chữ ký |
| `parseWebhook` | thân yêu cầu | danh sách sự kiện chuẩn hoá (bên dưới) | Sự kiện không liên quan → danh sách trống |
| `sendText` | `credentials`, `externalThreadId`, nội dung, thời điểm tin cuối của khách | thành công kèm `externalMessageId`, hoặc lỗi chuẩn hoá | Meta: quá 24 giờ mà `META_HUMAN_AGENT=true` thì gửi kèm thẻ `HUMAN_AGENT` |
| `fetchMedia` | `credentials`, tham chiếu ảnh | dữ liệu ảnh | Để lưu bản sao ảnh khách gửi |
| `fetchProfile` | `credentials`, `externalThreadId` | `name`, `avatarRef?` | Gọi khi tạo cuộc trò chuyện mới; lỗi thì dùng tên trong sự kiện và không có ảnh |

## Sự kiện đến đã chuẩn hoá

```text
InboundMessage {
  externalAccountId   // tài khoản của trung tâm nhận tin
  externalThreadId    // định danh cuộc trò chuyện phía nền tảng
  externalMessageId   // dùng để chống trùng
  direction           // inbound (khách gửi) | echo (trung tâm gửi, từ website hoặc ứng dụng gốc)
  customerName
  kind                // text | image | unsupported
  body?               // khi kind = text
  mediaRef?           // khi kind = image
  unsupportedType?    // khi kind = unsupported, ví dụ "video", "audio", "sticker"
  sentAt
}
```

## Lỗi gửi đã chuẩn hoá

| Mã | Ý nghĩa | Thông báo cho nhân viên | Hệ quả |
|----|---------|-------------------------|--------|
| `window_expired` | Quá thời hạn được phép trả lời | "Đã quá thời hạn trả lời trên kênh này" | Tin `failed` |
| `disconnected` | Quyền truy cập hết hạn hoặc bị thu hồi | "Kênh đang mất kết nối" | Tin `failed`; kết nối chuyển `disconnected` |
| `rate_limited` | Vượt hạn mức của nền tảng | "Kênh đang giới hạn số tin gửi, thử lại sau" | Tin `failed` |
| `rejected` | Nền tảng từ chối nội dung | "Kênh từ chối tin nhắn này" | Tin `failed` |
| `unknown` | Lỗi khác | "Gửi thất bại, thử lại" | Tin `failed` |

## Bảo đảm hành vi (mỗi adapter phải có contract test)

1. `verifyWebhook` từ chối yêu cầu có chữ ký sai hoặc thiếu.
2. `parseWebhook` với dữ liệu mẫu của tin văn bản trả đúng một `InboundMessage` có đủ trường.
3. `parseWebhook` với tin ảnh trả `kind = image`; với loại khác trả `kind = unsupported` kèm tên loại.
4. `parseWebhook` với sự kiện không phải tin nhắn (đã xem, đang gõ, v.v.) trả danh sách trống.
5. `sendText` ánh xạ mỗi phản hồi lỗi của nền tảng sang đúng một mã lỗi chuẩn hoá.
6. `parseWebhook` với sự kiện báo lại tin trung tâm đã gửi (Meta `is_echo`, Zalo sự kiện OA gửi
   tin) trả `direction = echo` kèm `externalMessageId`.
7. `fetchProfile` trả tên và tham chiếu ảnh đại diện khi có; trả không có ảnh khi nền tảng không
   cung cấp.
8. (Meta) `sendText` trong 24 giờ không gắn thẻ; sau 24 giờ và trong 7 ngày gắn thẻ `HUMAN_AGENT`
   khi `META_HUMAN_AGENT=true`, trả `window_expired` khi tắt; sau 7 ngày luôn `window_expired`.

Dữ liệu mẫu dùng trong contract test là dữ liệu tự tạo theo định dạng của nền tảng, không phải tin
nhắn của khách thật.

## Xử lý sự kiện đến (chung cho mọi adapter)

1. Xác thực chữ ký; sai thì dừng.
2. Chuẩn hoá thành `InboundMessage`.
3. Tìm kết nối theo (`platform`, `externalAccountId`); không có thì bỏ qua.
4. Tìm hoặc tạo cuộc trò chuyện theo `externalThreadId`. Khi tạo mới: gọi `fetchProfile`, lưu bản
   sao ảnh đại diện, rồi gọi các bộ xử lý "cuộc trò chuyện mới" đã đăng ký (US3 đăng ký bộ tự tạo
   hồ sơ học sinh, FR-012).
5. Lưu tin; trùng `externalMessageId` thì bỏ qua. Tin `echo` lưu là `outbound`, `sent`,
   `sentByUserId` trống (data-model.md, Message).
6. Với ảnh: tải và lưu bản sao; tải lỗi thì lưu tin dạng `unsupported` loại `image`.
7. Với tin `inbound`: cập nhật `unread`, `lastMessageAt`, `replyWindowExpiresAt` và
   `Student.lastActivityAt` của học sinh đã gắn. Với tin `echo`: chỉ cập nhật `lastMessageAt`.
8. Phát sự kiện `conversation.updated`.

# Research: Hộp thư hợp nhất và theo dõi tuyển sinh

**Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Tài liệu này chốt các điểm chưa rõ trong Technical Context. Phần về nền tảng nhắn tin dựa trên tìm
kiếm web ngày 2026-11-16; phần lớn nguồn là tài liệu của bên thứ ba, không phải tài liệu chính thức
của nền tảng, nên mỗi kênh có một bước "xác minh trước khi làm" ghi rõ bên dưới.

## R1. Khả năng kết nối từng kênh nhắn tin

### Facebook Messenger và Instagram

- **Decision**: Làm trong bản đầu, qua nền tảng nhắn tin chính thức của Meta (webhook nhận tin,
  API gửi tin). Một ứng dụng Meta dùng chung cho cả hai kênh.
- **Rationale**: Đây là hai kênh có API chính thức, được nhiều công cụ hộp thư chung sử dụng.
- **Ràng buộc đã tìm thấy**:
  - Chỉ trả lời tự do trong 24 giờ kể từ tin nhắn cuối của khách. Với thẻ "human agent" thì được 7
    ngày, nhưng thẻ này phải được Meta duyệt riêng và chỉ dùng cho câu trả lời do người gõ.
  - Cần qua App Review của Meta cho quyền nhắn tin Trang (`pages_messaging`), quyền nhắn tin
    Instagram (tên quyền khác nhau tuỳ luồng đăng nhập) và tính năng human agent.
  - Instagram phải là tài khoản chuyên nghiệp (business/creator).
- **Human agent** (chủ dự án chốt 2026-11-19): xin quyền này trong App Review. Cấu hình
  `META_HUMAN_AGENT` mặc định tắt (24 giờ); bật sau khi Meta duyệt thì câu trả lời sau 24 giờ và
  trong 7 ngày được gửi kèm thẻ `HUMAN_AGENT`. Thẻ chỉ dùng cho câu trả lời do nhân viên gõ, đúng
  với cách website hoạt động (không có trả lời tự động).
- **Echo và hồ sơ khách**: đăng ký trường webhook báo lại tin Trang đã gửi (`message_echoes`) để ghi
  câu trả lời gửi từ ứng dụng gốc; lấy tên và ảnh đại diện khách qua API hồ sơ người dùng của
  Messenger/Instagram. Cần đối chiếu quyền cần thiết với tài liệu chính thức.
- **Xác minh trước khi làm**: đọc tài liệu chính thức của Meta để chốt tên quyền theo luồng đăng
  nhập sẽ dùng và yêu cầu App Review hiện hành. Thời gian duyệt không do dự án kiểm soát.
- **Alternatives considered**: dùng một dịch vụ hộp thư trung gian (trả phí theo tháng, làm nhanh
  hơn nhưng phụ thuộc bên thứ ba và mất quyền kiểm soát dữ liệu) — không chọn cho bản đầu.

### Zalo

- **Decision**: Làm trong bản đầu, qua Zalo Official Account (OA) API: webhook nhận tin, API gửi
  tin tư vấn.
- **Rationale**: Zalo OA có API chính thức cho tin nhắn tư vấn; là kênh chính ở Việt Nam.
- **Ràng buộc đã tìm thấy**: chủ phải có Zalo OA (không dùng được tài khoản Zalo cá nhân); tin tư
  vấn chỉ gửi được trong một khoảng thời gian sau tin cuối của khách và có hạn mức (quota); văn
  bản tối đa khoảng 2000 ký tự.
- **Chưa chắc chắn**: các nguồn mâu thuẫn về độ dài khoảng thời gian trả lời (48 giờ hoặc 7 ngày).
  Thiết kế không gắn cứng con số: mỗi adapter tự khai báo thời hạn trả lời.
- **Xác minh trước khi làm**: đọc developers.zalo.me để chốt thời hạn trả lời, hạn mức, tên sự kiện
  webhook (kể cả sự kiện OA gửi tin để ghi câu trả lời gửi từ ứng dụng gốc), API lấy tên và ảnh
  đại diện người dùng, và gói OA cần có để dùng API.
- **Phụ thuộc**: Zalo OA của trung tâm đang chờ phê duyệt (2026-11-16). Làm Zalo sau Facebook và
  Instagram; phát triển và test bằng dữ liệu mẫu, kiểm chứng với nền tảng thật khi OA được duyệt.

### TikTok

- **Decision**: **Ngoài phạm vi bản đầu** (chủ dự án chốt 2026-11-16). Không có adapter, không hiện
  trong giao diện. Nhân viên ghi "TikTok" vào ô nguồn khi tạo hồ sơ thủ công.
- **Rationale**: TikTok có Business Messaging API, nhưng phải xin duyệt và phụ thuộc quốc gia đăng
  ký tài khoản.
- **Ràng buộc đã tìm thấy** (đều từ tài liệu bên thứ ba):
  - Cần TikTok Business Account, có thể phải liên kết với TikTok for Business / Business Center.
  - Ứng dụng phải được TikTok duyệt quyền dùng Business Messaging API.
  - Bị chặn với tài khoản đăng ký ở EEA, Thuỵ Sĩ, Anh và (theo vài nguồn) Mỹ. Không nguồn nào nêu
    Việt Nam bị chặn, nhưng cũng không nguồn nào xác nhận chính thức là được.
  - Chỉ trả lời trong 48 giờ sau tin của khách, tối đa 10 tin liên tiếp; không tự mở đầu cuộc trò
    chuyện được.
- **Nếu sau này muốn thêm**: nộp đơn xin quyền Business Messaging API bằng tài khoản thật của
  trung tâm và xác nhận Việt Nam được hỗ trợ, rồi thêm adapter theo hợp đồng chung.

### Threads

- **Decision**: **Ngoài phạm vi bản đầu** (chủ dự án chốt 2026-11-16). Không có adapter, không hiện
  trong giao diện. Nhân viên ghi "Threads" vào ô nguồn khi tạo hồ sơ thủ công.
- **Rationale**: Threads đã có tin nhắn riêng cho người dùng từ 2025, nhưng không tìm thấy API nào
  cho phép bên ngoài đọc hoặc gửi tin nhắn Threads. Các công cụ bên thứ ba ghi rõ Threads API không
  có phần tin nhắn riêng.
- **Mức độ chắc chắn**: dựa trên nguồn bên thứ ba, chưa đối chiếu với tài liệu chính thức của Meta.
- **Nếu sau này muốn thêm**: kiểm tra tài liệu Threads API chính thức của Meta. Nếu có API tin
  nhắn, thêm adapter theo cùng hợp đồng với các kênh khác.
- **Tác động tới spec**: spec đã được sửa thành 3 kênh (FR-001, SC-002).
- **Alternatives considered**: tự động hoá trình duyệt hoặc dùng API không chính thức — loại, vì vi
  phạm điều khoản của nền tảng và có nguy cơ khoá tài khoản của trung tâm.

## R2. Kiến trúc và ngôn ngữ

- **Decision**: Một ứng dụng web TypeScript duy nhất (Next.js, chạy trên Node.js LTS) gồm cả giao
  diện, API và webhook; chạy thành một tiến trình máy chủ thường trực.
- **Rationale**: Quy mô nhỏ (khoảng 10 nhân viên, 500 học sinh, 200 cuộc trò chuyện mới mỗi ngày)
  không cần tách frontend/backend. Một ngôn ngữ, một lần triển khai, ít thứ phải bảo trì.
- **Alternatives considered**: tách backend riêng (thêm một dự án mà không có lợi ích ở quy mô
  này); nền tảng serverless (kết nối thời gian thực và tác vụ định kỳ phải dùng thêm dịch vụ ngoài).

## R3. Lưu trữ

- **Decision**: PostgreSQL, truy cập qua Prisma. Ảnh khách gửi được tải về và lưu trong thư mục lưu
  trữ của ứng dụng.
- **Rationale**: Dữ liệu có quan hệ rõ ràng và cần ràng buộc duy nhất ở mức cơ sở dữ liệu (một học
  sinh một buổi học thử; không trùng ô lịch; không nhận trùng tin nhắn). Đường dẫn ảnh do nền tảng
  cấp có thể hết hạn, nên phải lưu bản sao.
- **Alternatives considered**: SQLite (đơn giản hơn nhưng yếu khi nhiều người ghi cùng lúc);
  cơ sở dữ liệu tài liệu (không có ràng buộc duy nhất nhiều cột thuận tiện).

## R4. Đăng nhập và phân quyền

- **Decision**: Đăng nhập Google qua Auth.js, phiên lưu trong cơ sở dữ liệu. Mỗi yêu cầu đều kiểm
  tra người dùng còn hoạt động. Chủ được xác định bằng biến cấu hình `OWNER_EMAIL`.
- **Rationale**: Phiên lưu trong cơ sở dữ liệu cho phép thu hồi quyền ngay khi chủ gỡ nhân viên
  (FR-010); phiên dạng token tự chứa thì không thu hồi ngay được.
- **Alternatives considered**: tự viết luồng OAuth (dễ sai, không có lợi ích).

## R5. Cập nhật thời gian thực

- **Decision**: Server-Sent Events từ một điểm cuối duy nhất, phát từ bộ phát sự kiện trong tiến
  trình. Trình duyệt tự kết nối lại và tải lại dữ liệu khi mất kết nối.
- **Rationale**: Chỉ cần đẩy một chiều từ máy chủ xuống; đáp ứng SC-006 (5 giây) và FR-022 mà không
  cần hạ tầng thêm.
- **Ràng buộc kéo theo**: ứng dụng chạy đúng một bản (một tiến trình). Nếu sau này cần nhiều bản,
  thay bộ phát bằng LISTEN/NOTIFY của PostgreSQL.
- **Alternatives considered**: WebSocket (hai chiều, không cần); hỏi định kỳ (đơn giản nhất nhưng
  tốn tải và chậm hơn).

## R6. Tự chuyển trạng thái "đã học thử"

- **Decision**: Một tác vụ định kỳ trong tiến trình chạy mỗi phút, tìm buổi học thử đã qua giờ kết
  thúc (giờ Việt Nam) và chưa được xử lý, rồi chuyển học sinh đang "đang tham khảo" sang "đã học
  thử". Mỗi buổi chỉ được xử lý một lần (đánh dấu `autoMarkedAt`). Khi xếp vào khung đã qua, thao
  tác xếp gọi cùng quy tắc ngay để ô tên chuyển xanh lá ngay khi thả.
- **Rationale**: Dấu "đã xử lý" trên từng buổi đáp ứng FR-014a (không tự chuyển lại vì buổi cũ).
  Lưu nguồn của trạng thái (tự động / bằng tay) đáp ứng FR-014b.
- **Alternatives considered**: tính trạng thái lúc đọc (không lưu) — phức tạp khi kết hợp với
  chuyển tay và bộ lọc theo trạng thái.

## R7. Kéo thả

- **Decision**: Thư viện dnd-kit.
- **Rationale**: Hỗ trợ kéo giữa nhiều vùng chứa và điều khiển bằng bàn phím; đang được bảo trì.
- **Alternatives considered**: kéo thả gốc của HTML5 (khó kiểm thử, hành vi khác nhau giữa các
  trình duyệt).

## R8. Kiểm thử (Hiến pháp, Nguyên tắc I)

- **Decision**: Vitest cho unit và integration (chạy với PostgreSQL thật), Playwright cho end-to-end.
  Mỗi adapter kênh có contract test chạy với dữ liệu webhook mẫu tự tạo. Có một kênh giả lập
  (`simulator`) chỉ bật ở môi trường dev/test để kiểm thử toàn bộ luồng tin nhắn mà không cần nền
  tảng thật.
- **Rationale**: Nền tảng thật không gọi được trong test tự động; kênh giả lập và dữ liệu mẫu cho
  phép mọi thay đổi hành vi đều có test đi kèm. Thời gian được tiêm vào (clock) để test tác vụ
  chuyển trạng thái.
- **Alternatives considered**: giả lập cơ sở dữ liệu trong integration test (bỏ sót lỗi ràng buộc
  duy nhất, là phần quan trọng nhất của mô hình dữ liệu).

## R9. Triển khai

- **Decision**: Một container ứng dụng và một PostgreSQL, sau một tên miền HTTPS công khai.
- **Rationale**: Webhook của các nền tảng yêu cầu địa chỉ HTTPS công khai; kết nối thời gian thực và
  tác vụ định kỳ cần tiến trình chạy thường trực.
- **Để mở**: nhà cung cấp hosting cụ thể do chủ dự án chọn; không ảnh hưởng thiết kế.

## Sources

- [Threads launches direct messaging with safety restrictions](https://ppc.land/threads-launches-direct-messaging-with-safety-restrictions/)
- [Postproxy: Threads API reference](https://postproxy.dev/reference/platforms/threads/)
- [Cloud Campaign: How to DM on Threads](https://www.cloudcampaign.com/blog/how-to-dm-on-threads)
- [Meta: Overview of Instagram Messaging API](https://developers.facebook.com/docs/instagram-messaging/overview)
- [Meta: Instagram Messaging with the Messenger Platform](https://developers.facebook.com/docs/messenger-platform/instagram)
- [Chatwoot: Instagram app review](https://developers.chatwoot.com/self-hosted/instagram-app-review)
- [respond.io: TikTok overview](https://respond.io/help/tiktok/tiktok-overview)
- [Infobip: TikTok docs](https://www.infobip.com/docs/tiktok.md)
- [Chatwoot: How to setup a TikTok channel](https://www.chatwoot.com/hc/user-guide/articles/1769595702-how-to-setup-a-tik_tok-channel)
- [RedAI Zalo SDK: Message Services Guide](https://unpkg.com/@warriorteam/redai-zalo-sdk@1.11.1/docs/MESSAGE_SERVICES.md)
- [Viindoo: Getting Started with Zalo OA](https://viindoo.com/documentation/17.0/applications/productivity/zalo/getting-started.html)

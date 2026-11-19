# my-project Constitution

## Core Principles

### I. Code phải có test (KHÔNG THƯƠNG LƯỢNG)

- Mọi thay đổi về hành vi của code (tính năng mới, sửa lỗi, refactor làm đổi hành vi) MUST đi kèm
  test tự động kiểm chứng hành vi đó, trong cùng một thay đổi.
- Mọi bản sửa lỗi MUST có test tái hiện lỗi: test thất bại trước khi sửa và đạt sau khi sửa.
- Toàn bộ bộ test MUST đạt trước khi code được merge; không được tắt, bỏ qua (skip) hoặc xoá test
  chỉ để thay đổi được thông qua.
- Code không thể test tự động (ví dụ: cấu hình thuần, tài liệu) MUST được nêu rõ lý do miễn trừ
  trong mô tả thay đổi.

**Lý do**: Test là bằng chứng duy nhất có thể kiểm tra lại rằng code hoạt động đúng, và là lưới an
toàn chống hồi quy khi code thay đổi về sau.

## Quy trình phát triển và cổng chất lượng

- Mỗi thay đổi MUST qua review trước khi merge; người review MUST xác nhận thay đổi có test tương
  ứng và toàn bộ test đạt.
- Spec, plan và tasks của mỗi tính năng MUST bao gồm công việc viết test và mục kiểm tra tuân thủ
  hiến pháp (Constitution Check).
- Thay đổi vi phạm Nguyên tắc I MUST NOT được merge, bất kể mức độ khẩn cấp.

## Governance

- Hiến pháp này có hiệu lực cao hơn mọi quy ước, thói quen và tài liệu hướng dẫn khác của dự án.
- **Sửa đổi**: mọi sửa đổi MUST được ghi lại bằng văn bản (nội dung thay đổi, lý do, tác động tới
  code và tài liệu hiện có), được chủ dự án phê duyệt, và cập nhật phiên bản cùng ngày sửa đổi.
- **Phiên bản**: theo semantic versioning —
  - MAJOR: xoá hoặc định nghĩa lại nguyên tắc theo cách không tương thích ngược.
  - MINOR: thêm nguyên tắc/mục mới hoặc mở rộng đáng kể hướng dẫn hiện có.
  - PATCH: làm rõ câu chữ, sửa lỗi chính tả, tinh chỉnh không đổi ngữ nghĩa.
- **Kiểm tra tuân thủ**: mọi review MUST xác minh thay đổi tuân thủ hiến pháp. Không có ngoại lệ
  cho các nguyên tắc KHÔNG THƯƠNG LƯỢNG; muốn làm khác đi thì phải sửa đổi hiến pháp trước.

**Version**: 2.0.0 | **Ratified**: 2026-11-16 | **Last Amended**: 2026-11-16

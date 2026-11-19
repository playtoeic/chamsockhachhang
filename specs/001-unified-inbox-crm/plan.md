# Implementation Plan: Hộp thư hợp nhất và theo dõi tuyển sinh

**Branch**: `001-unified-inbox-crm` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-unified-inbox-crm/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Một website cho trung tâm gom tin nhắn từ nhiều nền tảng về một hộp thư chung, cho nhân viên (đăng
nhập bằng Google) trả lời, phân loại khách theo 4 trạng thái có màu, xếp lịch học thử và lịch học
bằng kéo thả, và theo dõi 5 bước tuyển sinh, kèm văn bản Q&A.

Cách làm: một ứng dụng web TypeScript duy nhất với PostgreSQL. Mỗi nền tảng nhắn tin được bọc trong
một adapter theo cùng một hợp đồng; webhook đưa tin về, API của nền tảng gửi tin đi. Thay đổi được
đẩy tới các trình duyệt khác qua Server-Sent Events. Một tác vụ mỗi phút tự chuyển học sinh sang "đã
học thử" khi buổi học thử trôi qua.

**Phạm vi kênh** (chủ dự án chốt ngày 2026-11-16; chi tiết ở [research.md](./research.md) mục R1):

- **Trong bản đầu**: Facebook, Instagram, Zalo. Cả ba cần nền tảng duyệt ứng dụng và có thời hạn
  trả lời sau tin cuối của khách.
- **Ngoài phạm vi**: Threads (không tìm thấy API tin nhắn) và TikTok (cần duyệt, chưa xác nhận cho
  Việt Nam). Không có adapter và không hiện trong giao diện. Nhân viên tạo hồ sơ thủ công và ghi
  nguồn vào ô nguồn.
- **Meta human agent**: xin duyệt; bật bằng `META_HUMAN_AGENT=true` sau khi được duyệt (7 ngày
  thay vì 24 giờ).

**Hồ sơ học sinh**: mỗi cuộc trò chuyện mới tự tạo một hồ sơ (tên, ảnh đại diện, nguồn là kênh).
Câu trả lời gõ trong ứng dụng gốc được ghi lại nhờ sự kiện echo của nền tảng.
- **Phụ thuộc bên ngoài**: Zalo OA của trung tâm đang chờ phê duyệt. Facebook và Instagram làm
  trước; Zalo làm sau cùng trong ba kênh và chỉ kiểm chứng với nền tảng thật khi OA được duyệt.

## Technical Context

**Language/Version**: TypeScript trên Node.js bản LTS hiện hành

**Primary Dependencies**: Next.js (giao diện, API, webhook trong một ứng dụng), React, Prisma,
Auth.js (đăng nhập Google), dnd-kit (kéo thả), Zod (kiểm tra dữ liệu vào)

**Storage**: PostgreSQL; ảnh khách gửi lưu trong thư mục lưu trữ của ứng dụng

**Testing**: Vitest (unit, integration với PostgreSQL thật, contract test cho adapter), Playwright
(end-to-end)

**Target Platform**: Máy chủ Linux chạy một container thường trực sau HTTPS công khai; người dùng
truy cập bằng trình duyệt máy tính hiện đại

**Project Type**: web-service (một ứng dụng web full-stack)

**Performance Goals**: tin đến hiện trong 1 phút với 95% trường hợp, tính từ lúc website nhận
webhook (SC-001); thay đổi lịch và tiến độ tới người khác trong 5 giây (SC-006); mỗi mục mở xong
dưới 2 giây ở quy mô SC-009; phản hồi kéo thả dưới 1 giây

**Constraints**: chạy đúng một bản ứng dụng (bộ phát sự kiện và tác vụ định kỳ nằm trong tiến
trình); giờ lịch tính theo `Asia/Ho_Chi_Minh`; chỉ dùng API chính thức của nền tảng; thông tin truy
cập kênh được mã hoá khi lưu

**Scale/Scope**: khoảng 10 nhân viên dùng cùng lúc, 500 học sinh, 200 cuộc trò chuyện mới mỗi ngày
(SC-009); 6 user story, khoảng 8 màn hình

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Hiến pháp v2.0.0 có một nguyên tắc.

| Cổng | Yêu cầu | Kế hoạch đáp ứng | Kết quả |
|------|---------|------------------|---------|
| I. Code phải có test | Mọi thay đổi hành vi kèm test tự động trong cùng thay đổi | Mỗi user story có test đi kèm ở ba tầng (unit, integration, e2e); `tasks.md` phải xếp nhiệm vụ viết test cùng nhiệm vụ cài đặt | PASS |
| I. Code phải có test | Sửa lỗi phải có test tái hiện | Quy ước làm việc; áp dụng từ khi có code | PASS |
| I. Code phải có test | Toàn bộ test đạt trước khi merge; không tắt/bỏ qua test | CI chạy `npm run lint`, `npm test`, `npm run test:e2e` trên mỗi pull request; nhánh `main` chỉ nhận merge khi CI đạt (tasks.md T007) | PASS |
| I. Code phải có test | Code không test tự động được phải nêu lý do | Miễn trừ dự kiến: file cấu hình, migration sinh tự động, và lời gọi tới nền tảng thật (được thay bằng contract test với dữ liệu mẫu) | PASS |
| Quy trình | Mỗi thay đổi qua review trước khi merge | Có người review (chủ dự án xác nhận 2026-11-19). Mỗi thay đổi làm trên nhánh riêng, mở pull request, cần ít nhất một người review duyệt; `main` được bảo vệ, không đẩy thẳng (tasks.md T001, T007) | PASS |
| Quy trình | Spec, plan, tasks có công việc viết test và Constitution Check | Mục này và research R8 | PASS |

**Trước Phase 0**: PASS. **Sau Phase 1**: PASS — thiết kế có kênh giả lập và đồng hồ tiêm vào để mọi
hành vi (kể cả webhook và tự chuyển trạng thái theo giờ) đều test tự động được. Không có vi phạm
cần biện minh.

## Project Structure

### Documentation (this feature)

```text
specs/001-unified-inbox-crm/
├── plan.md              # File này
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── api.md           # HTTP API nội bộ, sự kiện thời gian thực, webhook
│   └── channel-adapter.md  # Hợp đồng adapter cho từng nền tảng
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks tạo, không phải /speckit-plan)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma
└── migrations/

src/
├── app/                      # Trang và điểm cuối (Next.js App Router)
│   ├── (app)/
│   │   ├── inbox/            # (1) Tin nhắn
│   │   ├── class-schedule/   # (2) Lịch: xếp lịch học
│   │   ├── trial-schedule/   # (3) Lịch: học thử
│   │   ├── steps/            # (4) Các bước + Q&A
│   │   ├── settings/         # Nhân viên, Kênh (chỉ chủ)
│   │   └── dev/simulator/    # Chỉ khi ENABLE_SIMULATOR=true
│   └── api/                  # Theo contracts/api.md
│       ├── webhooks/[platform]/
│       ├── media/[name]/     # Ảnh đã lưu, chỉ người đã đăng nhập
│       └── events/
├── components/               # Ô tên, lưới lịch, bảng chú thích màu, thanh tiến độ
├── server/
│   ├── auth/                 # Phiên, kiểm tra quyền chủ/nhân viên
│   ├── channels/             # Adapter: facebook, instagram, zalo, simulator
│   ├── inbox/                # Nhận tin, gửi tin, gửi lại, người phụ trách
│   ├── students/             # Hồ sơ, tự tạo hồ sơ cho khách mới, trạng thái, 5 bước
│   ├── schedule/             # Học thử, xếp học, tác vụ tự chuyển trạng thái, bộ chạy mỗi phút
│   ├── qa/
│   ├── events/               # Bộ phát sự kiện + SSE
│   └── db.ts
├── lib/                      # Khung giờ, tuần, múi giờ, đồng hồ tiêm vào
└── instrumentation.ts        # Khởi động tác vụ mỗi phút khi máy chủ chạy

scripts/                      # PostgreSQL nhúng, máy chủ e2e, sinh dữ liệu, đo hiệu năng
.github/                      # CI và mẫu pull request (cổng review)

tests/
├── unit/                     # Quy tắc thuần: khung giờ, chuyển trạng thái, tiến độ
├── contract/                 # Mỗi adapter theo contracts/channel-adapter.md
├── integration/              # Điểm cuối API với PostgreSQL thật
├── e2e/                      # Playwright, theo các kịch bản trong quickstart.md
└── fixtures/                 # Dữ liệu webhook mẫu tự tạo
```

**Structure Decision**: Một dự án duy nhất. Giao diện, API và webhook cùng nằm trong một ứng dụng
Next.js; logic nghiệp vụ tách vào `src/server/` theo từng lĩnh vực để test được mà không cần giao
diện. Không tách frontend/backend vì quy mô không cần (research R2).

## Complexity Tracking

Không có vi phạm hiến pháp cần biện minh.

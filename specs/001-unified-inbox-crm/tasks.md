---

description: "Task list for feature 001-unified-inbox-crm"
---

# Tasks: Hộp thư hợp nhất và theo dõi tuyển sinh

**Input**: Design documents from `/specs/001-unified-inbox-crm/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/channel-adapter.md, quickstart.md

**Tests**: BẮT BUỘC. Hiến pháp v2.0.0, Nguyên tắc I: mọi thay đổi hành vi phải kèm test tự động trong
cùng thay đổi. Trong mỗi user story, viết test trước và xác nhận test thất bại rồi mới cài đặt. Ở
Phase 2, mỗi task tự mang test của chính nó.

**Review**: Hiến pháp, "Quy trình phát triển": mọi thay đổi làm trên nhánh riêng, mở pull request
và chỉ merge vào `main` khi có người review duyệt và CI đạt (T001, T007).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Một dự án Next.js duy nhất ở gốc repo: `src/`, `prisma/`, `tests/` (theo plan.md)
- Điểm cuối API: `src/app/api/**/route.ts`; hành vi phải khớp `specs/001-unified-inbox-crm/contracts/api.md`
- Logic nghiệp vụ: `src/server/<lĩnh vực>/`; route chỉ kiểm tra quyền, kiểm tra dữ liệu vào và gọi service
- Mọi service ghi dữ liệu phải phát sự kiện tương ứng trong bảng "Sự kiện thời gian thực" của contracts/api.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo dự án, công cụ và cổng review

- [ ] T001 Chạy `git init` ở gốc repo với nhánh mặc định `main`; tạo `.gitignore` (node_modules, .next, .env, uploads/, test-results/, playwright-report/); xoá khối chú thích "Sync Impact Report" ở đầu `.specify/memory/constitution.md` (đó là ghi chú tạm, phải xoá trước khi commit); commit các file `.specify/`, `.claude/`, `specs/` hiện có làm commit đầu tiên của `main`. Từ task sau trở đi, mọi thay đổi làm trên nhánh riêng
- [ ] T002 Khởi tạo dự án Next.js (App Router, TypeScript strict, thư mục `src/`) ở gốc repo: `package.json`, `tsconfig.json`, `next.config.ts`; cài next, react, prisma, @prisma/client, next-auth (Auth.js) kèm adapter Prisma, zod, @dnd-kit/core; thêm script `dev`, `build`, `start`, `test` (vitest run), `test:e2e` (playwright test)
- [ ] T003 [P] Cấu hình ESLint và Prettier trong `eslint.config.mjs` và `.prettierrc`; thêm script `lint`
- [ ] T004 [P] Tạo `docker-compose.yml` (dịch vụ `db` PostgreSQL, và cơ sở dữ liệu thứ hai cho test) và `.env.example` với `DATABASE_URL`, `TEST_DATABASE_URL`, `OWNER_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `CREDENTIALS_KEY`, `ENABLE_SIMULATOR`, `UPLOAD_DIR`, `META_HUMAN_AGENT` (mặc định `false`)
- [ ] T005 [P] Cấu hình Vitest trong `vitest.config.ts` và `tests/setup.ts`: dùng `TEST_DATABASE_URL`, chạy migration một lần, xoá sạch mọi bảng trước mỗi test; test trong `tests/unit/**/*.dom.test.ts` chạy môi trường jsdom
- [ ] T006 [P] Cấu hình Playwright trong `playwright.config.ts`: tự khởi động ứng dụng với `ENABLE_SIMULATOR=true` và cơ sở dữ liệu test, chỉ chạy Chromium máy tính
- [ ] T007 [P] Dựng cổng review và CI: `CONTRIBUTING.md` (mỗi thay đổi một nhánh, mở pull request, cần ít nhất một người review duyệt, CI phải đạt, không đẩy thẳng vào `main`, không tắt hay xoá test); `.github/pull_request_template.md` (ô kiểm: có test cho thay đổi hành vi, sửa lỗi có test tái hiện, đã đối chiếu spec/contracts, Constitution Check); `.github/workflows/ci.yml` (dịch vụ PostgreSQL, chạy `npm ci`, `npx prisma migrate deploy`, `npm run lint`, `npm test`, `npm run test:e2e` trên mọi pull request vào `main`); ghi trong `CONTRIBUTING.md` cách bật bảo vệ nhánh `main` trên GitHub (bắt buộc 1 lượt duyệt và CI đạt). Đây là file cấu hình, miễn test tự động theo plan.md; kiểm chứng bằng pull request đầu tiên

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hạ tầng lõi mà mọi user story đều cần

**⚠️ CRITICAL**: Chưa xong phase này thì chưa bắt đầu user story nào

- [ ] T008 Viết toàn bộ schema trong `prisma/schema.prisma` theo data-model.md, gồm các bảng của Auth.js (Account, Session, VerificationToken) và: enum `Role` (owner, staff), `Platform` (facebook, instagram, zalo, simulator), `ConnectionStatus` (connected, disconnected), `MessageDirection` (inbound, outbound), `MessageKind` (text, image, unsupported), `MessageStatus` (received, sending, sent, failed), `StudentStatus` (considering, trialed, enrolled, dropped), `StatusSource` (auto, manual), `Slot` (S1, S2, S3, S4), `Step` (trial_scheduled, class_scheduled, entry_test, tuition_paid, commitment_signed); `User.email` "duy nhất, lưu chữ thường", `User.active` boolean; `ChannelConnection` "duy nhất theo (platform, externalAccountId)"; `Conversation` "duy nhất theo (channelConnectionId, externalThreadId)", `customerAvatarPath` có thể trống, `studentId` và `assigneeUserId` "có thể trống" với onDelete SetNull; `Message` "duy nhất theo (conversationId, externalMessageId) khi có giá trị", `sentByUserId` "bắt buộc khi tin outbound gửi từ website; trống khi tin outbound gửi từ ứng dụng gốc"; `Student.name` "bắt buộc, không trống", `source` và `avatarPath` có thể trống, `autoCreated` boolean mặc định `false`, `lastActivityAt` thời điểm, `status` "mặc định considering", `statusSource` "mặc định manual"; `TrialBooking.studentId` "duy nhất — mỗi học sinh tối đa một buổi trên mọi tuần", `autoMarkedAt` có thể trống; `ClassAssignment` "duy nhất theo (studentId, weekday, slot)" với `weekday` 1–6; `StepProgress` "duy nhất theo (studentId, step)", `doneByUserId` "trống khi được tick tự động"; `QaEntry.question` và `answer` "bắt buộc"; TrialBooking, ClassAssignment, StepProgress xoá theo Student (onDelete Cascade)
- [ ] T009 Tạo migration đầu tiên trong `prisma/migrations/` (`npx prisma migrate dev --name init`) và Prisma client dùng chung trong `src/server/db.ts`
- [ ] T010 [P] Tạo đồng hồ tiêm vào trong `src/lib/clock.ts` (`now()`, và `setTestNow()` chỉ dùng trong test) kèm test `tests/unit/clock.test.ts`
- [ ] T011 [P] Tạo tiện ích route trong `src/server/http.ts`: lớp `ApiError(code, status, message)`, hàm bọc route trả lỗi dạng `{ error: { code, message } }`, kiểm tra body bằng Zod trả `400` với `code = "validation"`; kèm test `tests/unit/http.test.ts`
- [ ] T012 [P] Tạo mã hoá thông tin truy cập kênh trong `src/server/crypto.ts` (AES-256-GCM, khoá từ `CREDENTIALS_KEY`; `encrypt`, `decrypt`) kèm test `tests/unit/crypto.test.ts` (mã hoá rồi giải mã trả lại nguyên văn; khoá sai thì lỗi)
- [ ] T013 Cấu hình Auth.js trong `src/server/auth/config.ts` và `src/app/api/auth/[...nextauth]/route.ts`: provider Google, phiên lưu trong cơ sở dữ liệu, callback `signIn` chỉ cho email (đổi về chữ thường) có `User.active = true`; email trùng `OWNER_EMAIL` được tự tạo với `role = owner` ở lần đăng nhập đầu; ghi `name` từ hồ sơ Google. Tách quy tắc thành hàm thuần `canSignIn(email)` và kèm test `tests/integration/signin.test.ts`: email đã thêm và `active` được vào; email chưa thêm bị từ chối; email `active = false` bị từ chối; so khớp không phân biệt hoa thường; `OWNER_EMAIL` lần đầu tạo chủ
- [ ] T014 Tạo trợ giúp test trong `tests/helpers/session.ts`: tạo `User` và bản ghi `Session` trực tiếp trong cơ sở dữ liệu, trả về cookie phiên dùng được cho cả integration test và Playwright (không gọi Google)
- [ ] T015 Tạo `requireUser()` và `requireOwner()` trong `src/server/auth/guards.ts`: không có phiên hoặc người dùng không còn `active` → `401`; không phải chủ → `403`; kiểm tra `active` trên mỗi yêu cầu; kèm test `tests/integration/auth-guards.test.ts` (dùng `tests/helpers/session.ts`)
- [ ] T016 Tạo test bao phủ quyền truy cập `tests/integration/auth-coverage.test.ts` (FR-029, SC-008): quét mọi file `src/app/api/**/route.ts`, bỏ qua `api/auth/**`, `api/webhooks/**` và `api/dev/**`; với mỗi phương thức HTTP được export, gọi không kèm phiên và yêu cầu `401`. Test tự bao phủ mọi route thêm về sau, nên route nào quên `requireUser` sẽ làm test thất bại
- [ ] T017 [P] Tạo bộ phát sự kiện trong `src/server/events/bus.ts` (`publish(type, data)`, `subscribe`) và luồng SSE trong `src/app/api/events/route.ts` (yêu cầu `requireUser`, gửi nhịp giữ kết nối, gửi `session.revoked` riêng cho người bị gỡ); kèm test `tests/integration/events.test.ts`
- [ ] T018 [P] Tạo hook phía trình duyệt `src/lib/use-events.ts`: mở `EventSource('/api/events')`, tự kết nối lại, gọi callback theo loại sự kiện, tải lại dữ liệu sau khi kết nối lại; kèm test `tests/unit/use-events.dom.test.ts` với `EventSource` giả (gọi đúng callback theo loại; mất kết nối thì kết nối lại; sau khi kết nối lại gọi hàm tải lại)
- [ ] T019 Tạo khung ứng dụng: `src/app/login/page.tsx` (nút đăng nhập Google, thông báo khi bị từ chối), `src/app/(app)/layout.tsx` (chuyển về `/login` nếu chưa đăng nhập), `src/components/Nav.tsx` (4 mục: Tin nhắn, Lịch: xếp lịch học, Lịch: học thử, Các bước; mục Cài đặt chỉ hiện với chủ), và `src/app/api/me/route.ts` (GET trả `id`, `email`, `name`, `role`); kèm test `tests/integration/me.test.ts` (trả đúng 4 trường; không có phiên trả `401`) và `tests/e2e/shell.spec.ts` (chưa đăng nhập mở `/inbox` bị chuyển về `/login`; chủ thấy 4 mục và Cài đặt; nhân viên thấy 4 mục, không thấy Cài đặt)

**Checkpoint**: Đăng nhập được bằng tài khoản chủ và thấy khung 4 mục; mọi route API đều được kiểm quyền tự động; có thể bắt đầu các user story

---

## Phase 3: User Story 1 - Trả lời tin nhắn từ mọi kênh ở một chỗ (Priority: P1) 🎯 MVP

**Goal**: Tin nhắn từ Facebook, Instagram, Zalo vào một danh sách chung kèm tên và ảnh đại diện
khách; trả lời từ website về đúng kênh gốc; ghi lại câu trả lời gõ trong ứng dụng gốc; lọc, tìm,
người phụ trách, báo lỗi gửi và cảnh báo mất kết nối.

**Independent Test**: Kết nối kênh giả lập, gửi tin thử từ `/dev/simulator`, thấy tin trong mục Tin
nhắn, trả lời và thấy câu trả lời ở `/dev/simulator` (quickstart.md kịch bản 1).

### Tests for User Story 1 ⚠️

> **Viết các test này TRƯỚC, xác nhận chúng THẤT BẠI rồi mới cài đặt**

- [ ] T020 [P] [US1] Contract test cho adapter giả lập trong `tests/contract/simulator.test.ts`, bao phủ các bảo đảm hành vi 1–7 trong contracts/channel-adapter.md (chữ ký sai bị từ chối; tin văn bản; ảnh và loại không hỗ trợ; sự kiện không phải tin nhắn trả danh sách trống; ánh xạ lỗi gửi; echo trả `direction = echo`; `fetchProfile` có và không có ảnh)
- [ ] T021 [P] [US1] Integration test cho luồng tin đến trong `tests/integration/inbound.test.ts`: POST `/api/webhooks/simulator` tạo cuộc trò chuyện và tin; cuộc trò chuyện mới gọi `fetchProfile` và lưu `customerName`, `customerAvatarPath`; `fetchProfile` lỗi thì dùng tên trong sự kiện, ảnh trống; cùng `externalMessageId` gửi hai lần chỉ tạo một tin; cập nhật `unread`, `lastMessageAt`, `replyWindowExpiresAt`; echo của tin website đã gửi (trùng `externalMessageId`) không tạo tin mới; echo không trùng lưu `outbound`, `sent`, `sentByUserId` trống, không đổi `unread` và `replyWindowExpiresAt`; tài khoản không có kết nối thì bỏ qua và trả `200`; chữ ký sai trả `401`; tải ảnh lỗi thì lưu `kind = unsupported`; bộ xử lý "cuộc trò chuyện mới" đã đăng ký được gọi đúng một lần cho mỗi cuộc trò chuyện mới
- [ ] T022 [P] [US1] Integration test cho API cuộc trò chuyện trong `tests/integration/conversations.test.ts`: sắp xếp theo tin mới nhất; lọc `platform`, `unread`, `assignee=me|none|id`, `q`; gửi trả lời ghi `sentByUserId` và chuyển `sending → sent`; echo tới trước khi `sendText` trả về thì vẫn chỉ còn một tin, giữ `sentByUserId`; lỗi gửi chuyển `failed` kèm `failureReason`; `retry` chuyển `failed → sending`; lỗi `disconnected` đặt kết nối về `disconnected`; đánh dấu đã đọc; nhân viên chỉ tự nhận/tự bỏ nhận (`403` nếu gán người khác), chủ gán ai cũng được
- [ ] T023 [P] [US1] Integration test cho API kênh trong `tests/integration/channels.test.ts`: nhân viên gọi connect/DELETE nhận `403`; GET không bao giờ trả `credentials`; `platform` không thuộc danh sách trả `404`; ngắt kết nối đặt `disconnected`, xoá `credentials`, giữ bản ghi và lịch sử tin nhắn; kết nối lại cùng tài khoản cập nhật chính bản ghi cũ (`connected`, xoá `lastError`), không tạo bản ghi mới, và tin đến sau đó vào đúng cuộc trò chuyện cũ
- [ ] T024 [P] [US1] Integration test cho ảnh trong `tests/integration/media.test.ts`: người đã đăng nhập GET `/api/media/{name}` nhận đúng ảnh và `Cache-Control: private`; tên chứa `..` hoặc `/` bị từ chối; tên không tồn tại trả `404`
- [ ] T025 [P] [US1] E2E test trong `tests/e2e/inbox.spec.ts` theo quickstart.md kịch bản 1: kết nối kênh giả lập, tin đến hiện trên cùng, chưa đọc, có ảnh đại diện; trả lời hiện ở `/dev/simulator` kèm tên người gửi trong lịch sử; bật "từ chối tin gửi" thì tin hiện "gửi thất bại" kèm lý do và gửi lại được; "câu trả lời từ ứng dụng gốc" hiện đúng một lần kèm nhãn; bộ lọc "của tôi"

### Implementation for User Story 1

- [ ] T026 [US1] Định nghĩa hợp đồng adapter trong `src/server/channels/types.ts` (`ChannelAdapter` với `platform`, `replyWindowHours`, `beginConnect`, `completeConnect`, `verifyWebhook`, `parseWebhook`, `sendText`, `fetchMedia`, `fetchProfile`; kiểu `InboundMessage` có `direction` inbound | echo; mã lỗi `window_expired`, `disconnected`, `rate_limited`, `rejected`, `unknown` kèm thông báo tiếng Việt theo contracts/channel-adapter.md) và sổ đăng ký trong `src/server/channels/registry.ts` (chỉ đăng ký `simulator` khi `ENABLE_SIMULATOR=true`)
- [ ] T027 [US1] Cài đặt adapter giả lập trong `src/server/channels/simulator.ts`: chữ ký HMAC đơn giản, hộp thư đi lưu trong bộ nhớ và phát echo cho mỗi tin gửi đi, tạo echo "từ ứng dụng gốc" theo yêu cầu, `fetchProfile` trả ảnh đại diện mẫu, công tắc "từ chối tin gửi" để tạo từng mã lỗi (làm T020 đạt)
- [ ] T028 [US1] Cài đặt luồng tin đến 8 bước trong `src/server/inbox/receive.ts` (kể cả xử lý echo và danh sách bộ xử lý "cuộc trò chuyện mới" đăng ký được qua `onNewConversation(handler)`) và lưu ảnh trong `src/server/inbox/media.ts` (tải qua `fetchMedia` hoặc tham chiếu ảnh đại diện, ghi vào `UPLOAD_DIR` với tên tệp ngẫu nhiên, trả `name`), theo mục "Xử lý sự kiện đến" của contracts/channel-adapter.md; phát `conversation.updated`
- [ ] T029 [US1] Tạo route webhook `src/app/api/webhooks/[platform]/route.ts` (GET cho bước xác minh của nền tảng, POST cho sự kiện): đọc thân thô, gọi `verifyWebhook`, gọi `receive`, luôn trả `200` sau khi lưu (làm T021 đạt)
- [ ] T030 [US1] Cài đặt gửi và gửi lại trong `src/server/inbox/send.ts`: tạo tin `outbound` ở `sending`, gọi `sendText` với `credentials` đã giải mã và thời điểm tin cuối của khách, cập nhật `sent` kèm `externalMessageId` (nếu echo đã tới trước thì gộp theo data-model.md) hoặc `failed` kèm `failureReason`; lỗi `disconnected` đặt `ChannelConnection.status = disconnected` và phát `channel.updated`; chỉ cho gửi `kind = text`, không trống
- [ ] T031 [US1] Cài đặt truy vấn và thao tác cuộc trò chuyện trong `src/server/inbox/conversations.ts`: danh sách có lọc và phân trang `cursor`, chi tiết, tin nhắn theo thời gian, đánh dấu đã đọc, đặt người phụ trách với quy tắc quyền của FR-006a
- [ ] T032 [US1] Tạo các route `src/app/api/conversations/route.ts`, `src/app/api/conversations/[id]/route.ts`, `src/app/api/conversations/[id]/messages/route.ts` (GET, POST), `src/app/api/conversations/[id]/read/route.ts`, `src/app/api/conversations/[id]/assignee/route.ts`, `src/app/api/messages/[id]/retry/route.ts` (làm T022 đạt)
- [ ] T033 [US1] Cài đặt quản lý kết nối trong `src/server/channels/connections.ts` (bắt đầu; hoàn tất bằng upsert theo (`platform`, `externalAccountId`) để kết nối lại cập nhật bản ghi cũ; ngắt bằng cách đặt `disconnected` và xoá `credentials`; mã hoá `credentials` bằng `src/server/crypto.ts`) và các route `src/app/api/channels/route.ts`, `src/app/api/channels/[platform]/connect/route.ts`, `src/app/api/channels/[platform]/callback/route.ts`, `src/app/api/channels/[id]/route.ts` (làm T023 đạt)
- [ ] T034 [US1] Tạo route ảnh `src/app/api/media/[name]/route.ts`: `requireUser`, kiểm tra `name` theo contracts/api.md mục Ảnh, đọc từ `UPLOAD_DIR`, trả đúng kiểu nội dung và `Cache-Control: private` (làm T024 đạt)
- [ ] T035 [US1] Tạo GET trong `src/app/api/users/route.ts` trả danh sách người dùng đang hoạt động (`id`, `name`, `email`, `role`) để hiện tên và chọn người phụ trách; kèm test `tests/integration/users-list.test.ts` (chỉ trả người `active`; đủ 4 trường)
- [ ] T036 [US1] Dựng mục Tin nhắn trong `src/app/(app)/inbox/page.tsx` với `src/components/inbox/ConversationList.tsx` (ảnh đại diện hoặc chữ cái đầu, biểu tượng kênh, tên khách, đánh dấu chưa đọc, tên người phụ trách, bộ lọc kênh / chưa đọc / "của tôi" / chưa ai phụ trách, ô tìm tên), `src/components/inbox/MessageThread.tsx` (ảnh, ghi chú loại nội dung không hiển thị được, tên người gửi hoặc nhãn "gửi từ ứng dụng gốc", trạng thái "gửi thất bại" kèm lý do và nút gửi lại) và `src/components/inbox/ReplyBox.tsx` (hiện thời hạn trả lời còn lại; nút nhận / bỏ nhận; chủ chọn người phụ trách); cập nhật qua `use-events`
- [ ] T037 [US1] Dựng trang Kênh cho chủ trong `src/app/(app)/settings/channels/page.tsx` (danh sách Facebook, Instagram, Zalo; kết nối, kết nối lại, ngắt, trạng thái, `lastError`) và cảnh báo mất kết nối hiện ở mọi trang trong `src/components/ChannelAlert.tsx`
- [ ] T038 [US1] Tạo công cụ giả lập chỉ bật khi `ENABLE_SIMULATOR=true`: `src/app/dev/simulator/page.tsx` (gửi tin văn bản/ảnh/loại khác với tên khách tuỳ chọn, gửi "câu trả lời từ ứng dụng gốc", xem hộp thư đi, công tắc "từ chối tin gửi") và `src/app/api/dev/simulator/route.ts`; trả `404` khi tắt (làm T025 đạt)
- [ ] T039 [P] [US1] Tạo dữ liệu webhook mẫu tự tạo trong `tests/fixtures/facebook/` (gồm tin `is_echo` và phản hồi API hồ sơ người dùng) và contract test `tests/contract/facebook.test.ts` theo bảo đảm hành vi 1–8 (gồm ba trường hợp thời hạn: trong 24 giờ không thẻ; 24 giờ–7 ngày có thẻ `HUMAN_AGENT` khi `META_HUMAN_AGENT=true` và `window_expired` khi tắt; quá 7 ngày `window_expired`); trước đó đối chiếu định dạng với tài liệu Messenger Platform chính thức của Meta (research.md R1)
- [ ] T040 [US1] Cài đặt phần dùng chung của Meta trong `src/server/channels/meta.ts` (kiểm tra chữ ký `X-Hub-Signature-256`, bước xác minh webhook, gọi Graph API, nhận diện echo, lấy hồ sơ người dùng, chọn thẻ `HUMAN_AGENT` theo thời hạn và `META_HUMAN_AGENT`) và adapter Facebook trong `src/server/channels/facebook.ts` (`replyWindowHours` = 24, hoặc 168 khi `META_HUMAN_AGENT=true`; ánh xạ lỗi quá thời hạn → `window_expired`, token hết hạn → `disconnected`); đăng ký trong `src/server/channels/registry.ts` (làm T039 đạt)
- [ ] T041 [P] [US1] Tạo dữ liệu mẫu trong `tests/fixtures/instagram/` và contract test `tests/contract/instagram.test.ts` theo bảo đảm hành vi 1–8; đối chiếu với tài liệu Instagram Messaging chính thức của Meta
- [ ] T042 [US1] Cài đặt adapter Instagram trong `src/server/channels/instagram.ts` dùng `src/server/channels/meta.ts`; đăng ký trong `src/server/channels/registry.ts` (làm T041 đạt)
- [ ] T043 [P] [US1] Tạo dữ liệu mẫu trong `tests/fixtures/zalo/` (gồm sự kiện OA gửi tin và phản hồi API thông tin người dùng) và contract test `tests/contract/zalo.test.ts` theo bảo đảm hành vi 1–7; trước đó đọc developers.zalo.me để chốt tên sự kiện webhook, cách ký, thời hạn trả lời, hạn mức và API ảnh đại diện (research.md R1 ghi các nguồn mâu thuẫn 48 giờ / 7 ngày)
- [ ] T044 [US1] Cài đặt adapter Zalo OA trong `src/server/channels/zalo.ts` (`replyWindowHours` theo kết quả xác minh ở T043; giới hạn văn bản 2000 ký tự → `rejected`; vượt hạn mức → `rate_limited`; làm mới access token; nhận diện echo; lấy tên và ảnh đại diện); đăng ký trong `src/server/channels/registry.ts` (làm T043 đạt)

**Checkpoint**: Hộp thư chung chạy được với kênh giả lập và sẵn sàng nối Facebook, Instagram, Zalo thật

---

## Phase 4: User Story 2 - Thêm nhân viên bằng Gmail (Priority: P2)

**Goal**: Chủ thêm và gỡ nhân viên bằng địa chỉ Gmail; nhân viên dùng 4 mục nhưng không vào được
trang Nhân viên và trang Kênh; gỡ có hiệu lực ngay.

**Independent Test**: Chủ thêm một Gmail, người đó đăng nhập và trả lời được tin nhắn; Gmail chưa
thêm bị từ chối; gỡ thì bị đăng xuất trong 5 giây (quickstart.md kịch bản 2).

### Tests for User Story 2 ⚠️

- [ ] T045 [P] [US2] Integration test trong `tests/integration/users.test.ts`: chủ thêm email (lưu chữ thường); email đang hoạt động trả `409`; thêm lại email đã gỡ thì kích hoạt lại; nhân viên gọi POST/DELETE nhận `403`; gỡ đặt `active = false`, xoá mọi `Session`, bỏ gán các cuộc trò chuyện đang phụ trách, giữ nguyên `sentByUserId` và `doneByUserId`; phiên của người vừa bị gỡ nhận `401` ở yêu cầu kế tiếp; người vừa được thêm qua `canSignIn` được vào; gỡ chủ trả `400`
- [ ] T046 [P] [US2] E2E test trong `tests/e2e/staff.spec.ts` theo quickstart.md kịch bản 2: chủ thêm nhân viên; nhân viên thấy 4 mục, không thấy Cài đặt, mở thẳng `/settings/staff` và `/settings/channels` bị chặn; chủ gỡ thì trình duyệt nhân viên về `/login` trong 5 giây

### Implementation for User Story 2

- [ ] T047 [US2] Cài đặt thêm và gỡ nhân viên trong `src/server/auth/users.ts`: tạo hoặc kích hoạt lại `User` với `role = staff`; gỡ trong một giao dịch (đặt `active = false`, xoá `Session`, đặt `assigneeUserId = null`), rồi phát `session.revoked` cho người bị gỡ và `conversation.updated` cho các cuộc trò chuyện bị bỏ gán
- [ ] T048 [US2] Thêm POST vào `src/app/api/users/route.ts` (body `{ email }`, kiểm tra định dạng email) và tạo DELETE trong `src/app/api/users/[id]/route.ts`, cả hai dùng `requireOwner` (làm T045 đạt)
- [ ] T049 [US2] Dựng trang Nhân viên trong `src/app/(app)/settings/staff/page.tsx`: danh sách, ô nhập Gmail, nút gỡ có bước xác nhận, thông báo lỗi `409`
- [ ] T050 [US2] Chặn phía máy chủ cho khu vực chủ trong `src/app/(app)/settings/layout.tsx` (nhân viên bị chuyển về `/inbox`) và xử lý `session.revoked` trong `src/components/SessionWatcher.tsx` (đăng xuất và về `/login`), gắn vào `src/app/(app)/layout.tsx` (làm T046 đạt)

**Checkpoint**: Chủ giao được việc cho nhân viên và thu hồi được quyền ngay

---

## Phase 5: User Story 3 - Phân loại khách và theo dõi tiến độ 5 bước (Priority: P3)

**Goal**: Mỗi khách mới nhắn tin tự có hồ sơ học sinh (tên, ảnh đại diện, nguồn); hồ sơ thủ công
cho khách từ Threads, TikTok và nơi khác; 4 trạng thái có màu và bảng chú thích; 5 bước có tick,
thanh tiến độ, bộ lọc.

**Independent Test**: Gửi tin từ một khách mới, thấy khách tự có hồ sơ; tick 2 trong 5 bước, mở bằng
tài khoản khác và thấy đúng 2 bước đã xong (quickstart.md kịch bản 3).

### Tests for User Story 3 ⚠️

- [ ] T051 [P] [US3] Unit test trong `tests/unit/status.test.ts`: 4 trạng thái có đúng nhãn và màu (considering – "đang tham khảo" – đỏ; trialed – "đã học thử" – xanh lá; enrolled – "đã đăng ký" – xanh dương; dropped – "ngừng theo" – xám); danh sách 5 bước đúng thứ tự và nhãn; hàm tính tiến độ trả số bước xong trên 5; hàm chữ cái đầu của tên (ví dụ "Nguyễn Văn An" → "NA")
- [ ] T052 [P] [US3] Integration test trong `tests/integration/student-auto-create.test.ts`: tin đầu tiên của một cuộc trò chuyện mới tạo Student `considering`, `autoCreated = true`, `name = customerName`, `source` là tên kênh, `avatarPath` chép từ cuộc trò chuyện, và gắn vào; tin thứ hai cùng cuộc trò chuyện không tạo thêm; xoá học sinh rồi khách nhắn tiếp không tạo lại; tin đến cập nhật `lastActivityAt`; phát `student.updated`
- [ ] T053 [P] [US3] Integration test trong `tests/integration/students.test.ts`: tạo thủ công mặc định `considering`, `statusSource = manual`, `autoCreated = false`, lưu `source`; tên trống trả `400`; tạo kèm `conversationId` thì gắn luôn; gắn cuộc trò chuyện thứ hai vào cùng học sinh; gắn sang học sinh khác thì hồ sơ tự tạo cũ còn trống bị xoá và phát `student.deleted`, còn hồ sơ cũ có lịch, có bước đã tick, có cuộc trò chuyện khác hoặc tạo thủ công thì được giữ; PATCH `status` luôn ghi `statusSource = manual`; PATCH `source`; lọc `status`, `pendingStep`, `q`; danh sách trả `avatarUrl` dạng `/api/media/{name}`; xoá học sinh xoá TrialBooking, ClassAssignment, StepProgress và đặt `Conversation.studentId = null` nhưng giữ cuộc trò chuyện
- [ ] T054 [P] [US3] Integration test trong `tests/integration/steps.test.ts`: tick ghi `doneByUserId` và `doneAt`; bỏ tick đưa về chưa xong; tick không theo thứ tự được phép; bước không thuộc 5 bước trả `400`; chi tiết học sinh trả đủ 5 bước kể cả bước chưa có bản ghi
- [ ] T055 [P] [US3] E2E test trong `tests/e2e/steps.spec.ts` theo quickstart.md kịch bản 3: khách gửi tin từ `/dev/simulator` thì tự có hồ sơ (ảnh đại diện, nguồn, ô tên đỏ, 0/5); tạo thủ công "Khách B" nguồn "Threads" (chữ cái đầu, dòng nguồn); tick một bước (1/5); đổi sang "đã đăng ký" (ô tên xanh dương); bảng chú thích hiện đủ 4 màu; tài khoản thứ hai thấy cùng tiến độ

### Implementation for User Story 3

- [ ] T056 [P] [US3] Tạo hằng số nghiệp vụ trong `src/lib/status.ts` (nhãn và màu 4 trạng thái), `src/lib/steps.ts` (5 bước, nhãn tiếng Việt, hàm tính tiến độ) và `src/lib/initials.ts` (làm T051 đạt)
- [ ] T057 [US3] Cài đặt hồ sơ học sinh trong `src/server/students/students.ts`: tạo thủ công, danh sách có lọc và số bước xong, chi tiết (5 bước, buổi học thử, các khung học, các cuộc trò chuyện), sửa `name`/`source`/`note`/`status`, xoá, gắn và bỏ gắn cuộc trò chuyện kèm quy tắc xoá hồ sơ tự tạo còn trống của FR-012b; phát `student.updated`, `student.deleted`, `conversation.updated`
- [ ] T058 [US3] Cài đặt tự tạo hồ sơ trong `src/server/students/auto-create.ts`: đăng ký với `onNewConversation` của `src/server/inbox/receive.ts` để tạo Student theo data-model.md (mục Student, "Tự tạo"); cập nhật `lastActivityAt` khi có tin `inbound`; phát `student.updated` (làm T052 đạt)
- [ ] T059 [US3] Cài đặt tick bước trong `src/server/students/steps.ts`: `setStep(studentId, step, done, userId)` dùng upsert, và `autoTick(studentId, step)` chỉ tick khi bước đang chưa xong với `doneByUserId` trống (dùng cho US4, US5); phát `student.updated`
- [ ] T060 [US3] Tạo các route `src/app/api/students/route.ts` (GET, POST), `src/app/api/students/[id]/route.ts` (GET, PATCH, DELETE), `src/app/api/students/[id]/steps/[step]/route.ts` (PUT) (làm T053, T054 đạt)
- [ ] T061 [US3] Tạo route `src/app/api/conversations/[id]/student/route.ts` (PUT body `{ studentId | null }`, gọi quy tắc gắn của T057)
- [ ] T062 [P] [US3] Tạo các thành phần dùng chung `src/components/NameChip.tsx` (ô tên tô màu theo trạng thái, ảnh đại diện hoặc chữ cái đầu, tên, dòng nguồn để phân biệt khi trùng tên), `src/components/StatusLegend.tsx` (bảng chú thích 4 màu kèm tên trạng thái) và `src/components/ProgressBar.tsx` (5 bước, hiện số bước xong trên 5)
- [ ] T063 [US3] Dựng mục Các bước trong `src/app/(app)/steps/page.tsx` với `src/components/steps/StudentList.tsx` (ô tên, tiến độ tóm tắt, lọc theo trạng thái và theo bước chưa xong, tìm tên, nút tạo học sinh thủ công với ô tên và ô nguồn) và `src/components/steps/StudentDetail.tsx` (thanh tiến độ, 5 ô tick kèm người tick và thời điểm, chọn trạng thái, sửa tên, nguồn và ghi chú, xoá có xác nhận); hiện `StatusLegend`; cập nhật qua `use-events`
- [ ] T064 [US3] Thêm bảng học sinh vào mục Tin nhắn trong `src/components/inbox/StudentPanel.tsx` (hiện ô tên và tiến độ của hồ sơ đang gắn, gắn sang học sinh đã có kèm thông báo khi hồ sơ cũ bị xoá, bỏ gắn, tạo hồ sơ mới nếu cuộc trò chuyện chưa gắn) và gắn vào `src/app/(app)/inbox/page.tsx` (làm T055 đạt)

**Checkpoint**: Chủ xem được từng khách đang ở trạng thái và bước nào

---

## Phase 6: User Story 4 - Xếp lịch học thử bằng kéo thả (Priority: P4)

**Goal**: Lưới học thử theo từng tuần có ngày tháng; mỗi học sinh tối đa một buổi trên mọi tuần; danh
sách chưa xếp gồm mọi học sinh chưa có buổi, tìm được theo tên; tự tick bước; tự chuyển "đã học
thử" khi buổi trôi qua.

**Independent Test**: Kéo một học sinh đỏ vào một khung, kéo sang khung khác và chỉ còn ở khung mới;
khung trôi qua thì ô tên xanh lá; chuyển lại "đang tham khảo" bằng tay thì giữ đỏ (quickstart.md
kịch bản 4).

**Depends on**: US3 (học sinh, `NameChip`, `StatusLegend`, `autoTick`)

### Tests for User Story 4 ⚠️

- [ ] T065 [P] [US4] Unit test trong `tests/unit/slots.test.ts`: 4 khung S1 09–11, S2 14–16, S3 18–20, S4 20–22; 6 ngày thứ 2–thứ 7; `weekStart(date)` trả thứ 2 của tuần theo `Asia/Ho_Chi_Minh`; `slotEnd(date, slot)` trả đúng thời điểm UTC (ví dụ S4 kết thúc 22:00 giờ Việt Nam = 15:00 UTC); Chủ nhật bị từ chối
- [ ] T066 [P] [US4] Integration test trong `tests/integration/trial-schedule.test.ts`: PUT tạo buổi; PUT lần hai (cùng tuần hoặc khác tuần) chuyển buổi và không bao giờ có hai bản ghi; hai PUT đồng thời vẫn chỉ còn một buổi; `date` là Chủ nhật trả `400`; DELETE gỡ buổi và không đổi trạng thái học sinh (kể cả học sinh `trialed` nguồn `auto`); GET theo `week` trả đúng buổi của tuần; danh sách chưa xếp gồm mọi học sinh chưa có buổi (mọi trạng thái, tự tạo và thủ công), `lastActivityAt` mới nhất trước, lọc được bằng `q`; tạo buổi đầu tiên tự tick `trial_scheduled`; gỡ buổi không tự bỏ tick; chuyển buổi đặt lại `autoMarkedAt` về trống; PUT vào khung đã qua chuyển `considering → trialed` ngay trong cùng yêu cầu
- [ ] T067 [P] [US4] Integration test cho tác vụ tự chuyển trong `tests/integration/trial-auto-mark.test.ts` dùng `setTestNow`: trước giờ kết thúc không đổi; sau giờ kết thúc `considering → trialed` với `statusSource = auto` và ghi `autoMarkedAt`; học sinh `enrolled` hoặc `dropped` không bị đổi nhưng buổi vẫn được ghi `autoMarkedAt`; chuyển tay về `considering` rồi chạy lại thì giữ `considering`; học sinh `trialed` nguồn `auto` được xếp lại sang tương lai thì về `considering`, nguồn `manual` thì giữ `trialed`
- [ ] T068 [P] [US4] Unit test trong `tests/unit/scheduler.test.ts` với đồng hồ giả của Vitest: `startEveryMinute(fn)` gọi `fn` mỗi 60 giây; một lần `fn` ném lỗi thì lần sau vẫn chạy; `stop()` dừng hẳn
- [ ] T069 [P] [US4] E2E test trong `tests/e2e/trial-schedule.spec.ts` theo quickstart.md kịch bản 4: lưới 6 cột có ngày tháng và 4 hàng; danh sách chưa xếp có ảnh đại diện, tìm theo tên; kéo thả vào khung; chuyển tuần; kéo ở tuần sau thì biến mất khỏi tuần này; kéo về danh sách chưa xếp thì gỡ; bước "xếp lịch học thử" tự tick; thả vào khung đã qua thì ô tên xanh lá ngay

### Implementation for User Story 4

- [ ] T070 [P] [US4] Tạo `src/lib/slots.ts`: định nghĩa khung và ngày, `weekStart`, `weekDates`, `slotEnd`, kiểm tra ngày hợp lệ, tất cả theo `Asia/Ho_Chi_Minh` (làm T065 đạt)
- [ ] T071 [US4] Cài đặt tác vụ tự chuyển trong `src/server/schedule/auto-mark.ts`: `markBooking(tx, booking, now)` áp dụng quy tắc cho một buổi (nếu `slotEnd <= now` và `autoMarkedAt` trống: ghi `autoMarkedAt`, chuyển học sinh đang `considering` sang `trialed` với `statusSource = auto`), và `runAutoMark(now)` gọi `markBooking` cho mọi buổi đến hạn; phát `student.updated` (làm T067 đạt)
- [ ] T072 [US4] Cài đặt lịch học thử trong `src/server/schedule/trial.ts`: `setTrial(studentId, date, slot)` dùng upsert trên `studentId`, đặt lại `autoMarkedAt`, gọi `autoTick('trial_scheduled')` khi tạo mới, đưa học sinh `trialed` nguồn `auto` về `considering` khi thời điểm mới ở tương lai, và gọi `markBooking` trong cùng giao dịch khi khung đã qua; `removeTrial` không đổi trạng thái; `getWeek(weekStart, q)` trả buổi trong tuần và danh sách chưa xếp theo FR-017; phát `trial-schedule.updated` và `student.updated`
- [ ] T073 [US4] Tạo `src/server/schedule/scheduler.ts` (`startEveryMinute(fn)` bắt lỗi từng lần chạy, trả `stop()`) (làm T068 đạt) và khởi động trong `src/instrumentation.ts` (gọi `runAutoMark(clock.now())`, chỉ chạy ở runtime Node, không chạy trong test)
- [ ] T074 [US4] Tạo các route `src/app/api/trial-schedule/route.ts` (GET, tham số `week=YYYY-MM-DD` phải là thứ 2, `q` tuỳ chọn) và `src/app/api/students/[id]/trial/route.ts` (PUT, DELETE) (làm T066 đạt)
- [ ] T075 [US4] Tạo lưới kéo thả dùng chung bằng dnd-kit trong `src/components/schedule/ScheduleGrid.tsx` (6 cột × 4 hàng, tiêu đề cột tuỳ biến, mỗi ô cuộn được và hiện số lượng, nhận `NameChip`) và `src/components/schedule/UnscheduledList.tsx` (danh sách chưa xếp với `NameChip` có ảnh đại diện và dòng nguồn, ô tìm theo tên, cuộn được, cũng là vùng thả để gỡ)
- [ ] T076 [US4] Dựng mục Lịch: học thử trong `src/app/(app)/trial-schedule/page.tsx`: mở tuần hiện tại, nút tuần trước / tuần sau, tiêu đề cột có ngày tháng, `StatusLegend`, cập nhật lạc quan khi thả và hoàn tác nếu máy chủ báo lỗi, cập nhật qua `use-events` (làm T069 đạt)

**Checkpoint**: Xếp và theo dõi buổi học thử hoàn chỉnh; ô tên tự chuyển xanh lá

---

## Phase 7: User Story 5 - Xếp lịch học chính thức bằng kéo thả (Priority: P5)

**Goal**: Lưới tuần lặp lại, không gắn ngày; một học sinh ở nhiều khung; danh sách chưa xếp gồm mọi
học sinh chưa có khung; tự tick bước "xếp lịch học thật".

**Independent Test**: Kéo một học sinh vào 3 khung, thấy ở cả 3; gỡ một khung, 2 khung còn lại giữ
nguyên (quickstart.md kịch bản 5).

**Depends on**: US3 (học sinh, `autoTick`), US4 (`src/lib/slots.ts`, `ScheduleGrid`, `UnscheduledList`)

### Tests for User Story 5 ⚠️

- [ ] T077 [P] [US5] Integration test trong `tests/integration/class-schedule.test.ts`: PUT thêm khung; PUT lặp lại cùng khung không tạo bản ghi thứ hai và không báo lỗi; một học sinh có nhiều khung; DELETE chỉ gỡ đúng một khung; `weekday` ngoài 1–6 hoặc `slot` sai trả `400`; khung đầu tiên tự tick `class_scheduled`; thao tác ở đây không thay đổi `TrialBooking`; GET trả toàn bộ lưới và danh sách chưa xếp gồm mọi học sinh chưa có khung nào, `lastActivityAt` mới nhất trước, lọc được bằng `q`
- [ ] T078 [P] [US5] E2E test trong `tests/e2e/class-schedule.spec.ts` theo quickstart.md kịch bản 5: kéo vào 3 khung; thả lại vào khung đã có không nhân đôi; gỡ một khung; màu ô tên đúng trạng thái; cột không có ngày tháng

### Implementation for User Story 5

- [ ] T079 [US5] Cài đặt lịch xếp học trong `src/server/schedule/classes.ts`: `addSlot` (upsert, gọi `autoTick('class_scheduled')` khi là khung đầu tiên), `removeSlot`, `getGrid(q)` kèm danh sách chưa xếp theo FR-017; phát `class-schedule.updated` và `student.updated`
- [ ] T080 [US5] Tạo các route `src/app/api/class-schedule/route.ts` (GET, `q` tuỳ chọn) và `src/app/api/students/[id]/class-slots/[weekday]/[slot]/route.ts` (PUT, DELETE) (làm T077 đạt)
- [ ] T081 [US5] Dựng mục Lịch: xếp lịch học trong `src/app/(app)/class-schedule/page.tsx` dùng `ScheduleGrid` và `UnscheduledList`: kéo từ danh sách hoặc từ khung khác đều là thêm khung (không chuyển), nút gỡ trên từng ô tên trong khung, `StatusLegend`, cập nhật qua `use-events` (làm T078 đạt)

**Checkpoint**: Cả hai lịch hoạt động độc lập với nhau

---

## Phase 8: User Story 6 - Tra cứu Q&A khi trả lời khách (Priority: P6)

**Goal**: Chủ soạn các cặp hỏi–đáp; nhân viên tìm theo từ khoá và sao chép câu trả lời.

**Independent Test**: Chủ thêm một cặp hỏi–đáp; nhân viên tìm thấy bằng từ khoá và sao chép được
(quickstart.md kịch bản 6).

### Tests for User Story 6 ⚠️

- [ ] T082 [P] [US6] Integration test trong `tests/integration/qa.test.ts`: chủ thêm, sửa, xoá; `question` hoặc `answer` trống trả `400`; nhân viên GET được nhưng POST/PATCH/DELETE nhận `403`; `q` khớp cả câu hỏi lẫn câu trả lời, không phân biệt hoa thường
- [ ] T083 [P] [US6] E2E test trong `tests/e2e/qa.spec.ts` theo quickstart.md kịch bản 6: chủ thêm một cặp; nhân viên tìm bằng từ khoá, bấm sao chép và dán được nội dung; nhân viên không thấy nút sửa/xoá

### Implementation for User Story 6

- [ ] T084 [US6] Cài đặt Q&A trong `src/server/qa/qa.ts` (danh sách có tìm kiếm, thêm, sửa, xoá; ghi `updatedByUserId`, `updatedAt`; phát `qa.updated`)
- [ ] T085 [US6] Tạo các route `src/app/api/qa/route.ts` (GET cho mọi người; POST dùng `requireOwner`) và `src/app/api/qa/[id]/route.ts` (PATCH, DELETE dùng `requireOwner`) (làm T082 đạt)
- [ ] T086 [US6] Dựng phần Q&A trong `src/components/steps/QaPanel.tsx` (ô tìm kiếm, danh sách hỏi–đáp, nút sao chép câu trả lời, form thêm/sửa/xoá chỉ hiện với chủ) và gắn vào `src/app/(app)/steps/page.tsx` (làm T083 đạt)

**Checkpoint**: Đủ cả 6 user story

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Việc liên quan nhiều user story và chuẩn bị đưa vào dùng thật

- [ ] T087 [P] E2E test hai trình duyệt trong `tests/e2e/realtime.spec.ts`: thay đổi lịch học thử, lịch xếp học, tick bước và tin nhắn mới ở trình duyệt A hiện ở trình duyệt B trong 5 giây mà không tải lại (SC-006); hai người cùng trả lời một cuộc trò chuyện thì lịch sử ghi đúng tên từng người
- [ ] T088 [P] Tạo `scripts/seed.ts` sinh dữ liệu giả lập 10 người dùng, 500 học sinh, 2000 cuộc trò chuyện, và `scripts/perf.ts` đo: (a) thời gian mở mục Tin nhắn, hai lịch và mục Các bước, mỗi mục phải dưới 2 giây (SC-009); (b) gửi dồn 200 webhook giả lập và đo thời gian từ lúc website nhận tới lúc phát `conversation.updated`, 95% phải dưới 1 phút (SC-001). Ghi kết quả vào `specs/001-unified-inbox-crm/quickstart.md`; thêm index trong `prisma/schema.prisma` nếu không đạt
- [ ] T089 [P] Tạo `Dockerfile` (build nhiều tầng, chạy `prisma migrate deploy` khi khởi động, một tiến trình) và `docker-compose.prod.yml` (ứng dụng + PostgreSQL + volume cho `UPLOAD_DIR`), với `ENABLE_SIMULATOR` tắt
- [ ] T090 [P] Viết `README.md`: mục đích, cài đặt cục bộ, biến môi trường (kể cả `META_HUMAN_AGENT`), chạy test, quy trình review theo `CONTRIBUTING.md`, triển khai, và hướng dẫn cho chủ dự án tạo ứng dụng Meta và Zalo, khai báo địa chỉ webhook `/api/webhooks/{platform}` (kể cả trường echo), nộp duyệt quyền nhắn tin và quyền "human agent"
- [ ] T091 Chạy toàn bộ `npm run lint`, `npm test`, `npm run test:e2e` và 6 kịch bản trong `specs/001-unified-inbox-crm/quickstart.md`; sửa mọi sai lệch, mỗi lỗi sửa kèm test tái hiện
- [ ] T092 Sau khi triển khai lên tên miền HTTPS: kết nối Trang Facebook và tài khoản Instagram thật, lặp lại quickstart.md kịch bản 1 với một tài khoản khách thử (kể cả trả lời từ ứng dụng gốc), nộp App Review của Meta gồm quyền nhắn tin và quyền "human agent"; khi được duyệt, bật `META_HUMAN_AGENT=true` và thử trả lời một khách sau 24 giờ; lặp lại với Zalo khi OA được duyệt; ghi kết quả và ngày vào `specs/001-unified-inbox-crm/research.md` mục R1

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: bắt đầu ngay; T001 trước mọi task khác; T007 cần T002
- **Foundational (Phase 2)**: sau Setup; CHẶN mọi user story
- **US1 (Phase 3)** và **US2 (Phase 4)**: sau Foundational; độc lập với nhau
- **US3 (Phase 5)**: sau Foundational; phần tự tạo hồ sơ (T052, T058) và bảng học sinh trong Tin nhắn (T061, T064) cần US1 (`onNewConversation`)
- **US4 (Phase 6)**: sau US3
- **US5 (Phase 7)**: sau US3 và US4 (dùng chung lưới kéo thả và `src/lib/slots.ts`)
- **US6 (Phase 8)**: sau Foundational; T086 gắn vào trang của US3 (T063)
- **Polish (Phase 9)**: sau các user story muốn đưa vào dùng

### User Story Dependencies

```text
Setup → Foundational ─┬─ US1 (P1) ──┐
                      ├─ US2 (P2)   ├─ US3 (P3) ── US4 (P4) ── US5 (P5)
                      └─────────────┘        └──── US6 (P6)
```

- **US1**: không phụ thuộc story khác; chỉ cung cấp điểm móc `onNewConversation`, không biết gì về học sinh
- **US2**: không phụ thuộc story khác; T048 sửa cùng file với T035 (`src/app/api/users/route.ts`)
- **US3**: phần hồ sơ thủ công và 5 bước test độc lập được; tự tạo hồ sơ tích hợp với US1 qua T058, T061, T064
- **US4**: cần học sinh và `autoTick` của US3
- **US5**: cần `ScheduleGrid`, `UnscheduledList`, `src/lib/slots.ts` của US4. Nếu muốn làm US5 trước US4, chuyển T070 và T075 lên đầu US5
- **US6**: service và route độc lập hoàn toàn; chỉ giao diện nằm trong trang Các bước

### Within Each User Story

- Test viết trước và phải THẤT BẠI trước khi cài đặt
- Service trước route; route trước giao diện
- Xong một story, chạy toàn bộ test rồi mới sang story kế tiếp
- Mỗi task hoặc nhóm task liên quan là một pull request riêng, qua review và CI rồi mới merge

### Parallel Opportunities

- Setup: T003, T004, T005, T006, T007 song song sau T002
- Foundational: T010, T011, T012 song song sau T009; T017, T018 song song sau T015
- Mỗi story: toàn bộ task test đánh dấu [P] viết song song
- US1: ba cặp adapter (T039–T040, T041–T042 sau T040, T043–T044) có thể giao cho người khác nhau sau T026
- Sau Foundational: US1 và US2 có thể làm song song bởi hai người
- Polish: T087, T088, T089, T090 song song

---

## Parallel Example: User Story 1

```bash
# Viết đồng thời toàn bộ test của User Story 1:
Task: "Contract test cho adapter giả lập trong tests/contract/simulator.test.ts"
Task: "Integration test cho luồng tin đến trong tests/integration/inbound.test.ts"
Task: "Integration test cho API cuộc trò chuyện trong tests/integration/conversations.test.ts"
Task: "Integration test cho API kênh trong tests/integration/channels.test.ts"
Task: "Integration test cho ảnh trong tests/integration/media.test.ts"
Task: "E2E test trong tests/e2e/inbox.spec.ts"

# Sau T026, viết đồng thời dữ liệu mẫu và contract test cho các nền tảng thật:
Task: "Dữ liệu mẫu và contract test Facebook trong tests/contract/facebook.test.ts"
Task: "Dữ liệu mẫu và contract test Instagram trong tests/contract/instagram.test.ts"
Task: "Dữ liệu mẫu và contract test Zalo trong tests/contract/zalo.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (kể cả cổng review và CI)
2. Phase 2: Foundational
3. Phase 3: User Story 1 đến hết T038 (hộp thư chạy với kênh giả lập)
4. **DỪNG và KIỂM CHỨNG**: quickstart.md kịch bản 1
5. T039–T042 (Facebook, Instagram), triển khai, nộp duyệt Meta sớm (kể cả "human agent") vì thời gian duyệt không kiểm soát được
6. T043–T044 (Zalo) làm sau cùng; kiểm chứng thật khi OA được duyệt

### Incremental Delivery

1. Setup + Foundational → nền sẵn sàng
2. US1 → hộp thư chung (MVP)
3. US2 → nhân viên vào làm việc được
4. US3 → mỗi khách tự có hồ sơ; theo dõi trạng thái và 5 bước
5. US4 → lịch học thử, tự chuyển xanh lá
6. US5 → lịch xếp học
7. US6 → Q&A
8. Polish → đưa vào dùng thật

### Parallel Team Strategy

1. Cả nhóm làm Setup + Foundational
2. Người A: US1; người B: US2 rồi US6 (service và route)
3. Khi US1 xong: người A làm US3 → US4 → US5; người B làm các adapter thật và Polish
4. Người A và B review pull request của nhau

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong
- Mọi pull request phải có test đi kèm thay đổi hành vi và được một người review duyệt (Hiến pháp)
- Không tắt, bỏ qua hay xoá test để thay đổi được thông qua (Hiến pháp, Nguyên tắc I)
- Miễn trừ test tự động đã nêu trong plan.md: file cấu hình (kể cả T007), migration sinh tự động, lời gọi tới nền tảng thật (thay bằng contract test với dữ liệu mẫu)
- Dữ liệu trong `tests/fixtures/` và `scripts/seed.ts` là dữ liệu tự tạo, không dùng tin nhắn hay ảnh của khách thật
- T039, T041, T043 có bước đối chiếu tài liệu chính thức của nền tảng: research.md dựa trên nguồn bên thứ ba

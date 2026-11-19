# Quy trình đóng góp

Áp dụng hiến pháp dự án (`.specify/memory/constitution.md`): code phải có test, và mọi thay đổi
phải qua review trước khi merge.

## Mỗi thay đổi

1. Tạo nhánh riêng từ `main`, ví dụ `001-unified-inbox-crm` hoặc `fix/ten-loi`.
2. Viết test trước cho thay đổi hành vi; sửa lỗi thì viết test tái hiện lỗi trước.
3. Chạy cục bộ: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
4. Mở pull request vào `main` theo mẫu `.github/pull_request_template.md`.
5. Chỉ merge khi CI đạt **và** có ít nhất một người review duyệt.

Không được:

- đẩy thẳng vào `main`;
- tắt, bỏ qua (`skip`) hoặc xoá test để thay đổi được thông qua;
- merge khi CI đỏ, kể cả khi gấp.

Code không test tự động được (file cấu hình, migration sinh tự động, lời gọi tới nền tảng thật)
phải nêu lý do miễn trừ trong mô tả pull request.

## Bật bảo vệ nhánh `main` trên GitHub

Sau khi đẩy repo lên GitHub, chủ repo vào **Settings → Branches → Add branch ruleset** (hoặc
"Branch protection rule") cho `main` và bật:

- **Require a pull request before merging**, với **Required approvals = 1**;
- **Require status checks to pass before merging**, chọn check `test` của workflow CI;
- **Do not allow bypassing the above settings**;
- chặn force push và xoá nhánh.

Kiểm chứng: thử `git push origin main` trực tiếp, GitHub phải từ chối.

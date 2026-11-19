# Feature Specification: Hộp thư hợp nhất và theo dõi tuyển sinh

**Feature Branch**: `001-unified-inbox-crm`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "tôi muốn tạo 1 website kết nối cả tin nhắn instagram, tin nhắn threads, tin nhắn facebook, tin nhắn tik tok và tin nhắn zalo vào cùng 1 chỗ. Ở đó tôi có thể thêm nhân viên vào bằng gmail. Họ sẽ vào trả lời, phân loại khách hàng và theo dõi tiến độ cho tôi. Ngoài mục tin nhắn (1), còn có mục Lịch : xếp lịch học (2) và Lịch : học thử (3). Lịch hiện cố định theo thứ 234567 và các khung giờ 9-11, 14-16, 18-20 và 20-22. Mỗi học sinh hiện lên như 1 ô tên, có thể kéo thả vào nhiều khung giờ khác nhau. Học thử thì chỉ 1 khung, còn xếp lịch học được xếp vào nhiều khung. Ô tên hiện xanh tức là đã học thử rồi, đang sẵn sàng chờ lớp, ô tên hiện đỏ là chưa học thử, đang tham khảo. Thêm 1 mục là Các bước (4) trong này có văn bản Q&A để nhân viên trả lời tin nhắn và hiện thanh tiến độ các bước cần làm với học sinh (xếp lịch học thử, xếp lịch học thật, làm test đầu vào, đóng học phí và ký cam kết). Bấm vào mỗi người đều sẽ hiện ra là đã đến bước nào. Nhân viên có thể tick vào từng bước ở mỗi khách để theo dõi tiến độ."

## Clarifications

### Session 2026-11-16

- Q: Lịch học thử là một lưới tuần duy nhất dùng lặp lại, hay mỗi tuần có một lưới riêng theo ngày cụ thể? → A: Lịch học thử theo từng tuần cụ thể (có ngày tháng, chuyển qua lại giữa các tuần); lịch xếp học là một lưới tuần lặp lại.
- Q: Ô tên của học sinh chuyển từ đỏ sang xanh ("đã học thử") bằng cách nào? → A: Tự động chuyển xanh khi buổi học thử đã xếp trôi qua; nhân viên sửa lại bằng tay nếu học sinh vắng.
- Q: Việc nhận tin nhắn từ các nền tảng và gửi câu trả lời về lại các nền tảng đó có hợp lệ với quy tắc "dữ liệu người dùng không được gửi ra ngoài" của hiến pháp không? → A: Chủ dự án bỏ quy tắc đó khỏi hiến pháp (v2.0.0): dữ liệu người dùng được phép gửi ra ngoài. Spec không còn ràng buộc cấm truyền dữ liệu ra bên ngoài; yêu cầu chỉ người có quyền mới xem được dữ liệu vẫn giữ nguyên.
- Q: Khi nhân viên "phân loại khách hàng", họ cần gắn thêm loại nào ngoài hai màu đỏ/xanh không? → A: Một danh sách trạng thái cố định, mỗi khách một trạng thái: đang tham khảo, đã học thử, đã đăng ký, ngừng theo. Mỗi trạng thái là một màu, có bảng chú thích màu bên cạnh.
- Q: Mỗi cuộc trò chuyện có cần được giao cho một nhân viên phụ trách không, hay mọi nhân viên cùng dùng chung một hộp thư? → A: Hộp thư chung, nhưng mỗi cuộc trò chuyện có thể gắn một người phụ trách (tự nhận hoặc chủ giao); ai cũng vẫn thấy và trả lời được, và lọc được "của tôi".
- Q: Sau khi tra cứu ở bước plan cho thấy Threads không có cách kết nối tin nhắn và TikTok chưa chắc chắn, bản đầu gồm những kênh nào? → A: Chỉ Facebook, Instagram và Zalo. Threads và TikTok nằm ngoài phạm vi bản đầu; nhân viên tự ghi chú khách đến từ TikTok hoặc Threads vào tên khách.

### Session 2026-11-19

- Q: Câu trả lời gửi từ website hiện thế nào trong ứng dụng gốc của kênh? → A: Câu trả lời gửi từ website lập tức hiện trong cuộc trò chuyện tương ứng trên ứng dụng gốc (Facebook, Instagram, Zalo). Câu trả lời nhân viên gõ thẳng trong ứng dụng gốc cũng được ghi vào lịch sử trên website, kèm nhãn "gửi từ ứng dụng gốc".
- Q: Danh sách học sinh chưa xếp trên hai lịch gồm những ai? → A: Mọi người đã nhắn tin cho trung tâm từ bất kỳ kênh nào đã kết nối (tự có hồ sơ, hiện tên và ảnh đại diện), cộng với người do nhân viên tự thêm và tự ghi nguồn (ví dụ Threads, TikTok).
- Q: Có xin quyền trả lời dài hạn ("human agent") của Meta để trả lời khách Facebook/Instagram sau 24 giờ không? → A: Có. Sau khi Meta duyệt, câu trả lời do nhân viên gõ được gửi trong 7 ngày kể từ tin cuối của khách; trước khi duyệt, giới hạn là 24 giờ.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trả lời tin nhắn từ mọi kênh ở một chỗ (Priority: P1)

Chủ trung tâm kết nối các tài khoản Facebook, Instagram và Zalo của mình vào website (Threads và
TikTok nằm ngoài phạm vi bản đầu). Từ đó, mọi tin nhắn khách gửi tới các kênh này hiện chung
trong mục **Tin nhắn**. Chủ hoặc nhân viên mở một cuộc trò chuyện, đọc lịch sử và trả lời ngay tại
đó; khách nhận được câu trả lời trên đúng kênh họ đã nhắn, và câu trả lời cũng hiện ngay trong ứng
dụng gốc của kênh.

**Why this priority**: Đây là lý do chính để có website: không phải mở nhiều ứng dụng và không bỏ
sót khách. Chỉ riêng phần này đã dùng được ngay.

**Independent Test**: Kết nối ít nhất một kênh, gửi một tin nhắn thử từ tài khoản khách, xác nhận
tin hiện trong mục Tin nhắn, trả lời từ website và xác nhận khách nhận được trên kênh gốc.

**Acceptance Scenarios**:

1. **Given** chủ đã kết nối một kênh, **When** khách gửi tin nhắn tới kênh đó, **Then** tin nhắn
   hiện trong mục Tin nhắn kèm tên và ảnh đại diện của khách, biểu tượng kênh nguồn và thời gian
   gửi.
2. **Given** một cuộc trò chuyện đang mở, **When** nhân viên gõ và gửi câu trả lời, **Then** khách
   nhận được câu trả lời trên đúng kênh gốc và câu trả lời hiện trong lịch sử kèm tên người gửi.
3. **Given** có tin nhắn từ nhiều kênh, **When** người dùng mở mục Tin nhắn, **Then** tất cả cuộc
   trò chuyện hiện trong một danh sách chung, cuộc có tin mới nhất ở trên, cuộc chưa đọc được đánh
   dấu rõ.
4. **Given** danh sách có nhiều cuộc trò chuyện, **When** người dùng lọc theo kênh hoặc tìm theo
   tên khách, **Then** danh sách chỉ hiện các cuộc phù hợp.
5. **Given** một kênh bị mất kết nối, **When** người dùng mở website, **Then** hệ thống cảnh báo
   kênh nào đang mất kết nối và hướng dẫn chủ kết nối lại.
6. **Given** một cuộc trò chuyện chưa có người phụ trách, **When** một nhân viên bấm nhận, **Then**
   tên nhân viên đó hiện là người phụ trách trên cuộc trò chuyện, với mọi người dùng.
7. **Given** một cuộc trò chuyện bất kỳ, **When** chủ chọn một nhân viên làm người phụ trách,
   **Then** người phụ trách được đổi sang nhân viên đó.
8. **Given** một cuộc trò chuyện đã có người phụ trách, **When** một nhân viên khác mở và trả lời,
   **Then** câu trả lời vẫn được gửi bình thường và người phụ trách không đổi.
9. **Given** một nhân viên phụ trách một số cuộc trò chuyện, **When** họ chọn bộ lọc "của tôi",
   **Then** danh sách chỉ hiện các cuộc trò chuyện họ phụ trách.
10. **Given** nhân viên vừa gửi câu trả lời từ website, **When** chủ mở cuộc trò chuyện đó trong
    ứng dụng gốc của kênh, **Then** câu trả lời đã có ở đó, đúng nội dung.
11. **Given** một kênh đã kết nối, **When** ai đó trả lời khách thẳng trong ứng dụng gốc của kênh,
    **Then** câu trả lời hiện trong lịch sử trên website kèm nhãn "gửi từ ứng dụng gốc", không bị
    nhân đôi, và câu trả lời gửi từ website cũng không bị nhân đôi.

---

### User Story 2 - Thêm nhân viên bằng Gmail (Priority: P2)

Chủ trung tâm nhập địa chỉ Gmail của nhân viên để cấp quyền. Nhân viên đăng nhập bằng chính tài
khoản Google đó và làm việc được ngay trong cả 4 mục. Chủ có thể gỡ quyền bất kỳ lúc nào.

**Why this priority**: Mục tiêu của chủ là giao việc trả lời và theo dõi cho nhân viên. Không có
phần này thì chỉ một mình chủ dùng được.

**Independent Test**: Chủ thêm một địa chỉ Gmail, người có Gmail đó đăng nhập và trả lời được tin
nhắn; một Gmail chưa được thêm thì bị từ chối.

**Acceptance Scenarios**:

1. **Given** chủ ở trang quản lý nhân viên, **When** chủ nhập một địa chỉ Gmail và xác nhận,
   **Then** địa chỉ đó xuất hiện trong danh sách nhân viên.
2. **Given** một Gmail đã được thêm, **When** người đó đăng nhập bằng tài khoản Google tương ứng,
   **Then** họ vào được website và thấy các mục Tin nhắn, Xếp lịch học, Học thử, Các bước.
3. **Given** một Gmail chưa được thêm, **When** người đó thử đăng nhập, **Then** hệ thống từ chối
   và không hiển thị bất kỳ dữ liệu nào.
4. **Given** một nhân viên đang có quyền, **When** chủ gỡ nhân viên đó, **Then** nhân viên mất
   quyền truy cập ngay, kể cả khi đang đăng nhập.
5. **Given** một nhân viên đã đăng nhập, **When** họ thử mở trang quản lý nhân viên hoặc trang kết
   nối kênh, **Then** hệ thống không cho phép.

---

### User Story 3 - Phân loại khách và theo dõi tiến độ 5 bước (Priority: P3)

Mỗi khách mới nhắn tin tới một kênh đã kết nối tự có một hồ sơ học sinh, mang tên và ảnh đại
diện của khách và ghi nguồn là kênh đó. Khách đến từ nơi khác (Threads, TikTok, giới thiệu...) được
nhân viên tạo hồ sơ thủ công và tự ghi nguồn. Mỗi học sinh có đúng một trong 4 trạng thái, mỗi
trạng thái một màu (đang tham khảo – đỏ; đã học thử, chờ lớp – xanh lá; đã đăng ký – xanh dương;
ngừng theo – xám), kèm bảng chú thích màu bên cạnh, và 5 bước cần làm: xếp lịch học thử, xếp lịch
học thật, làm test đầu vào, đóng học phí, ký cam kết. Trong mục **Các bước**, bấm vào một học sinh sẽ thấy thanh tiến
độ và đã đến bước nào; nhân viên tick từng bước khi hoàn thành.

**Why this priority**: Đây là cách chủ biết từng khách đang ở đâu mà không phải hỏi nhân viên. Phần
này cũng tạo ra danh sách học sinh mà hai mục Lịch cần dùng.

**Independent Test**: Gửi tin từ một khách mới, xác nhận khách tự có hồ sơ học sinh; tick 2 trong 5
bước, mở lại bằng tài khoản khác và thấy đúng 2 bước đã hoàn thành.

**Acceptance Scenarios**:

1. **Given** một khách chưa từng nhắn tin, **When** khách gửi tin đầu tiên tới một kênh đã kết nối,
   **Then** một hồ sơ học sinh tự được tạo với tên và ảnh đại diện của khách, nguồn là kênh đó,
   trạng thái "đang tham khảo" (đỏ), chưa bước nào hoàn thành, và gắn với cuộc trò chuyện đó.
2. **Given** mục Các bước đang mở, **When** nhân viên bấm vào một học sinh, **Then** hiện thanh
   tiến độ 5 bước, bước nào đã xong và bước nào chưa.
3. **Given** chi tiết một học sinh đang mở, **When** nhân viên tick một bước, **Then** bước đó
   được ghi là hoàn thành kèm người tick và thời điểm, và thanh tiến độ cập nhật ngay.
4. **Given** một bước đã tick nhầm, **When** nhân viên bỏ tick, **Then** bước trở lại chưa hoàn
   thành và thanh tiến độ cập nhật.
5. **Given** một khách nhắn qua hai kênh khác nhau, **When** nhân viên gắn cuộc trò chuyện thứ hai
   vào học sinh đã có, **Then** cả hai cuộc trò chuyện cùng thuộc một hồ sơ học sinh, và hồ sơ tự
   tạo thừa của cuộc trò chuyện thứ hai bị xoá nếu nó chưa có lịch, chưa tick bước nào và không
   gắn cuộc trò chuyện nào khác.
6. **Given** danh sách học sinh, **When** người dùng lọc theo trạng thái hoặc theo bước đang dừng,
   **Then** chỉ hiện các học sinh phù hợp.
7. **Given** chi tiết một học sinh đang mở, **When** nhân viên chọn một trạng thái khác trong 4
   trạng thái, **Then** trạng thái được lưu và ô tên đổi sang màu tương ứng ở mọi nơi nó xuất hiện.
8. **Given** người dùng đang ở mục Xếp lịch học, Học thử hoặc Các bước, **When** họ nhìn màn hình,
   **Then** có bảng chú thích hiện đủ 4 màu kèm tên trạng thái tương ứng.
9. **Given** một khách nhắn qua Threads (kênh chưa kết nối được), **When** nhân viên tạo hồ sơ thủ
   công với tên và nguồn "Threads", **Then** học sinh mới hiện ở trạng thái "đang tham khảo", có
   dòng nguồn "Threads" trên ô tên và xuất hiện trong danh sách chưa xếp của hai lịch.

---

### User Story 4 - Xếp lịch học thử bằng kéo thả (Priority: P4)

Mục **Lịch: học thử** hiện một lưới cố định: cột là thứ 2 đến thứ 7, hàng là 4 khung giờ 9–11,
14–16, 18–20, 20–22. Lưới này theo từng tuần cụ thể: mỗi cột ghi ngày tháng, mở ra ở tuần hiện tại
và nhân viên chuyển được sang tuần trước hoặc tuần sau. Mỗi học sinh là một ô tên. Nhân viên kéo ô
tên thả vào một khung để xếp buổi học thử; mỗi học sinh chỉ có một khung học thử, tính trên tất cả
các tuần. Khi buổi học thử đã xếp trôi qua (hết giờ kết thúc của khung), ô tên tự chuyển từ đỏ
("đang tham khảo") sang xanh lá ("đã học thử"); nếu học sinh vắng, nhân viên chuyển lại "đang tham
khảo" bằng tay.

**Why this priority**: Học thử là bước đầu tiên đưa khách thành học sinh và quyết định màu ô tên.

**Independent Test**: Kéo một học sinh đỏ vào khung thứ 3, 18–20; kéo tiếp sang khung khác và xác
nhận học sinh chỉ còn ở khung mới; khi khung đó trôi qua, xác nhận ô tên tự chuyển xanh lá; chuyển
lại "đang tham khảo" bằng tay và xác nhận ô tên giữ màu đỏ.

**Acceptance Scenarios**:

1. **Given** lịch học thử đang mở, **When** người dùng xem lưới, **Then** lưới hiện tuần hiện tại
   với đúng 6 ngày (thứ 2–thứ 7, kèm ngày tháng) và 4 khung giờ (9–11, 14–16, 18–20, 20–22), tổng
   24 ô, không có Chủ nhật.
2. **Given** một học sinh chưa có lịch học thử, **When** nhân viên kéo ô tên thả vào một khung,
   **Then** ô tên hiện trong khung đó và lịch được lưu.
3. **Given** một học sinh đã có khung học thử, **When** nhân viên kéo ô tên sang khung khác,
   **Then** học sinh chuyển sang khung mới và không còn ở khung cũ.
4. **Given** một học sinh đã có khung học thử, **When** nhân viên kéo ô tên ra khỏi lưới về danh
   sách chưa xếp, **Then** lịch học thử của học sinh bị gỡ.
5. **Given** một học sinh đỏ có buổi học thử đã xếp, **When** giờ kết thúc của khung đó trôi qua,
   **Then** ô tên tự chuyển xanh lá ở mọi nơi nó xuất hiện, không cần ai thao tác.
6. **Given** một học sinh chưa xếp lịch học thử, **When** nhân viên thả ô tên vào một khung,
   **Then** bước "xếp lịch học thử" của học sinh đó tự động được tick.
7. **Given** lịch học thử đang ở tuần hiện tại, **When** người dùng chuyển sang tuần sau hoặc tuần
   trước, **Then** lưới hiện ngày tháng và các học sinh đã xếp của tuần đó.
8. **Given** một học sinh đã có khung học thử ở tuần này, **When** nhân viên chuyển sang tuần sau
   và thả học sinh vào một khung, **Then** học sinh chỉ còn ở khung của tuần sau.
9. **Given** một học sinh đã tự chuyển xanh lá nhưng thực tế vắng buổi học thử, **When** nhân viên
   chuyển học sinh lại "đang tham khảo", **Then** ô tên trở lại đỏ và không tự chuyển xanh lá lại
   vì buổi học thử đã qua đó.
10. **Given** một học sinh vắng đã được chuyển lại "đang tham khảo", **When** nhân viên xếp lại buổi
    học thử vào một khung trong tương lai và khung đó trôi qua, **Then** ô tên tự chuyển xanh lá.
11. **Given** một học sinh đã tự chuyển "đã học thử", **When** nhân viên gỡ buổi học thử của học
    sinh đó, **Then** trạng thái giữ nguyên "đã học thử".
12. **Given** danh sách chưa xếp có nhiều học sinh, **When** nhân viên gõ một phần tên vào ô tìm,
    **Then** danh sách chỉ còn các học sinh có tên khớp.

---

### User Story 5 - Xếp lịch học chính thức bằng kéo thả (Priority: P5)

Mục **Lịch: xếp lịch học** dùng cùng lưới 6 ngày × 4 khung giờ. Khác với học thử, một học sinh có
thể được xếp vào nhiều khung (ví dụ thứ 2 và thứ 5, 18–20). Màu ô tên cho biết trạng thái của học
sinh theo bảng chú thích 4 màu.

**Why this priority**: Đây là bước cuối để gom học sinh chờ lớp thành lớp; cần có học sinh và trạng
thái học thử từ các phần trước mới có ý nghĩa.

**Independent Test**: Kéo một học sinh vào 3 khung khác nhau, xác nhận ô tên hiện ở cả 3; gỡ một
khung và xác nhận 2 khung còn lại không đổi.

**Acceptance Scenarios**:

1. **Given** lịch học đang mở, **When** nhân viên kéo một học sinh vào một khung, **Then** ô tên
   hiện trong khung đó và học sinh vẫn có thể được kéo tiếp vào khung khác.
2. **Given** một học sinh đã ở 2 khung, **When** nhân viên kéo học sinh vào khung thứ ba, **Then**
   ô tên hiện ở cả 3 khung.
3. **Given** một học sinh đã ở một khung, **When** nhân viên thả lại học sinh vào chính khung đó,
   **Then** ô tên không bị nhân đôi.
4. **Given** một học sinh ở nhiều khung, **When** nhân viên gỡ ô tên khỏi một khung, **Then** chỉ
   khung đó bị gỡ, các khung khác giữ nguyên.
5. **Given** lưới có học sinh ở nhiều trạng thái khác nhau, **When** người dùng xem, **Then** mỗi ô
   tên có màu đúng với trạng thái của học sinh theo bảng chú thích màu bên cạnh lưới.
6. **Given** một học sinh chưa có khung học nào, **When** nhân viên xếp khung đầu tiên, **Then**
   bước "xếp lịch học thật" của học sinh đó tự động được tick.

---

### User Story 6 - Tra cứu Q&A khi trả lời khách (Priority: P6)

Mục **Các bước** có phần văn bản Q&A: các câu hỏi khách hay hỏi và câu trả lời mẫu. Chủ soạn và cập
nhật nội dung; nhân viên tìm, đọc và sao chép câu trả lời để dùng khi nhắn với khách.

**Why this priority**: Giúp nhân viên trả lời nhanh và thống nhất, nhưng các phần khác vẫn hoạt
động được khi chưa có.

**Independent Test**: Chủ thêm một cặp hỏi–đáp; nhân viên tìm thấy bằng từ khoá và sao chép được
câu trả lời.

**Acceptance Scenarios**:

1. **Given** chủ ở phần Q&A, **When** chủ thêm, sửa hoặc xoá một cặp hỏi–đáp, **Then** thay đổi
   hiện ngay với mọi nhân viên.
2. **Given** nhân viên ở phần Q&A, **When** họ gõ từ khoá, **Then** hiện các cặp hỏi–đáp chứa từ
   khoá đó.
3. **Given** nhân viên đang xem một câu trả lời mẫu, **When** họ chọn sao chép, **Then** nội dung
   sẵn sàng để dán vào ô trả lời tin nhắn.
4. **Given** nhân viên ở phần Q&A, **When** họ thử sửa hoặc xoá nội dung, **Then** hệ thống không
   cho phép.

---

### Edge Cases

- Hai nhân viên cùng trả lời một cuộc trò chuyện: cả hai câu trả lời đều được gửi, lịch sử ghi rõ
  ai gửi câu nào, và người thứ hai thấy câu trả lời của người thứ nhất ngay khi nó được gửi.
- Hai nhân viên cùng kéo một học sinh trên lịch học thử: thao tác sau cùng thắng, cả hai màn hình
  đều hiện kết quả cuối cùng.
- Gửi câu trả lời thất bại (kênh mất kết nối, kênh từ chối vì quá thời hạn được phép trả lời):
  tin nhắn được đánh dấu "gửi thất bại" kèm lý do, không bị mất và có thể gửi lại.
- Thời hạn trả lời trên Facebook và Instagram: 24 giờ kể từ tin cuối của khách; sau khi Meta duyệt
  quyền "human agent", câu trả lời do nhân viên gõ gửi được tới 7 ngày. Quá hạn thì gửi thất bại
  kèm lý do.
- Một khách nhắn qua hai kênh: mỗi kênh tự tạo một hồ sơ; nhân viên gắn cuộc trò chuyện thứ hai vào
  hồ sơ đã có, hồ sơ thừa bị xoá nếu còn trống (US3 kịch bản 5).
- Khách không có ảnh đại diện hoặc nền tảng không cho lấy ảnh: ô tên hiện chữ cái đầu của tên.
- Xoá hồ sơ học sinh tự tạo: tin mới trong cùng cuộc trò chuyện không tạo lại hồ sơ.
- Khách gửi ảnh, video, ghi âm, sticker: hiện được ảnh; với loại nội dung không hiển thị được,
  hiện ghi chú loại nội dung để nhân viên biết mở kênh gốc xem.
- Một khung giờ có rất nhiều học sinh: mọi ô tên vẫn xem được (cuộn trong khung) và hiện số lượng.
- Hai học sinh trùng tên: phân biệt được bằng ảnh đại diện và dòng nguồn trên ô tên.
- Học sinh vắng buổi học thử nhưng ô tên đã tự chuyển xanh lá: nhân viên chuyển lại đỏ bằng tay, và ô
  tên giữ màu đỏ cho tới khi một buổi học thử mới trôi qua.
- Học sinh đã học thử ở nơi khác hoặc trước khi dùng website (không có buổi nào trên lịch): nhân
  viên chuyển "đã học thử" bằng tay.
- Buổi học thử được xếp vào một khung đã qua (ví dụ ghi bù): ô tên chuyển xanh lá ngay khi thả.
- Gỡ một nhân viên: các câu trả lời và các bước họ đã tick vẫn giữ nguyên tên người thực hiện; các
  cuộc trò chuyện họ đang phụ trách trở về trạng thái chưa có ai phụ trách.
- Xoá hồ sơ học sinh: học sinh biến mất khỏi cả hai lịch và mục Các bước; các cuộc trò chuyện vẫn
  còn trong mục Tin nhắn.
- Tick bước không theo thứ tự (ví dụ đóng học phí trước khi làm test): được phép.

## Requirements *(mandatory)*

### Functional Requirements

**Tin nhắn**

- **FR-001**: Chủ MUST kết nối và ngắt kết nối được các tài khoản kinh doanh của mình trên
  Facebook, Instagram và Zalo.
- **FR-002**: Hệ thống MUST nhận tin nhắn khách gửi tới các kênh đã kết nối và hiện trong một danh
  sách chung, mỗi cuộc trò chuyện ghi rõ kênh nguồn.
- **FR-003**: Người dùng MUST trả lời được từ website, và câu trả lời MUST đến khách trên đúng kênh
  gốc của cuộc trò chuyện, đồng thời hiện trong cuộc trò chuyện đó trên ứng dụng gốc của kênh.
- **FR-004**: Hệ thống MUST lưu lịch sử mỗi cuộc trò chuyện kể từ lúc kênh được kết nối, gồm nội
  dung, thời gian và người gửi (khách, tên nhân viên, hoặc "gửi từ ứng dụng gốc").
- **FR-004a**: Câu trả lời gửi thẳng trong ứng dụng gốc của kênh MUST được ghi vào lịch sử với nhãn
  "gửi từ ứng dụng gốc"; mỗi tin MUST chỉ xuất hiện một lần, kể cả tin gửi từ website mà nền tảng
  báo lại.
- **FR-004b**: Hệ thống MUST hiện ảnh đại diện của khách khi nền tảng cung cấp, và chữ cái đầu của
  tên khi không có.
- **FR-005**: Hệ thống MUST đánh dấu cuộc trò chuyện chưa đọc và sắp xếp theo tin nhắn mới nhất.
- **FR-006**: Người dùng MUST lọc được cuộc trò chuyện theo kênh, theo trạng thái đã đọc/chưa đọc,
  theo người phụ trách ("của tôi", chưa có ai phụ trách), và tìm được theo tên khách.
- **FR-006a**: Mỗi cuộc trò chuyện MUST có tối đa một người phụ trách. Nhân viên MUST tự nhận và
  tự bỏ nhận được; chủ MUST giao và đổi được người phụ trách cho bất kỳ cuộc trò chuyện nào.
- **FR-006b**: Người phụ trách chỉ là thông tin theo dõi: mọi người dùng MUST vẫn thấy và trả lời
  được mọi cuộc trò chuyện, bất kể ai phụ trách.
- **FR-007**: Hệ thống MUST báo rõ khi một tin nhắn gửi thất bại và cho phép gửi lại.
- **FR-007a**: Với Facebook và Instagram, hệ thống MUST cho gửi câu trả lời trong 24 giờ kể từ tin
  cuối của khách, và trong 7 ngày khi quyền "human agent" của Meta đã được duyệt và bật.
- **FR-008**: Hệ thống MUST cảnh báo khi một kênh mất kết nối.

**Nhân viên và quyền truy cập**

- **FR-009**: Người dùng MUST đăng nhập bằng tài khoản Google; chỉ chủ và các địa chỉ Gmail đã
  được chủ thêm mới vào được.
- **FR-010**: Chủ MUST thêm và gỡ được nhân viên bằng địa chỉ Gmail; việc gỡ có hiệu lực ngay.
- **FR-011**: Nhân viên MUST dùng được cả 4 mục (Tin nhắn, Xếp lịch học, Học thử, Các bước) nhưng
  MUST NOT quản lý nhân viên, kết nối/ngắt kênh, hoặc sửa nội dung Q&A.

**Học sinh và phân loại**

- **FR-012**: Hệ thống MUST tự tạo một hồ sơ học sinh cho mỗi cuộc trò chuyện mới, với tên và ảnh
  đại diện của khách, nguồn là kênh của cuộc trò chuyện, và gắn hồ sơ với cuộc trò chuyện đó.
- **FR-012a**: Người dùng MUST tạo được hồ sơ học sinh thủ công với tên và nguồn tự ghi (ví dụ
  "Threads", "TikTok").
- **FR-012b**: Người dùng MUST gắn được nhiều cuộc trò chuyện vào cùng một học sinh. Khi một cuộc
  trò chuyện được gắn sang học sinh khác, hồ sơ tự tạo cũ của nó MUST bị xoá nếu hồ sơ đó không còn
  cuộc trò chuyện nào, chưa có lịch và chưa tick bước nào; ngược lại hồ sơ cũ được giữ.
- **FR-013**: Mỗi học sinh MUST có đúng một trong 4 trạng thái cố định, mỗi trạng thái một màu:
  "đang tham khảo" (chưa học thử – đỏ), "đã học thử" (chờ lớp – xanh lá), "đã đăng ký" (xanh
  dương), "ngừng theo" (xám); học sinh mới mặc định là "đang tham khảo". Người dùng không thêm,
  bớt hay đổi tên trạng thái.
- **FR-013a**: Ô tên của học sinh MUST hiện màu của trạng thái hiện tại ở mọi nơi nó xuất hiện, và
  các mục Xếp lịch học, Học thử, Các bước MUST có bảng chú thích màu hiện đủ 4 màu kèm tên trạng
  thái.
- **FR-014**: Hệ thống MUST tự chuyển học sinh từ "đang tham khảo" sang "đã học thử" khi giờ kết
  thúc của buổi học thử đã xếp trôi qua. Việc tự chuyển này MUST NOT áp dụng cho học sinh đang ở
  trạng thái "đã đăng ký" hoặc "ngừng theo".
- **FR-014a**: Người dùng MUST chuyển được học sinh sang bất kỳ trạng thái nào trong 4 trạng thái
  bằng tay. Sau khi được chuyển lại "đang tham khảo" bằng tay, học sinh MUST NOT tự chuyển sang
  "đã học thử" lại vì cùng buổi học thử đã qua đó; chỉ một buổi học thử mới được xếp và trôi qua
  mới làm học sinh tự chuyển lần nữa.
- **FR-014b**: Khi một học sinh đang ở "đã học thử" do tự động chuyển được xếp lại sang một buổi
  học thử trong tương lai, học sinh MUST trở lại "đang tham khảo" cho tới khi buổi mới trôi qua.
  Gỡ buổi học thử MUST NOT đổi trạng thái của học sinh.
- **FR-015**: Người dùng MUST sửa được tên, nguồn và ghi chú của học sinh, và xoá được hồ sơ học
  sinh.

**Lịch**

- **FR-016**: Cả hai lịch MUST hiện lưới cố định gồm thứ 2 đến thứ 7 và 4 khung giờ 9–11, 14–16,
  18–20, 20–22; người dùng không thêm, bớt hay sửa ngày và khung giờ.
- **FR-016a**: Lịch học thử MUST theo từng tuần cụ thể: hiện ngày tháng của từng cột, mặc định mở
  tuần hiện tại, và cho phép chuyển sang tuần trước/tuần sau. Lịch xếp học MUST là một lưới tuần
  duy nhất lặp lại, không gắn ngày tháng.
- **FR-017**: Mỗi học sinh MUST hiện là một ô tên kéo thả được, gồm ảnh đại diện (hoặc chữ cái
  đầu), tên và dòng nguồn. Mỗi lịch MUST có danh sách chưa xếp gồm mọi học sinh chưa có chỗ trên
  lịch đó (lịch học thử: chưa có buổi học thử; lịch xếp học: chưa có khung nào), bất kể kênh nguồn
  hay trạng thái, sắp xếp người có hoạt động gần nhất lên trước và tìm được theo tên.
- **FR-018**: Trên lịch học thử, mỗi học sinh MUST có tối đa một khung tính trên tất cả các tuần;
  thả vào khung mới (cùng tuần hoặc khác tuần) sẽ chuyển học sinh khỏi khung cũ.
- **FR-019**: Trên lịch xếp học, một học sinh MUST được xếp vào nhiều khung khác nhau, và không
  xuất hiện quá một lần trong cùng một khung.
- **FR-020**: Người dùng MUST gỡ được học sinh khỏi một khung trên cả hai lịch.
- **FR-021**: Lịch học thử và lịch xếp học MUST độc lập: xếp ở lịch này không thay đổi lịch kia.
- **FR-022**: Mọi thay đổi trên lịch MUST được lưu ngay và hiện với những người dùng khác mà họ
  không phải tải lại trang.

**Các bước và Q&A**

- **FR-023**: Mỗi học sinh MUST có 5 bước cố định: xếp lịch học thử, xếp lịch học thật, làm test
  đầu vào, đóng học phí, ký cam kết.
- **FR-024**: Bấm vào một học sinh MUST hiện thanh tiến độ cho biết bước nào đã xong, bước nào
  chưa, và số bước đã xong trên tổng số 5.
- **FR-025**: Người dùng MUST tick và bỏ tick được từng bước, theo bất kỳ thứ tự nào; hệ thống MUST
  ghi lại ai tick và khi nào.
- **FR-026**: Hệ thống MUST tự tick bước "xếp lịch học thử" khi học sinh được xếp vào lịch học thử
  và bước "xếp lịch học thật" khi học sinh được xếp khung học đầu tiên; người dùng vẫn bỏ tick
  bằng tay được.
- **FR-027**: Danh sách học sinh trong mục Các bước MUST hiện tiến độ tóm tắt của từng người và lọc
  được theo trạng thái và theo bước chưa hoàn thành.
- **FR-028**: Chủ MUST thêm, sửa, xoá được các cặp hỏi–đáp trong phần Q&A; nhân viên MUST xem, tìm
  theo từ khoá và sao chép được câu trả lời.

**Bảo vệ dữ liệu**

- **FR-029**: Người chưa đăng nhập hoặc không có quyền MUST NOT xem được bất kỳ dữ liệu khách hàng
  hay học sinh nào, kể cả ảnh khách gửi và ảnh đại diện.

### Key Entities *(include if feature involves data)*

- **Người dùng**: Chủ hoặc nhân viên; định danh bằng địa chỉ Gmail; có vai trò (chủ / nhân viên)
  và trạng thái còn quyền hay đã gỡ.
- **Kênh kết nối**: Một tài khoản kinh doanh trên Facebook, Instagram hoặc Zalo;
  có trạng thái đang kết nối / mất kết nối.
- **Cuộc trò chuyện**: Chuỗi tin nhắn giữa một khách và trung tâm trên một kênh; có trạng thái đã
  đọc/chưa đọc; tên và ảnh đại diện của khách; có thể gắn với một học sinh; có tối đa một người
  phụ trách.
- **Tin nhắn**: Một tin trong cuộc trò chuyện; có nội dung, thời gian, chiều (khách gửi / trung tâm
  gửi), người gửi phía trung tâm (nhân viên, hoặc "ứng dụng gốc"), trạng thái gửi.
- **Học sinh**: Hồ sơ một khách hàng tiềm năng hoặc học sinh; có tên, ảnh đại diện, nguồn (kênh tự
  ghi, hoặc do nhân viên ghi), ghi chú, một trong 4 trạng thái (đang tham khảo, đã học thử, đã đăng
  ký, ngừng theo); tự tạo hoặc tạo thủ công; gắn với không, một hoặc nhiều cuộc trò chuyện.
- **Khung lịch**: Một trong 24 ô cố định (6 ngày × 4 khung giờ).
- **Xếp lịch học thử**: Liên kết một học sinh với tối đa một buổi học thử, xác định bằng ngày cụ
  thể và khung giờ.
- **Xếp lịch học**: Liên kết một học sinh với một hoặc nhiều khung lịch của lưới tuần lặp lại.
- **Bước tiến độ**: Trạng thái của một trong 5 bước cố định đối với một học sinh; có đã xong hay
  chưa, người tick, thời điểm tick.
- **Mục Q&A**: Một cặp câu hỏi và câu trả lời mẫu do chủ soạn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% tin nhắn của khách hiện trong mục Tin nhắn trong vòng 1 phút kể từ lúc nền tảng
  chuyển tin tới website (độ trễ phía nền tảng nằm ngoài tầm kiểm soát của website).
- **SC-002**: Nhân viên trả lời được khách ở cả 3 kênh (Facebook, Instagram, Zalo) mà không phải
  mở ứng dụng của kênh nào.
- **SC-003**: Chủ thêm một nhân viên mới trong dưới 1 phút, và nhân viên đó trả lời được tin nhắn
  đầu tiên trong vòng 5 phút sau khi được thêm, không cần hướng dẫn riêng.
- **SC-004**: Xếp hoặc chuyển một học sinh trên lịch mất dưới 5 giây cho mỗi thao tác kéo thả.
- **SC-005**: Chủ biết một học sinh bất kỳ đang ở bước nào trong dưới 10 giây, không cần hỏi nhân
  viên.
- **SC-006**: Thay đổi về lịch và tiến độ do một người thực hiện hiện với người khác trong vòng 5
  giây.
- **SC-007**: Không có trường hợp nào một học sinh xuất hiện ở hai khung trên lịch học thử, kể cả
  ở hai tuần khác nhau.
- **SC-008**: 100% các trang và dữ liệu của website (kể cả ảnh) từ chối người chưa đăng nhập hoặc
  đã bị gỡ quyền.
- **SC-009**: Với 10 nhân viên dùng cùng lúc, 500 học sinh và 200 cuộc trò chuyện mới mỗi ngày,
  mỗi mục (Tin nhắn, hai Lịch, Các bước) mở xong trong dưới 2 giây.

## Assumptions

- **Người dùng**: Một trung tâm duy nhất với một chủ; hai vai trò là chủ và nhân viên. Mọi nhân
  viên thấy mọi cuộc trò chuyện và mọi học sinh; người phụ trách cuộc trò chuyện không giới hạn
  quyền xem hay trả lời của người khác. Người phụ trách gắn với cuộc trò chuyện, không gắn với hồ
  sơ học sinh.
- **Tài khoản kênh**: Chủ đã có Trang Facebook và tài khoản Instagram chuyên nghiệp; Zalo Official
  Account đang chờ Zalo phê duyệt (tính đến 2026-11-16). Kênh Zalo chỉ kết nối được sau khi OA
  được duyệt; Facebook và Instagram hoạt động độc lập với việc đó. Mỗi nền tảng còn phải duyệt
  quyền nhắn tin cho website trước khi dùng với khách thật.
- **Khách từ TikTok và Threads**: Tin nhắn trên hai nền tảng này không vào website; nhân viên trả
  lời trong ứng dụng gốc. Nếu cần theo dõi, nhân viên tạo hồ sơ học sinh thủ công và ghi nguồn
  (ví dụ "TikTok") vào ô nguồn.
- **Quy định của nền tảng**: Giới hạn của từng nền tảng (ví dụ thời hạn được phép trả lời sau tin
  nhắn cuối của khách) được tuân theo và hiện cho nhân viên dưới dạng lỗi gửi có lý do. Chủ dự án
  sẽ xin Meta duyệt quyền "human agent"; trước khi được duyệt, Facebook và Instagram giới hạn 24 giờ.
- **Ảnh đại diện**: Lấy từ hồ sơ công khai mà nền tảng cung cấp tại lúc khách nhắn lần đầu; lưu bản
  sao vì đường dẫn của nền tảng có thể hết hạn. Không tự cập nhật khi khách đổi ảnh.
- **Lịch sử tin nhắn**: Chỉ có tin nhắn từ lúc kết nối kênh trở đi; không nhập lịch sử cũ.
- **Loại nội dung**: Bản đầu hỗ trợ gửi văn bản; nhận văn bản và ảnh. Các loại khác hiện ghi chú.
- **Lưới lịch**: Không có Chủ nhật, không giới hạn số học sinh mỗi khung. Buổi học thử đã qua vẫn
  xem lại được khi chuyển về tuần cũ.
- **Chuyển xanh lá**: Thời điểm "buổi học thử trôi qua" tính theo giờ Việt Nam, tại giờ kết thúc của
  khung. Hệ thống không tự biết học sinh có đến hay không; nhân viên chịu trách nhiệm chuyển lại
  đỏ khi học sinh vắng.
- **Phân loại khách hàng**: Là 4 trạng thái cố định cùng tiến độ 5 bước; chưa có nhãn tuỳ chỉnh.
  Màu đỏ và xanh lá do chủ dự án chỉ định; xanh dương cho "đã đăng ký" và xám cho "ngừng theo" là
  lựa chọn mặc định, đổi được nếu chủ dự án muốn màu khác.
- **Đã đăng ký / ngừng theo**: Hai trạng thái này chỉ được đặt bằng tay; hoàn thành đủ 5 bước
  không tự chuyển học sinh sang "đã đăng ký". Học sinh "ngừng theo" vẫn giữ hồ sơ, lịch và tiến độ.
- **5 bước**: Danh sách bước cố định, giống nhau cho mọi học sinh; chủ chưa tuỳ chỉnh được.
- **Thiết bị**: Dùng trên trình duyệt máy tính; kéo thả trên điện thoại chưa nằm trong bản đầu.
- **Ngoài phạm vi bản đầu**: Kết nối tin nhắn Threads và TikTok, trả lời tự động/chatbot, thu học
  phí trực tuyến, ký cam kết điện tử, làm test đầu vào trên website, nhắc lịch tự động cho khách,
  báo cáo thống kê, tự gộp hồ sơ của cùng một khách trên nhiều kênh. Các bước này chỉ
  được theo dõi bằng tick.

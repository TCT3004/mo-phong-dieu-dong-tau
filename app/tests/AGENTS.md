# app/tests — kiểm thử tự động

## Purpose

- Unit test chạy bằng Node (`node:test`), không cần trình duyệt, không cần hải đồ thật

## Ownership

- `geo.test.mjs`: phép chiếu, WorldFrame, datum VN-2000 (giá trị tham chiếu tính bằng PROJ 9, tham số EPSG:6960), Vincenty (mẫu Flinders Peak → Buninyong), loxodrom, đa giác
- `charts.test.mjs`: đọc BSB, georef (tờ thẳng, tờ xoay 6°, méo bậc 2, tờ VN-2000 ghép với WGS-84), quilting, `georefRecord` (dời tay, datum người dùng chọn, khung PDF), phân lớp màu PDF
- `fixtures/makeKap.mjs`: sinh hải đồ KAP tổng hợp (bộ `SET`: 2 tờ liền kề 1:50k, 1:200k, 1:12,5k PLY lõm, VN-2000, tờ xoay) — nét lưới vẽ đúng vị trí WGS-84
- `shipdraw.test.mjs`: dò viền (đũa thần, vượt nét màu, gộp vùng, khung), tỷ lệ theo mốc + số đo (co méo, số đo vênh, các hướng hình), cây chi tiết, dựng mẫu tàu pháo (đèn, mắt, hứng gió), thiếu hình chiếu, mặt boong nhiều mảnh, hướng mặt tam giác sau khi đổi sang three.js
- `shipdraw3.test.mjs`: giao 3 hình chiếu — nối mặt cắt nhiều cạnh đúng thể tích và hướng mặt, hình mũi hình thang ra 3D hình thang, ghép theo vị trí khi chọn loại khác nấc, chỗ khuyết ở hình mạn, chi tiết chỉ có ở hình mũi thì báo, đối xứng thông minh (vẽ đủ hai mạn giữ chỗ lõm một bên), mặt boong thân tàu mỗi mạn theo nét của mạn đó, vùng tam giác của từng chi tiết
- `shipdraw4.test.mjs`: tàu đẹp — nét cong qua mọi điểm, góc sắc, bo góc đúng bán kính, chân khối giữ góc khi bo; mọi loại chi tiết thư viện kín, hướng ra ngoài, đúng cỡ (cần cẩu: cần vươn cao hơn h), xoay / lấy đối xứng; radar quay riêng, cột dàn mang cờ + đèn cột; hình mũi / lái và mặt boong tự sinh; hình mũi ∩ hình lái; nét có `grp` chỉ ghép đúng khối; chân khối hạ ngập boong; cửa kính, nóc màu boong (màu tuyến tính), số hiệu mạn đúng chiều hai bên
- `anchor.test.mjs`: neo — thả / kéo theo cấp riêng từng neo (1 m/s, 2 m/s), thả tự do 3 m/s rồi chậm dần còn 1 m/s khi chạm đáy và không tự dừng, hãm thì xích đứng, kéo hết thì về lỗ; quả neo trong mô hình là khối riêng có gốc ở chỗ nối xích, miệng lỗ neo ở lại trên vỏ
- `fleet.test.mjs`: kho tàu — 13 mẫu đủ loại; mỗi mẫu dựng được mô hình (đỉnh hữu hạn, có buồng lái, mắt, đèn, chỗ treo cờ, dài đúng LOA; chân mỗi khối thượng tầng nằm trên boong hoặc nóc khối dưới; cột, radar vòm, xuồng cần, tời, thông gió… đứng trên một mặt đỡ, không lơ lửng), mớn nước đúng, chiều quay chân vịt để trống, quay trở khớp số nhập ±8 %, không câu nhắc số liệu lạ, quay trở hết lái 120 s không NaN
- `moored.test.mjs`: tàu đậu — cập mạn trái / phải áp sát mép cầu + 4 dây vào cọc bích, cập mạn tàu khác nhiều lớp (lớp ngoài theo tàu trong khi dời), cập lái 2 neo trước mũi, đậu neo 1 neo, lưu file lat/lon mở lại đúng chỗ, theo gốc trôi, tàu mình đâm vào thì có lực đẩy + báo va tàu
- `scenery.test.mjs`: cảnh trên bờ — cây chỉ mọc trên đất cách mép nước, dựng lại quanh chỗ khác thì cây trong vùng chung vẫn đúng chỗ
- `weather.test.mjs`: thời tiết ngẫu nhiên — lặp lại theo hạt giống, giá trị trong khoảng hợp lý, đổi dần, giông hay về chiều / sương mù sáng sớm, sóng gió có độ trễ
- `physics.test.mjs`: tàu mẫu giữ nguyên kết quả quay trở, tàu nhỏ có hộp số khớp đường kính quay trở với sức cản hợp lý, số liệu lạ không ra NaN và có câu nhắc, chiều quay từng chân vịt (2 chiếc ngược chiều thì triệt tiêu), nhắc khi chưa chọn chiều quay
- `places.test.mjs`: file đối tượng hải đồ (đếm cả tàu đậu) — gộp, nhập lại không nhân đôi, trùng tên thì thay, vị trí xuất phát có sẵn theo gốc trôi
- `kap.test.mjs`: georef KAP quy REF theo VN-2000 về WGS-84; KAP ghi WGS-84 hoặc không ghi datum giữ nguyên
- `chartread.test.mjs`: đọc hải đồ raster trên hải đồ tổng hợp (chữ số dựng lại từ mẫu, đảo tròn có đường bình độ) — nền xử lý ảnh, số đo sâu (phần lẻ, gạch chân, vị trí), lọc nghi / bãi, núi theo đường bình độ (khoảng cao đều, đỉnh, mép bờ), mặt đáy (mặt phẳng, kẹp theo lớp màu), dựng cả tờ

## Local Contracts

- Tên tệp `*.test.mjs`; chỉ import module thuần (không DOM; `localStorage` giả lập trong test được)
- Không đưa hải đồ thật vào thư mục này; dữ liệu mẫu phải tự sinh hoặc là phạm vi công cộng

## Work Guidance

## Verification

- `cd app && npm test` — tất cả phải `pass`

## Child DOX Index

- Không có

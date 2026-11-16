# app/tests — kiểm thử tự động

## Purpose

- Unit test chạy bằng Node (`node:test`), không cần trình duyệt, không cần hải đồ thật

## Ownership

- `geo.test.mjs`: phép chiếu, WorldFrame, datum VN-2000 (giá trị tham chiếu tính bằng PROJ 9, tham số EPSG:6960), Vincenty (mẫu Flinders Peak → Buninyong), loxodrom, đa giác
- `charts.test.mjs`: đọc BSB, georef (tờ thẳng, tờ xoay 6°, méo bậc 2, tờ VN-2000 ghép với WGS-84), quilting, `georefRecord` (dời tay, datum người dùng chọn, khung PDF), phân lớp màu PDF
- `fixtures/makeKap.mjs`: sinh hải đồ KAP tổng hợp (bộ `SET`: 2 tờ liền kề 1:50k, 1:200k, 1:12,5k PLY lõm, VN-2000, tờ xoay) — nét lưới vẽ đúng vị trí WGS-84
- `shipdraw.test.mjs`: dò viền (đũa thần, vượt nét màu, gộp vùng, khung), tỷ lệ theo mốc + số đo (co méo, số đo vênh, các hướng hình), cây chi tiết, dựng mẫu tàu pháo (đèn, mắt, hứng gió), thiếu hình chiếu, mặt boong nhiều mảnh, hướng mặt tam giác sau khi đổi sang three.js
- `weather.test.mjs`: thời tiết ngẫu nhiên — lặp lại theo hạt giống, giá trị trong khoảng hợp lý, đổi dần, giông hay về chiều / sương mù sáng sớm, sóng gió có độ trễ
- `physics.test.mjs`: tàu mẫu giữ nguyên kết quả quay trở, tàu nhỏ có hộp số khớp đường kính quay trở với sức cản hợp lý, số liệu lạ không ra NaN và có câu nhắc
- `places.test.mjs`: file đối tượng hải đồ — gộp, nhập lại không nhân đôi, trùng tên thì thay, vị trí xuất phát có sẵn theo gốc trôi
- `kap.test.mjs`: georef KAP quy REF theo VN-2000 về WGS-84; KAP ghi WGS-84 hoặc không ghi datum giữ nguyên

## Local Contracts

- Tên tệp `*.test.mjs`; chỉ import module thuần (không DOM; `localStorage` giả lập trong test được)
- Không đưa hải đồ thật vào thư mục này; dữ liệu mẫu phải tự sinh hoặc là phạm vi công cộng

## Work Guidance

## Verification

- `cd app && npm test` — tất cả phải `pass`

## Child DOX Index

- Không có

# app/tests — kiểm thử tự động

## Purpose

- Unit test chạy bằng Node (`node:test`), không cần trình duyệt, không cần hải đồ thật

## Ownership

- `geo.test.mjs`: phép chiếu, WorldFrame, datum VN-2000 (giá trị tham chiếu tính bằng PROJ 9, tham số EPSG:6960), Vincenty (mẫu Flinders Peak → Buninyong), loxodrom, đa giác
- `charts.test.mjs`: đọc BSB, georef (tờ thẳng, tờ xoay 6°, méo bậc 2, tờ VN-2000 ghép với WGS-84), quilting, `georefRecord` (dời tay, datum người dùng chọn, khung PDF), phân lớp màu PDF
- `fixtures/makeKap.mjs`: sinh hải đồ KAP tổng hợp (bộ `SET`: 2 tờ liền kề 1:50k, 1:200k, 1:12,5k PLY lõm, VN-2000, tờ xoay) — nét lưới vẽ đúng vị trí WGS-84
- `kap.test.mjs`: georef KAP quy REF theo VN-2000 về WGS-84; KAP ghi WGS-84 hoặc không ghi datum giữ nguyên

## Local Contracts

- Tên tệp `*.test.mjs`; chỉ import module thuần (không DOM)
- Không đưa hải đồ thật vào thư mục này; dữ liệu mẫu phải tự sinh hoặc là phạm vi công cộng

## Work Guidance

## Verification

- `cd app && npm test` — tất cả phải `pass`

## Child DOX Index

- Không có

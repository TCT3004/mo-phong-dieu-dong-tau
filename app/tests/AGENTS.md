# app/tests — kiểm thử tự động

## Purpose

- Unit test chạy bằng Node (`node:test`), không cần trình duyệt, không cần hải đồ thật

## Ownership

- `geo.test.mjs`: phép chiếu, WorldFrame, datum VN-2000 (giá trị tham chiếu tính bằng PROJ 9, tham số EPSG:6960), Vincenty (mẫu Flinders Peak → Buninyong), loxodrom, đa giác

## Local Contracts

- Tên tệp `*.test.mjs`; chỉ import module thuần (không DOM)
- Không đưa hải đồ thật vào thư mục này; dữ liệu mẫu phải tự sinh hoặc là phạm vi công cộng

## Work Guidance

## Verification

- `cd app && npm test` — tất cả phải `pass`

## Child DOX Index

- Không có

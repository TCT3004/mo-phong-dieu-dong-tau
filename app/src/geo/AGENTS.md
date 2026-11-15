# app/src/geo — nền tọa độ

## Purpose

- Phép chiếu, "mét thế giới", chuyển datum, khoảng cách / phương vị, tiện ích đa giác — dùng chung cho hải đồ, mô phỏng, radar, 3D

## Ownership

| File | Trách nhiệm |
|---|---|
| `proj.js` | Mercator elipxoit WGS-84 (kiểu EPSG:3395): `llToMerc`, `mercToLL`, `mercScale` |
| `frame.js` | `WorldFrame`: lat/lon ↔ mét thế giới (Mercator ÷ hệ số phóng tại φ₀), `recenter` (gốc trôi) |
| `datum.js` | `normalizeDatum`, `toWGS84`, `fromWGS84`; VN-2000 theo EPSG:6960 (quay khung tọa độ) |
| `geodesic.js` | `inverse` (Vincenty, elipxoit), `rhumb` / `rhumbDest` (loxodrom cho tuyến đi) |
| `poly.js` | `bbox`, `bboxIntersects`, `bboxContains`, `area`, `inside`, `normalize` |

## Local Contracts

- Thứ tự tham số luôn là `(lat, lon)`, đơn vị độ; mét thế giới `[x, y]` với x Đông, y Bắc
- Mọi tọa độ lưu trữ là WGS-84; dữ liệu theo datum khác phải qua `toWGS84` khi nạp
- Module thuần, không phụ thuộc DOM / three.js (chạy được trong worker và trong Node để kiểm thử)
- Đổi tham số datum phải kèm nguồn (mã EPSG hoặc văn bản pháp quy) và cập nhật giá trị tham chiếu trong `app/tests/geo.test.mjs`

## Work Guidance

- Hướng đi và quãng đường chặng tuyến dùng loxodrom; khoảng cách chính xác giữa 2 điểm xa dùng `inverse`

## Verification

- `cd app && npm test` (tệp `tests/geo.test.mjs`)

## Child DOX Index

- Không có

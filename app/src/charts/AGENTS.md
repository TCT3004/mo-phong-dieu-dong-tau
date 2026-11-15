# app/src/charts — dữ liệu hải đồ

## Purpose

- Đọc hải đồ, georef, kho hải đồ (catalog), chia ô ảnh — phần dữ liệu, không vẽ

## Ownership

| File | Trách nhiệm |
|---|---|
| `bsb.js` | `parseBsb` (header đầy đủ: REF, PLY, DTM, GD, PR, bảng màu DAY/DSK/NGT), `decodeBsb`, `classLut`, `buildGrid` |
| `georef.js` | `fitGeoref` (đa thức pixel ↔ Mercator WGS-84, bậc 1 hoặc 2, sai số m), `makeXf` |

## Local Contracts

- Module thuần (không DOM): chạy được trong worker và trong Node
- Georef luôn khớp trên điểm REF đã quy về WGS-84; bậc 2 chỉ chọn khi bậc 1 sai > 0,5 pixel, bậc 2 tốt hơn ≥ 30% và đi-về ổn định trên lưới 7×7
- Hệ số georef là dữ liệu thuần (lưu được), hàm chuyển đổi dựng lại bằng `makeXf`

## Work Guidance

## Verification

- `cd app && npm test` (`tests/charts.test.mjs`)

## Child DOX Index

- Không có

# app/src/charts — dữ liệu hải đồ

## Purpose

- Đọc hải đồ, georef, kho hải đồ (catalog), chia ô ảnh — phần dữ liệu, không vẽ

## Ownership

| File | Trách nhiệm |
|---|---|
| `bsb.js` | `parseBsb` (header đầy đủ: REF, PLY, DTM, GD, PR, bảng màu DAY/DSK/NGT), `decodeBsb`, `classLut`, `buildGrid` |
| `georef.js` | `fitGeoref` (đa thức pixel ↔ Mercator WGS-84, bậc 1 hoặc 2, sai số m), `makeXf` |
| `catalog.js` | kho `catalog` (IndexedDB `mp_charts`: `meta` bản ghi tờ, `tiles` ô ảnh nén, `grids` lưới lớp độ sâu), `georefRecord` (datum → WGS-84, DTM, datum người dùng chọn, dời tay, đa giác phủ, hộp bao), nạp file, `setClassDepth`, `update`, `remove` |
| `tiler.worker.js` | worker: giải mã KAP → lưới lớp độ sâu + kim tự tháp ô 256×256 chỉ số màu (nén deflate-raw) |

## Local Contracts

- `bsb.js`, `georef.js`, `tiler.worker.js` thuần (không DOM): chạy được trong worker và trong Node; `catalog.js` cần IndexedDB / Worker
- Georef luôn khớp trên điểm REF đã quy về WGS-84; bậc 2 chỉ chọn khi bậc 1 sai > 0,5 pixel, bậc 2 tốt hơn ≥ 30% và đi-về ổn định trên lưới 7×7
- Hệ số georef là dữ liệu thuần, không lưu: tính lại từ REF khi mở kho (`georefRecord`), hàm chuyển đổi dựng bằng `makeXf`
- Ô ảnh và lưới theo pixel của tờ, không phụ thuộc georef → đổi datum / dời tay chỉ tính lại hệ số (`ver` tăng), không chia ô lại
- Khóa ô: `<id>/<mức>/<tx>/<ty>`; mức 0 là ảnh gốc, mỗi mức thu nhỏ ½ (mức 1 giữ mọi nét tối, các mức sau chỉ giữ nét tối chiếm ≥ 2 rồi ≥ 3 trong 4 điểm)
- `id` tờ = `tên|R×C|cỡ file`; nạp lại đúng file đã có thì bỏ qua

## Work Guidance

## Verification

- `cd app && npm test` (`tests/charts.test.mjs`)

## Child DOX Index

- Không có

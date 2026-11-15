# app/src/charts — dữ liệu hải đồ

## Purpose

- Đọc hải đồ, georef, kho hải đồ (catalog), chia ô ảnh — phần dữ liệu, không vẽ

## Ownership

| File | Trách nhiệm |
|---|---|
| `bsb.js` | `parseBsb` (header đầy đủ: REF, PLY, DTM, GD, PR, bảng màu DAY/DSK/NGT), `decodeBsb`, `classLut` (bảng màu BSB), `classOfRgb` (màu thật, cho PDF), `cellClass`, `fillUnknown`, `buildGrid` |
| `georef.js` | `fitGeoref` (đa thức pixel ↔ Mercator WGS-84, bậc 1 hoặc 2, sai số m), `makeXf` |
| `record.js` | `georefRecord`: phần georef của bản ghi tờ (datum → WGS-84 theo thứ tự datum người dùng chọn > GD > DTM, khớp đa thức, dời tay theo m, đa giác phủ từ PLY lat/lon hoặc khung pixel `plyPx`, hộp bao, tâm, `ver`) |
| `catalog.js` | kho `catalog` (IndexedDB `mp_charts`: `meta` bản ghi tờ, `tiles` ô ảnh, `grids` lưới lớp độ sâu), nạp KAP, `putTiles`, `putGrid`, `getTile`, `setClassDepth`, `update`, `remove`, `usage` |
| `pdfchart.js` | `importPdfChart`: render trang PDF bằng pdf.js theo từng mức (khối 4096²) → ô 256² WebP + lưới lớp độ sâu theo `classOfRgb` |
| `tiler.worker.js` | worker: giải mã KAP → lưới lớp độ sâu + kim tự tháp ô 256×256 chỉ số màu (nén deflate-raw) |

## Local Contracts

- `bsb.js`, `georef.js`, `record.js`, `tiler.worker.js` thuần (không DOM): chạy được trong worker và trong Node; `catalog.js`, `pdfchart.js` cần trình duyệt
- Georef luôn khớp trên điểm REF đã quy về WGS-84; bậc 2 chỉ chọn khi bậc 1 sai > 0,5 pixel, bậc 2 tốt hơn ≥ 30% và đi-về ổn định trên lưới 7×7
- Hệ số georef là dữ liệu thuần, không lưu: tính lại từ REF khi mở kho (`georefRecord`), hàm chuyển đổi dựng bằng `makeXf`
- Ô ảnh và lưới theo pixel của tờ, không phụ thuộc georef → đổi datum / dời tay chỉ tính lại hệ số (`ver` tăng), không chia ô lại
- Ô lưu `{ z, d }`: z = 0 chỉ số màu thô, 1 chỉ số màu nén deflate-raw (KAP, `fmt: 'idx'`), 2 Blob WebP RGBA (PDF, `fmt: 'rgba'`)
- Khóa ô: `<id>/<mức>/<tx>/<ty>`; mức 0 là ảnh gốc, mỗi mức thu nhỏ ½ (mức 1 giữ mọi nét tối, các mức sau chỉ giữ nét tối chiếm ≥ 2 rồi ≥ 3 trong 4 điểm)
- `id` tờ = `tên|R×C|cỡ file` (PDF: `tên|R×C|pdf<cỡ file>`); nạp lại đúng file KAP đã có thì bỏ qua
- Hải đồ PDF: điểm REF là pixel ảnh mức 0 (= điểm trang × dpi/72) kèm lat/lon theo datum in trên tờ; không lưu file PDF gốc

## Work Guidance

## Verification

- `cd app && npm test` (`tests/charts.test.mjs`)

## Child DOX Index

- Không có

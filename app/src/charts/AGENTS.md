# app/src/charts — dữ liệu hải đồ

## Purpose

- Đọc hải đồ, georef, kho hải đồ (catalog), chia ô ảnh — phần dữ liệu, không vẽ

## Ownership

| File | Trách nhiệm |
|---|---|
| `bsb.js` | `parseBsb` (header đầy đủ: REF, PLY, DTM, GD, PR, bảng màu DAY/DSK/NGT), `decodeBsb`, `classLut` (bảng màu BSB), `classOfRgb` (màu thật, cho PDF), `cellClass`, `fillUnknown`, `buildGrid` |
| `georef.js` | `fitGeoref` (đa thức pixel ↔ Mercator WGS-84, bậc 1 hoặc 2, sai số m), `makeXf` |
| `record.js` | `georefRecord`: phần georef của bản ghi tờ (datum → WGS-84 theo thứ tự datum người dùng chọn > GD > DTM, khớp đa thức, dời tay theo m, đa giác phủ từ PLY lat/lon hoặc khung pixel `plyPx`, hộp bao, tâm, `ver`) |
| `catalog.js` | kho `catalog` (IndexedDB `mp_charts` phiên bản 2: `meta` bản ghi tờ, `tiles` ô ảnh, `grids` lưới lớp độ sâu, `dmodel` mô hình độ sâu), nạp KAP (xong thì tự đọc độ sâu), `putTiles`, `putGrid`, `getTile`, `setClassDepth`, `update`, `remove`, `usage`; độ sâu: `readDepth(r, opt, pri)` (hàng đợi một tờ một lúc; `pri` = người dùng bấm / sửa → chen đầu hàng (sau các việc người dùng khác) và dừng việc nền đang đọc cả tờ khác (việc đó quay lại đầu hàng nền, lần sau đọc lại từ đầu, `dm` trả về như cũ); mỗi tờ một việc chờ, yêu cầu mới gộp vào (đọc cả tờ > lấy màu nước > dựng lại mặt nước), xin đọc lại đúng tờ đang đọc từ đầu thì chờ chung; worker im lặng quá 10 phút thì báo lỗi và đọc tờ tiếp; `depthQueuePos` (−1 / 0 đang chạy / thứ tự), `depthJob`, `depthQueueInfo`, sự kiện `dmq` khi hàng đổi; gửi ô mức 0 còn nén `level0Tiles` cho worker ghép lại ảnh gốc, m / điểm ảnh `mppOf`; người dùng sửa thêm trong lúc dựng thì giữ bản điểm mới nhất và dựng thêm một lượt; `opt.snd` / `opt.hts` có sẵn thì không đọc lại số; `opt.water` chỉ dựng lại mặt nước; `opt.tint` gửi ảnh để lấy màu nước rồi dựng lại mặt nước — nâng cấp tờ cũ), `getDLite` / `putDLite` (phần nhẹ: thông số + điểm), `getDGrid` (phần nặng: lưới z, lớp ô, màu nước `tn`, điểm mép, đường đẳng sâu `iso`), `getDModel`, `putDModel` |
| `pdfchart.js` | `importPdfChart`: render trang PDF bằng pdf.js theo từng mức (khối 4096²) → ô 256² WebP + lưới lớp độ sâu theo `classOfRgb` |
| `tiler.worker.js` | worker: giải mã KAP → lưới lớp độ sâu + kim tự tháp ô 256×256 chỉ số màu (nén deflate-raw) |
| `reader.worker.js` | worker: ghép ảnh chỉ số màu từ ô mức 0 (giải nén `fflate`), `buildDepthModel` / `rebuildWater` / `addImageLayers` (chế độ `full` / `water` / `tint` — `tint` lấy thêm màu nước, đường đẳng sâu từ ảnh) của `chartread/` (tiến độ `progress`, nhật ký `log`, kết quả chuyển giao bộ đệm) |

## Local Contracts

- `bsb.js` (`parseBsb` đọc cả `DU` dpi), `georef.js`, `record.js`, `tiler.worker.js`, `reader.worker.js` thuần (không DOM): chạy được trong worker và trong Node; `catalog.js`, `pdfchart.js` cần trình duyệt
- Georef luôn khớp trên điểm REF đã quy về WGS-84; bậc 2 chỉ chọn khi bậc 1 sai > 0,5 pixel, bậc 2 tốt hơn ≥ 30% và đi-về ổn định trên lưới 7×7
- Hệ số georef là dữ liệu thuần, không lưu: tính lại từ REF khi mở kho (`georefRecord`), hàm chuyển đổi dựng bằng `makeXf`
- Ô ảnh và lưới theo pixel của tờ, không phụ thuộc georef → đổi datum / dời tay chỉ tính lại hệ số (`ver` tăng), không chia ô lại
- Ô lưu `{ z, d }`: z = 0 chỉ số màu thô, 1 chỉ số màu nén deflate-raw (KAP, `fmt: 'idx'`), 2 Blob WebP RGBA (PDF, `fmt: 'rgba'`)
- Khóa ô: `<id>/<mức>/<tx>/<ty>`; mức 0 là ảnh gốc, mỗi mức thu nhỏ ½ (mức 1 giữ mọi nét tối, các mức sau chỉ giữ nét tối chiếm ≥ 2 rồi ≥ 3 trong 4 điểm)
- `id` tờ = `tên|R×C|cỡ file` (PDF: `tên|R×C|pdf<cỡ file>`); nạp lại đúng file KAP đã có thì bỏ qua
- Bản ghi tờ có `dm` (trạng thái đọc độ sâu): `{ st: 'run' | 'ok' | 'err', f, s (bước đang làm), n, sus, nh, interval, hc, alg, made, iso (số đường đẳng sâu có giá trị), err }`; khóa `dmodel`: `<id>` phần nhẹ, `<id>|g` phần nặng; chỉ đọc tờ KAP
- Hải đồ PDF: điểm REF là pixel ảnh mức 0 (= điểm trang × dpi/72) kèm lat/lon theo datum in trên tờ; không lưu file PDF gốc

## Work Guidance

## Verification

- `cd app && npm test` (`tests/charts.test.mjs`)

## Child DOX Index

- Không có

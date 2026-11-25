# app/src/chartread — đọc hải đồ raster

## Purpose

- Đọc số đo sâu, độ cao, đường bình độ trên ảnh chỉ số màu của tờ KAP rồi dựng «mô hình độ sâu»: lưới z (độ cao so với số 0 hải đồ) cho mặt đáy, bãi, đất / núi

## Ownership

| File | Trách nhiệm |
|---|---|
| `img.js` | nền xử lý ảnh: `paletteInfo` (lớp nền 1 nước / 2 bãi / 3 đất, mực lõi / mềm, cam, trắng, kèm bảng màu `pal`), `waterTintIds` (màu nước chính → số hiệu 1…n theo độ sáng tăng = nông → sâu, màu phụ gộp vào màu gần nhất), `pureWater` (điểm ảnh nước cách nét vẽ ≥ 3 điểm ảnh — bỏ viền răng cưa quanh chữ, màu lượng tử của viền trùng màu dải khác), `label` (thành phần liên thông + khung + diện tích), `dilate` / `erode` / `open` / `close`, `edt` (khoảng cách Euclid, có chỉ số điểm gần nhất, giới hạn khung), `thin` (Zhang–Suen), `halfOr`, `fillNearest`, `maskedBlur` |
| `digit_tpl.js` | mẫu chữ số sinh tự động (không sửa tay): `ITALIC` 384 tâm cụm chữ đo sâu (lớp 0–9 + «x» không phải chữ số), `UPRIGHT` chữ đứng từ phông tự do, `SLANT` độ nghiêng chữ đo sâu |
| `digits.js` | `loadTemplates` (giải nén mẫu), `deshear` (nắn chữ nghiêng), `feature` (24×24 mờ chuẩn hóa + tỷ lệ), `classifyItalic` (kNN 5 tâm cụm), `classifyUpright` (số lỗ kín giới hạn lớp, số 1 là thanh hẹp), `templateImage` (cho kiểm thử) |
| `read.js` | `readBlock`: gom nét → chữ số → cụm số, đọc số đo sâu (phần nguyên + chữ số lẻ thấp hơn, gạch chân / nằm trong vùng bãi = độ cao bãi cạn, bỏ nét gạch đường đứt, bỏ chữ địa danh) và độ cao (chấm bên trái / phải = vị trí đỉnh, số trong ngoặc = độ cao cả hòn); `postFilter` (bỏ số lẻ mồ côi, đánh dấu nghi khi lệch hẳn 8 số lân cận); `dedupeHeights` |
| `terrain.js` | nửa độ phân giải: `halfMasks` (lớp đa số 2×2, màu nước đa số `tint2` chỉ tính điểm `pureWater`, nét cam, chữ gọn = vật chắn, nét dài / mảnh = cho đi qua), `landElevation` (suối / đường trong đảo tính là đất, đường bình độ nối qua nét mảnh + nối đầu mút, chia vùng giữa các đường, đếm bậc từ bờ lên, khoảng cao đều 5–100 m suy từ chấm độ cao, nội suy giữa hai đường, hiệu chỉnh tỷ lệ theo chấm độ cao, đảo không có đường bình độ dựng vòm theo hình đảo + số độ cao, làm mượt giữ mép bờ) |
| `surface.js` | `edgeSamples` (mép nước / bãi = 0, mép bãi / đất = mép bờ), `rasterTin` (Delaunay `delaunator`, tô ô, Int16), `rasterTinF` (như trên ra số thực, ô ngoài lưới tam giác lấy theo ô gần nhất), `cellTints` (màu nước từng ô, ô thiếu lấy theo ô bên cạnh), `tintBands` (dải [L, U] từng màu: ranh giữa hai màu kề = mức chuẩn 2 / 5 / 10 / 20… tách hai nhóm số đo tốt nhất, cần đúng ≥ 85 %, mỗi màu ≥ 10 số đo; màu sâu nhất không có U; không tách được → null), `waterDepths` (có ≥ 2 màu khớp dải: mỗi vùng màu nội suy riêng từ số đo cùng màu, d = min(max(min(S, L + KS·dS), U − KU·dU), KC·dC) giữ trong [min(L, KC·dC), U] — dS / dU / dC = khoảng cách tới vùng màu nông hơn / sâu hơn / bờ-bãi, độ dốc K suy từ từng số đo; vùng L > 0 sát bờ từ 0 lên L trong ≤ 3 ô; số đo nông hơn dải > 0,5 m = hố nông cục bộ dốc 1:10, sâu hơn dải > 0,5 m bị bỏ; không có màu / không khớp: một vùng, L = 0 ở bờ), `composeGrid` (ô đất lấy độ cao đất; ô bãi theo tam giác qua số đo + điểm mép, 0 … mép bờ, bãi xa đất không cao quá bãi cao nhất; ô nước theo `waterDepths`, ≥ 0,1 m; ô nước không nối tới số đo nào giữ cách tam giác) |
| `model.js` | `buildDepthModel` (cả quy trình, có tiến độ), `readAll` (khối 2048² chồng lề), `coastHeight`, `rebuildWater` (sau khi sửa số đo sâu hoặc nâng thuật toán mặt nước, không cần ảnh; ghi `alg` mới), `addTints` (tờ cũ chưa có màu nước: lấy màu từng ô từ ảnh rồi `rebuildWater`, không dựng lại núi), `CELL` |
| `version.js` | `ALG` phiên bản thuật toán (3), `WATER_ONLY_FROM` (tờ có `alg` từ số này tới `ALG − 1` chỉ dựng lại mặt nước), `TINT_FROM` (tờ có `alg` từ số này tới `WATER_ONLY_FROM − 1` lấy màu nước từ ảnh rồi dựng lại mặt nước); tách riêng để giao diện đọc mà không kéo bộ đọc chữ số vào bundle chính |

## Local Contracts

- Thuần JS, không DOM: chạy trong worker (`charts/reader.worker.js`) và trong Node
- Mọi tọa độ theo điểm ảnh tờ (không phụ thuộc georef, như ô ảnh); đổi datum / dời tay không phải đọc lại
- Mô hình: `{ alg, made, W, H, cell (4), gw, gh, hc, mpp, nTint, interval, levels, fit, nSpots, snd: [{ x, y, v, dry, sus?, user? }], hts: [{ x, y, v, kind: 0 chấm | 1 ngoặc, user? }], z: Int16 (dm, dương = cao hơn số 0 hải đồ), cl: Uint8 lớp ô, tn: Uint8 màu nước từng ô (1…n nông → sâu, 0 = không phải nước / không rõ), edges: Float32 [x, y, z] }`
- Màu nước trên hải đồ Việt Nam (kiểm trên 6 tờ): xanh đậm 0–2 m, xanh nhạt 2–5 m, trắng > 5 m; app không ghi cứng mà suy dải từ số đo của từng tờ
- Số đo sâu `v` luôn dương; `dry` = độ cao bãi cạn (z = +v); điểm `sus` (nghi) không dùng dựng mặt đáy cho tới khi người dùng xác nhận
- Độ cao tính từ số 0 hải đồ; mép bờ (mép đất vàng) cao `hc` (theo bãi cao nhất đọc được, 2,5–4,5 m, mặc định 3 m); viền đất / bãi / nước lấy đúng màu từng điểm ảnh của tờ
- Chấm cạnh số độ cao = vị trí đỉnh; số trong ngoặc cạnh / dưới tên hòn = độ cao cả hòn, đặt ở chỗ cao nhất của hòn gần nhất (≤ 400 m)
- Thông số theo chữ cao 20 điểm ảnh ở 250 dpi; tờ khác dpi thì nhân theo `du / 250`

## Work Guidance

- Đổi thuật toán làm thay kết quả thì tăng `ALG` (`version.js`); chỉ đổi mặt nước thì giữ `WATER_ONLY_FROM` để tờ cũ dựng lại mặt nước; cần thêm dữ liệu từ ảnh thì làm đường nâng cấp riêng như `addTints` (không đọc lại số, không dựng lại núi); đổi phần đọc số / đất thì để tờ cũ đọc lại (giữ chỗ người dùng sửa)
- Ô nước không nối tam giác qua điểm mép bờ: hai mép bờ gần nhau sẽ làm nông giả cả vùng nước ở giữa
- Mẫu chữ số dựng ngoài repo từ hải đồ thử (không đưa hải đồ vào repo); chỉ thay `digit_tpl.js` khi có bộ mẫu kiểm chứng tốt hơn

## Verification

- `cd app && npm test` (`tests/chartread.test.mjs`: hải đồ tổng hợp dựng chữ số từ mẫu, đảo có đường bình độ)

## Child DOX Index

- Không có

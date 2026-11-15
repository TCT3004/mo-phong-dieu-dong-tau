# app/src/render — vẽ hải đồ

## Purpose

- Chọn tờ (quilting) và vẽ hải đồ liền mạch nhiều tờ

## Ownership

| File | Trách nhiệm |
|---|---|
| `quilt.js` | `selectCharts(recs, vp, { under })` → `{ draw: [thô → chi tiết], ref }` |
| `chartgl.js` | `ChartGL`: một context WebGL2 ngoài màn hình; ô chỉ số màu R8UI tra bảng màu ngày / hoàng hôn / đêm trên GPU, lưới đỉnh nắn theo georef, cắt theo PLY bằng stencil, ô mức thô làm nền khi ô chi tiết chưa nạp, LRU ô |
| `chartcanvas.js` | `ChartCanvas`: khung nhìn trên canvas 2D (tọa độ mét thế giới, API kiểu ChartView: `m2s`, `s2m`, `centerM`, `setMpp`, `zoomAt`, `panPx`, `fitWorld`, `fitChart`, `draw`), lưới kinh vĩ, viền tờ, `ref` = tờ ở tâm |

## Local Contracts

- Tọa độ khung nhìn và tờ hải đồ theo m Mercator WGS-84 (`geo/proj.js`); tính đa giác quanh tâm khung nhìn (đơn vị km) để tránh sai số số học
- Đỉnh tờ lưu tương đối với tâm tờ (float32), độ dời tâm tờ → tâm khung nhìn tính trên CPU (double) rồi đưa vào `uOff`
- Mọi khung nhìn dùng chung `CS.gl`; vẽ xong chép ngay sang canvas 2D của khung nhìn (`drawImage` phần dưới-trái của canvas GL)
- Ưu tiên tờ chi tiết nhất; bỏ tờ bị tờ chi tiết hơn che kín; bỏ tờ thu nhỏ quá `under` lần (mặc định 8, quyết định D6)

## Work Guidance

## Verification

- `cd app && npm test` (`tests/charts.test.mjs`)

## Child DOX Index

- Không có

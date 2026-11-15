# app/src — mã nguồn

## Purpose

- Mô phỏng chuyển động tàu, môi trường, hải đồ, 3D, radar và giao diện 5 tab + Cài đặt

## Ownership

| File | Trách nhiệm |
|---|---|
| `main.js` | khởi động, chuyển tab, vòng lặp khung hình, phím tắt, `A.hooks` |
| `app.js` | trạng thái chung `A`, lưu trữ (`LS`, `DB`), mô phỏng (`newSim`, `substep`), khẩu lệnh (`Orders`) |
| `physics.js` | mô hình tàu kiểu MMG 3 bậc tự do, nấc máy, squat |
| `world.js` | môi trường (gió, dòng, triều), tra độ sâu / lớp đáy, cầu bến, cọc bích, neo, dây, lực ngoài |
| `view3d.js` | cảnh three.js: nước (sóng Gerstner + texture), địa hình, tàu, đèn, camera buồng lái 3 cửa sổ |
| `radar.js` | radar quét tia, cự ly tới 24 Hl, EBL/VRM |
| `kap.js` | đọc header và giải mã ảnh BSB/KAP, georef tuyến tính, phân lớp độ sâu theo màu |
| `chartview.js` | vẽ hải đồ bằng Canvas2D (CPU) — sẽ thay bằng renderer WebGL2 ở giai đoạn 2 |
| `nav.js` | định dạng khoảng cách, đọc tọa độ, tuyến đi (`legs`, `trackRoute`) |
| `windage.js` | tính diện tích hứng gió từ sơ đồ tàu PDF / ảnh |
| `audio.js` | âm thanh tổng hợp: máy, còi, chuông, báo động |
| `ui_setup.js` | tab 1 Thông số tàu, tab 2 Cảng & luồng, tab 4 Môi trường, Cài đặt |
| `ui_run.js` | tab 3 Điều động (buồng lái, hải đồ nhỏ, radar, tay chuông, vô lăng, bảng tín hiệu) |
| `ui_replay.js` | tab 5 Xem lại, ghi bài tập, xuất video |
| `template.html` | khung HTML + CSS |

## Local Contracts

- Tọa độ mô phỏng hiện tại: mét cục bộ của **tờ hải đồ đang mở** (gốc ở tâm tờ, x Đông, y Bắc); `psi` radian tính từ Bắc theo chiều kim đồng hồ; cảnh 3D: x = Đông, z = −Bắc. Giai đoạn 2 chuyển sang "mét thế giới" (xem `AGENTS.md` gốc, D1)
- Lưu trữ: localStorage `mp_set`, `mp_ship`, `mp_env`, `mp_objs:<tên tờ>` (cầu bến, đèn, tuyến, vị trí xuất phát — mét cục bộ của tờ); IndexedDB `mophongtau`: `charts` (file gốc), `sessions` (bài đã ghi)
- `physics.js` không phụ thuộc hải đồ; độ sâu đi qua `world.depthAt` / `classAt`
- Chuỗi giao diện tiếng Việt; khoảng cách định dạng bằng `nav.fmtDist`

## Work Guidance

- ES modules thuần, không framework; mỗi tab một file `ui_*.js`
- Module mới của giai đoạn 2 đặt trong thư mục con: `geo/`, `charts/`, `render/`, `depth/`

## Verification

- `cd app && npm run build`

## Child DOX Index

- Chưa có thư mục con

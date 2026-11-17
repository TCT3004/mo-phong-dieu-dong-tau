# app/src — mã nguồn

## Purpose

- Mô phỏng chuyển động tàu, môi trường, hải đồ, 3D, radar và giao diện 5 tab + Cài đặt

## Ownership

| File | Trách nhiệm |
|---|---|
| `main.js` | khởi động, chuyển tab, vòng lặp khung hình, phím tắt, `A.hooks` |
| `app.js` | trạng thái chung `A`, lưu trữ (`LS`, `DB`), mô phỏng (`newSim`, `substep`), khẩu lệnh (`Orders`) |
| `physics.js` | mô hình tàu kiểu MMG 3 bậc tự do, nấc máy (vòng quay máy ÷ tỷ số hộp số = vòng quay chân vịt), lực ngang theo chiều quay từng chân vịt (`propRot`), hiệu chỉnh tốc độ từng nấc và đường kính quay trở, tự chia nhỏ bước thời gian khi số liệu làm hệ «cứng», câu nhắc số liệu lạ (`sanity`), squat |
| `chartsys.js` | trung tâm hệ hải đồ `CS`: `WorldFrame` (gốc trôi, `setOrigin`), kho, renderer WebGL2 dùng chung, nguồn độ sâu (`sampleWorld`, `ensureAround`) |
| `places.js` | kho đối tượng người dùng theo lat/lon (`mp_places`), đổi qua lại mét thế giới, file đối tượng xuất / gộp (`placesFile`, `mergePlacesFile`), chuyển dữ liệu v0.1 |
| `world.js` | môi trường (`envAt`: gió, dòng, triều, sóng; lấy từ thời tiết ngẫu nhiên nếu có), tra độ sâu / lớp đáy qua `CS`, cầu bến, cọc bích, neo, dây, lực ngoài |
| `weather.js` | thời tiết ngẫu nhiên có hạt giống: chuỗi kiểu trời (nắng, nhiều mây, mưa, mưa giông, sương mù) theo giờ trong ngày, chuyển dần; gió giật, sóng gió có độ trễ, sét |
| `flags.js` | cờ trên cột cao nhất: vẽ cờ Tổ quốc / cờ Hải quân (canvas), lưới cờ bay theo gió biểu kiến, rủ khi gió yếu |
| `view3d.js` | cảnh three.js: nước (sóng Gerstner + texture, giữ pha liền khi sóng đổi), mưa, mây, chớp sét, địa hình dựng quanh tàu từ các tờ (lưới mịn gần, thưa xa), tàu (mô hình vẽ từ sơ đồ nếu có, không thì tàu đơn giản; sơn PBR phản chiếu bầu trời theo độ sáng ngày, bóng đổ quanh tàu — mức Thấp tắt, bóng vẽ một lần mỗi khung hình; radar trong mô hình quay), đèn, buồng lái 3 ô cửa sổ gắn trên tàu đặt tại vị trí người điều động (mỗi ô nhìn một hướng cố định so với tàu; kéo chuột = quay đầu, cả cụm `.wins` trượt trên màn hình, giới hạn ±60° ngang, ±25° đứng) |
| `radar.js` | radar quét tia, cự ly tới 24 Hl, EBL/VRM, nhiễu sóng và nhiễu mưa |
| `kap.js` | georef tuyến tính của v0.1 — chỉ dùng chuyển dữ liệu cũ; `fmtLL` |
| `nav.js` | định dạng khoảng cách, đọc tọa độ, tuyến đi (`legsLL` loxodrom theo lat/lon, `legs`, `trackRoute`) |
| `windage.js` | tính diện tích hứng gió từ sơ đồ tàu PDF / ảnh |
| `pdfload.js` | mở PDF bằng pdf.js (worker classic từ Blob), dùng chung cho `windage.js` và hải đồ PDF |
| `ui_shipdraw.js` | hộp thoại vẽ tàu từ sơ đồ (mở từ tab 1): bàn vẽ 3 hình chiếu (mạn, mặt boong, nhìn từ mũi / lái cùng tỷ lệ, thẳng hàng; vạch gióng theo chuột và theo chi tiết đang chọn; thước CAD: bắt dính lưới / điểm / vạch gióng, Shift vẽ thẳng, gõ số), chế độ một hình để đặt mốc + đo kích thước cho ảnh, nét thẳng / cong mềm, bo góc, góc sắc từng điểm, cửa kính từng khối, hình chiếu tự sinh (nét đứt mờ, kéo điểm là thành nét thật mang `grp`), bóng mờ cả tàu ở ô nhìn từ mũi / lái (ô nhìn từ lái luôn hiện), chế độ 3D lớn sửa được (bấm khối để chọn, điểm nắm ở cả hai đầu khối nằm đúng trên mặt khối, kéo trong mặt phẳng hình chiếu của nó, bấm đúp lên cạnh thêm điểm, Shift + kéo dời cả khối, gõ tọa độ điểm; xem xoay tự do hoặc thẳng từ trên / mạn / mũi cùng hướng với bàn vẽ), thư viện chi tiết (bấm loại rồi bấm lên tàu ở 3D để đặt; kéo để dời, tự bám boong / nóc; điểm vàng đổi cỡ, điểm tím xoay; sửa số ở khung bên phải; hiện khung bao trên bàn vẽ), màu tàu / số hiệu mạn, khối đang chọn sáng trên 3D, hoàn tác / làm lại (Ctrl+Z / Ctrl+Y, lưu ảnh chụp mô hình sau mỗi lần sửa), dò viền / chấm tay, chọn loại nhiều nấc, dùng cho tàu, xuất / nhập file |
| `ui_pdfchart.js` | hộp thoại nạp hải đồ PDF: trang, tỷ lệ, datum (mặc định VN-2000), độ nét, điểm tọa độ, khung hải đồ, sai số khớp |
| `audio.js` | âm thanh tổng hợp: máy, còi, chuông, báo động, mưa, gió, sấm |
| `ui_setup.js` | tab 1 Thông số tàu (kể cả chọn cờ, chiều quay từng chân vịt), tab 2 Cảng & luồng (kho hải đồ, khung nhìn liền mạch, datum / dời tay từng tờ, nút «Về tàu», lưu / mở file đối tượng), tab 4 Môi trường (ánh sáng xem thử, sương mù dày, vị trí xuất phát có sẵn), Cài đặt |
| `ui_run.js` | tab 3 Điều động (chọn góc nhìn, buồng lái, hải đồ nhỏ, radar, tay chuông, vô lăng, bảng tín hiệu) |
| `ui_replay.js` | tab 5 Xem lại, ghi bài tập, xuất video |
| `template.html` | khung HTML + CSS |

## Local Contracts

- Tọa độ mô phỏng: "mét thế giới" của `CS.frame` (Mercator elipxoit ÷ hệ số phóng tại gốc; x Đông, y Bắc). Gốc đặt tại vị trí xuất phát khi bắt đầu bài, dời khi tàu xa gốc > 20 km (`checkOrigin`); nơi nào giữ tọa độ mét thế giới phải đăng ký `CS.originSubs` để đổi theo. `psi` radian tính từ Bắc theo chiều kim đồng hồ; cảnh 3D: x = Đông, z = −Bắc
- Lưu trữ: localStorage `mp_set`, `mp_ship`, `mp_env`, `mp_places` (đối tượng, vị trí xuất phát và các vị trí có sẵn `starts`, lat/lon WGS-84); IndexedDB `mp_charts` (kho hải đồ, xem `charts/AGENTS.md`), `mophongtau` → `sessions` (bài đã ghi, kèm gốc `frame` lúc ghi). `mp_objs:<tên tờ>` và `mophongtau/charts` của v0.1 được chuyển tự động lúc khởi động rồi bỏ
- Tọa độ lat/lon hiển thị, nhập, lưu: WGS-84
- Kịch bản `mp_env`: `wxMode` (`manual` | `random`), `wxStart` (kiểu trời khởi đầu, rỗng = app chọn), `waveL` bước sóng (m; chu kỳ suy ra theo sóng nước sâu), `light` (`auto` | `day` | `dusk` | `night`), `fogOn` (ép tầm nhìn 550 m). Thời tiết ngẫu nhiên tạo mới mỗi bài (`A.sim.wx`), không đổi thủy triều, dòng chảy, giờ
- Bản ghi bài tập (`rec`, 1 dòng/giây) có cả thời tiết (`wKn`, `wDir`, `wD`, `wL`, `rn`, `cl`, `wx`) để xem lại 3D đúng như lúc chạy
- Nấc lệnh lái lấy từ `helmSteps()` theo `rudMax` của tàu
- Thông số tàu `rot`: chiều quay từng chân vịt khi tiến, thứ tự từ trái sang phải nhìn từ lái lên mũi (`right` | `left` | `''` chưa chọn — chưa chọn thì không tính lực ngang chiếc đó và tab 1 nhắc); tàu cũ chỉ có `rotDir` thì `propRot` suy ra
- Thông số tàu có `model` (vẽ từ sơ đồ, xem `shipdraw/AGENTS.md`) thì cảnh 3D, camera buồng lái, vị trí đèn hàng hải theo mô hình; ảnh sơ đồ lưu riêng ở IndexedDB `mp_shipimg`
- File đối tượng `.json` = `{ app, loai: 'doi-tuong-hai-do', v: 2, lights, berths, routes, starts, start }` (cùng dạng `mp_places`); mở file là gộp, trùng tên thì thay. Đèn: `kind` `light` | `beaconR` | `beaconG` | `buoyR` | `buoyG` | `buoyY`, `period`, `flash`, `grp` (số chớp mỗi chu kỳ), `height`
- Mọi tọa độ mét thế giới trong `W.objs` (kể cả `starts`) đổi theo gốc trôi ở `World.mapCoords`
- Độ sâu theo màu (`classDepth`) thuộc từng tờ hải đồ; ngoài mọi tờ là biển trống sâu `noChartDepth` (30 m)
- Khung nhìn hải đồ là `render/chartcanvas.js` (có `redraw` thì vòng lặp chính tự vẽ lại khi `dirty`)
- `physics.js` không phụ thuộc hải đồ; độ sâu đi qua `world.depthAt` / `classAt`
- Chuỗi giao diện tiếng Việt; khoảng cách định dạng bằng `nav.fmtDist`

## Work Guidance

- ES modules thuần, không framework; mỗi tab một file `ui_*.js`
- Module lõi theo mảng đặt trong thư mục con: `geo/`, `charts/`, `render/`, `depth/`, `shipdraw/`

## Verification

- `cd app && npm run build && npm test`

## Child DOX Index

- `geo/AGENTS.md` — nền tọa độ: Mercator elipxoit, WorldFrame, datum VN-2000, geodesic, đa giác
- `charts/AGENTS.md` — đọc BSB đầy đủ, georef đa thức, kho hải đồ, worker chia ô ảnh
- `render/AGENTS.md` — chọn tờ (quilting), renderer WebGL2, khung nhìn hải đồ
- `depth/AGENTS.md` — nguồn độ sâu ghép nhiều tờ
- `shipdraw/AGENTS.md` — vẽ tàu từ sơ đồ: cây chi tiết, dò viền, tỷ lệ, dựng mô hình 3D

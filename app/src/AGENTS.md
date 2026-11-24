# app/src — mã nguồn

## Purpose

- Mô phỏng chuyển động tàu, môi trường, hải đồ, 3D, radar và giao diện 5 tab + Cài đặt

## Ownership

| File | Trách nhiệm |
|---|---|
| `main.js` | khởi động, chuyển tab, vòng lặp khung hình, phím tắt, `A.hooks` |
| `app.js` | trạng thái chung `A`, lưu trữ (`LS`, `DB`), mô phỏng (`newSim`, `substep`), khẩu lệnh (`Orders`; neo: `drop`, `free` thả tự do, `dredge`, `brake`, `heave`, `lv1` / `lv2` cấp tời của từng neo) |
| `physics.js` | mô hình tàu kiểu MMG 3 bậc tự do, nấc máy (vòng quay máy ÷ tỷ số hộp số = vòng quay chân vịt), lực ngang theo chiều quay từng chân vịt (`propRot`), hiệu chỉnh tốc độ từng nấc và đường kính quay trở, tự chia nhỏ bước thời gian khi số liệu làm hệ «cứng», câu nhắc số liệu lạ (`sanity`), squat |
| `chartsys.js` | trung tâm hệ hải đồ `CS`: `WorldFrame` (gốc trôi, `setOrigin`), kho, renderer WebGL2 dùng chung, nguồn độ sâu (`sampleWorld`, `ensureAround`) |
| `places.js` | kho đối tượng người dùng theo lat/lon (`mp_places`), đổi qua lại mét thế giới, file đối tượng xuất / gộp (`placesFile`, `mergePlacesFile`), chuyển dữ liệu v0.1 |
| `world.js` | môi trường (`envAt`: gió, dòng, triều, sóng; lấy từ thời tiết ngẫu nhiên nếu có), tra độ sâu / lớp đáy qua `CS`, cầu bến, cọc bích, neo (tốc độ xích theo cấp của từng neo `ANCHOR_SPD` cấp 1 = 1 m/s, cấp 2 = 2 m/s cho thả / kéo; thả tự do `FREE_SPD` 3 m/s, chạm đáy thì chậm dần còn `FREE_BOTTOM_SPD` 1 m/s, không tự dừng; tời không kéo nổi khi xích căng quá 3 lần trọng lượng neo), dây, lực ngoài |
| `weather.js` | thời tiết ngẫu nhiên có hạt giống: chuỗi kiểu trời (nắng, nhiều mây, mưa, mưa giông, sương mù) theo giờ trong ngày, chuyển dần; gió giật, sóng gió có độ trễ, sét |
| `wake.js` | vệt nước của tàu: dải bọt sau lái bám mặt sóng (vệt chân vịt ở giữa, hai cánh sóng Kelvin 19,5° bắt đầu từ mũi, nhạt theo thời gian / quãng đường), sóng mũi theo tốc độ, nước sủi ở lái theo vòng quay chân vịt (lùi thì sủi dọc hai bên lái); đầu vào `spd` (m/s), `prop` (vòng quay / tối đa, lùi âm) |
| `scenery.js` | cây, nhà, kho trên bờ trong vùng lưới mịn của địa hình: lưới gắn tọa độ thế giới + băm số (dựng lại vẫn đúng chỗ), rừng / làng theo nhiễu, nhà xoay dọc bờ, dãy kho sau cầu bến (không cây), đèn nhà ban đêm; số lượng theo mức chất lượng (`CAPS`), gắn vào lưới địa hình để lên xuống theo triều |
| `fleet_tpl.js` | bảng 12 tàu mẫu chung chung `TPL` (spec mét + `build({ deck, hb })` ra khối, đèn, chi tiết thư viện; bộ chi tiết dùng chung: cột cờ + cọc bích `common`, xuồng + cần `lifeboats`, cột radar `radarMast`, boong mũi tàu hàng `merchFore`, đồ boong tàu chiến `navyKit`; tàu pháo = `shipdraw/template.js` + chi tiết thêm) |
| `fleet.js` | kho tàu: loại tàu chuẩn `SHIP_TYPES`, tàu mẫu từ `fleet_tpl.js` (mô hình qua `shipdraw/shipgen.js`, thông số tab 1 qua `params`), tàu người dùng trong IndexedDB `mp_fleet` (`listFleet`, `getFleetShip` trả bản sao, `saveFleetShip` trùng loại + tên thì thay, `deleteFleetShip`, `ensureFleetShip` khi mở file đối tượng) |
| `ui_fleet.js` | giao diện kho tàu dùng chung: 2 ô chọn loại → tên (`fillFleet`), nạp làm tàu điều động (`useFleetShip`, ghi `A.p.fleetId`), khung «Lưu vào kho» (`fleetSaveForm`), thẻ «Kho tàu» tab 1 |
| `moored.js` | tàu đậu ở cảng (thuần JS): kiểu cập `MOOR_MODES`, đặt theo bến / tàu kia (`placeShip`, `relayout`), dây mặc định (`defaultLines`: mũi, chéo mũi, chéo lái, lái; cập lái 2 dây lái bắt chéo; cập mạn buộc vào cọc bích tàu kia), neo mặc định (`defaultAnchors`), khối va chạm (`shipSegs`: cạnh đường bao, chỉ tính khi lấn < 0,45 B), cọc bích trên boong (`shipBollards`, `float`) |
| `moored3d.js` | tàu đậu trong 3D: mỗi tàu trong kho dựng một lần rồi clone, tàu chưa vẽ thì thân đơn giản theo kích thước, nhấp nhô theo sóng (đậu bến ×0,4, đậu neo ×0,75), dây võng, neo nằm đáy + xích, đèn chiếu boong / đèn neo ban đêm |
| `ui_moored.js` | tab 2 công cụ «Tàu đậu»: chọn tàu trong kho + kiểu cập, bấm để đặt, kéo để dời (dây / neo đặt lại mặc định), chuột phải xóa, thẻ sửa (kiểu cập, hướng mũi — cập bến / cập mạn thì lưu độ lệch `dh` so với hướng theo bến / tàu kia, xoay quanh chỗ tiếp bến —, tàu được cập, từng dây trên một hàng gọn: chỗ ra dây → cọc bích trên bến / tàu khác trong 150 m, ô chọn `select.cell` nền sáng chữ đen, độ dài xích), vẽ tàu / dây / neo lên hải đồ, kèm tàu người dùng vào file đối tượng |
| `flags.js` | cờ trên cột cao nhất: vẽ cờ Tổ quốc / cờ Hải quân (canvas), lưới cờ bay theo gió biểu kiến, rủ khi gió yếu |
| `view3d.js` | cảnh three.js: nước (sóng Gerstner + texture, giữ pha liền khi sóng đổi), mưa, mây, chớp sét, địa hình dựng quanh tàu từ các tờ (lưới mịn gần, thưa xa; trước mép cầu bến 70 m và dưới tàu đậu ép thành nước, ô đất sát sau mép cầu hạ xuống để sườn đất không lấn ra trước cầu; cây / nhà từ `scenery.js`), khối cầu bến + đệm + cọc bích chỉ cho cầu bến (bỏ cạnh va chạm / cọc của tàu đậu), vệt nước (`wake.js`), tàu đậu (`moored3d.js`), đèn phao / đèn biển có quầng sáng (sương mù, mưa loe rộng) và vệt phản chiếu trên mặt nước trong vòng 4 km, tàu (mô hình vẽ từ sơ đồ nếu có, không thì tàu đơn giản; sơn PBR phản chiếu bầu trời theo độ sáng ngày, bóng đổ quanh tàu — mức Thấp tắt, bóng vẽ một lần mỗi khung hình; radar trong mô hình quay; quả neo: neo trong lỗ nằm yên chỗ cũ, đang thả thì treo dưới lỗ neo theo độ dài xích, chạm đáy nằm ở chỗ neo ăn (thân quay về phía tàu), thu về thì vào lại đúng chỗ cũ; xích võng từ lỗ neo xuống đáy rồi nằm trên đáy tới quả neo; quả neo của mô hình ghép theo mũi / lái + mạn, thiếu thì dùng quả neo mặc định), đèn, buồng lái 3 ô cửa sổ gắn trên tàu đặt tại vị trí người điều động (mỗi ô nhìn một hướng cố định so với tàu; kéo chuột = quay đầu, cả cụm `.wins` trượt trên màn hình, giới hạn ±60° ngang, ±25° đứng) |
| `radar.js` | radar quét tia, cự ly tới 24 Hl, EBL/VRM, nhiễu sóng và nhiễu mưa |
| `kap.js` | georef tuyến tính của v0.1 — chỉ dùng chuyển dữ liệu cũ; `fmtLL` |
| `nav.js` | định dạng khoảng cách, đọc tọa độ, tuyến đi (`legsLL` loxodrom theo lat/lon, `legs`, `trackRoute`) |
| `windage.js` | tính diện tích hứng gió từ sơ đồ tàu PDF / ảnh |
| `pdfload.js` | mở PDF bằng pdf.js (worker classic từ Blob), dùng chung cho `windage.js` và hải đồ PDF |
| `ui_shipdraw.js` | hộp thoại vẽ tàu từ sơ đồ (mở từ tab 1; tàu đang dùng đã đổi so với lần mở trước thì mở mô hình của tàu đó, bản vẽ dở chưa dùng thì hỏi trước): bàn vẽ 3 hình chiếu (mạn, mặt boong, nhìn từ mũi / lái cùng tỷ lệ, thẳng hàng; vạch gióng theo chuột và theo chi tiết đang chọn; thước CAD: bắt dính lưới / điểm / vạch gióng, Shift vẽ thẳng, gõ số), chế độ một hình để đặt mốc + đo kích thước cho ảnh, nét thẳng / cong mềm, bo góc, góc sắc từng điểm, cửa kính từng khối, hình chiếu tự sinh (nét đứt mờ, kéo điểm là thành nét thật mang `grp`), bóng mờ cả tàu ở ô nhìn từ mũi / lái (ô nhìn từ lái luôn hiện), chế độ 3D lớn sửa được (bấm khối để chọn, điểm nắm ở cả hai đầu khối nằm đúng trên mặt khối, kéo trong mặt phẳng hình chiếu của nó, bấm đúp lên cạnh thêm điểm, Shift + kéo dời cả khối, gõ tọa độ điểm; xem xoay tự do hoặc thẳng từ trên / mạn / mũi cùng hướng với bàn vẽ), thư viện chi tiết (bấm loại rồi bấm lên tàu ở 3D để đặt; kéo để dời, tự bám boong / nóc; điểm vàng đổi cỡ, điểm tím xoay; sửa số ở khung bên phải; hiện khung bao trên bàn vẽ), màu tàu / số hiệu mạn, khối đang chọn sáng trên 3D, hoàn tác / làm lại (Ctrl+Z / Ctrl+Y, lưu ảnh chụp mô hình sau mỗi lần sửa), dò viền / chấm tay, chọn loại nhiều nấc, dùng cho tàu, xuất / nhập file |
| `ui_pdfchart.js` | hộp thoại nạp hải đồ PDF: trang, tỷ lệ, datum (mặc định VN-2000), độ nét, điểm tọa độ, khung hải đồ, sai số khớp |
| `audio.js` | âm thanh tổng hợp: máy, còi, chuông, báo động, mưa, gió, sấm |
| `ui_setup.js` | tab 1 Thông số tàu (thẻ «Kho tàu», chọn cờ, chiều quay từng chân vịt), tab 2 Cảng & luồng (kho hải đồ, khung nhìn liền mạch, datum / dời tay từng tờ, nút «Về tàu», công cụ «Tàu đậu», lưu / mở file đối tượng), tab 4 Môi trường (ánh sáng xem thử, sương mù dày, vị trí xuất phát có sẵn), Cài đặt |
| `ui_run.js` | tab 3 Điều động (chọn góc nhìn, buồng lái, hải đồ nhỏ, radar, tay chuông, vô lăng, bảng tín hiệu; bảng Neo: mỗi neo nút «Cấp 1» / «Cấp 2» và 5 nút Thả neo · Thả tự do · Thả kéo lê · Hãm · Kéo neo, cảnh báo neo trôi dưới các ô neo, vừa 3 neo không cuộn; banner «VA CHẠM TÀU ĐẬU» không ghi tốc độ) |
| `ui_replay.js` | tab 5 Xem lại, ghi bài tập, xuất video |
| `template.html` | khung HTML + CSS |

## Local Contracts

- Tọa độ mô phỏng: "mét thế giới" của `CS.frame` (Mercator elipxoit ÷ hệ số phóng tại gốc; x Đông, y Bắc). Gốc đặt tại vị trí xuất phát khi bắt đầu bài, dời khi tàu xa gốc > 20 km (`checkOrigin`); nơi nào giữ tọa độ mét thế giới phải đăng ký `CS.originSubs` để đổi theo. `psi` radian tính từ Bắc theo chiều kim đồng hồ; cảnh 3D: x = Đông, z = −Bắc
- Lưu trữ: localStorage `mp_set`, `mp_ship`, `mp_env`, `mp_places` (đối tượng, vị trí xuất phát và các vị trí có sẵn `starts`, tàu đậu `ships`, lat/lon WGS-84); IndexedDB `mp_charts` (kho hải đồ, xem `charts/AGENTS.md`), `mp_fleet` → `ships` (kho tàu người dùng: `{ id, type, name, p }`, p = trọn thông số tab 1 kèm mô hình, không ảnh), `mophongtau` → `sessions` (bài đã ghi, kèm gốc `frame` lúc ghi). `mp_objs:<tên tờ>` và `mophongtau/charts` của v0.1 được chuyển tự động lúc khởi động rồi bỏ
- Tọa độ lat/lon hiển thị, nhập, lưu: WGS-84
- Kịch bản `mp_env`: `wxMode` (`manual` | `random`), `wxStart` (kiểu trời khởi đầu, rỗng = app chọn), `waveL` bước sóng (m; chu kỳ suy ra theo sóng nước sâu), `light` (`auto` | `day` | `dusk` | `night`), `fogOn` (ép tầm nhìn 550 m). Thời tiết ngẫu nhiên tạo mới mỗi bài (`A.sim.wx`), không đổi thủy triều, dòng chảy, giờ
- Bản ghi bài tập (`rec`, 1 dòng/giây) có cả thời tiết (`wKn`, `wDir`, `wD`, `wL`, `rn`, `cl`, `wx`) để xem lại 3D đúng như lúc chạy
- Nấc lệnh lái lấy từ `helmSteps()` theo `rudMax` của tàu
- Neo mô phỏng (`makeAnchors`): `st` (`stow` | `drop` | `hold` | `heave`), `chain`, `lv` (cấp tời 1 | 2), `free` (đang thả tự do), `vf` (tốc độ thả tự do hiện tại), `ax`/`ay` (chỗ neo ăn, null khi chưa chạm đáy); lỗ neo `bx`/`by` (thân tàu) được `view3d` đặt lại theo quả neo trên mô hình (hoặc sát mặt vỏ cho quả neo mặc định) trước khi thả
- Thông số tàu `rot`: chiều quay từng chân vịt khi tiến, thứ tự từ trái sang phải nhìn từ lái lên mũi (`right` | `left` | `''` chưa chọn — chưa chọn thì không tính lực ngang chiếc đó và tab 1 nhắc); tàu cũ chỉ có `rotDir` thì `propRot` suy ra
- Thông số tàu có `model` (vẽ từ sơ đồ, xem `shipdraw/AGENTS.md`) thì cảnh 3D, camera buồng lái, vị trí đèn hàng hải theo mô hình; ảnh sơ đồ lưu riêng ở IndexedDB `mp_shipimg`
- File đối tượng `.json` = `{ app, loai: 'doi-tuong-hai-do', v: 3, lights, berths, routes, starts, start, ships, fleet? }` (cùng dạng `mp_places`; `fleet` = các tàu người dùng mà tàu đậu dùng tới, tàu mẫu chỉ ghi id `tpl:…`); mở file là gộp, trùng tên thì thay (tàu đậu theo id; tàu trong `fleet` trùng loại + tên với kho máy này thì dùng tàu đã có). Đèn: `kind` `light` | `beaconR` | `beaconG` | `buoyR` | `buoyG` | `buoyY`, `period`, `flash`, `grp` (số chớp mỗi chu kỳ), `height`
- Mọi tọa độ mét thế giới trong `W.objs` (kể cả `starts`, tàu đậu và neo của chúng) đổi theo gốc trôi ở `World.mapCoords`
- Tàu đậu `W.objs.ships`: `{ id, ref (id kho tàu), type, name, L, B, T, D, mode: port | stbd | stern | along | anchor, x, y, hdg (độ), dh (độ lệch hướng khi cập bến ±60° / cập mạn ±20°), berth + bs (tên bến, m dọc bến) | host + hside + ha (tàu được cập), lines: [{ k (0–7: mũi, vai mũi, vai lái, lái × trái / phải), to: { t: 'bol', berth, s } | { t: 'sb', id, k } }], anchors: [{ side, x, y, chain }] }`; `World.rebuild` đặt lại theo bến / tàu kia rồi thêm cạnh va chạm vào `W.segs` (`ship`, `pen`; `depthAt` bỏ qua) và cọc bích boong vào `W.bollards` (`bi: -1`, `float`: `top` là độ cao trên mặt nước)
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

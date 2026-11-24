# app/src/shipdraw — vẽ tàu từ sơ đồ

## Purpose

- Dựng mô hình 3D tàu từ sơ đồ (ảnh / PDF, 1–3 hình chiếu) người dùng tự vẽ lại trong app; thiếu hình chiếu thì tự suy

## Ownership

| File | Trách nhiệm |
|---|---|
| `parts.js` | cây chi tiết nhiều nấc `PART_TREE` (nấc cuối có `role` = cách dựng, `key` = đèn nối bảng Đèn tab 3, `side`, `face`…), `resolve`, `childrenAt`, tông xám `SHADES`, bảng màu `COLOR_PRESETS`, `shipColors(opts)` |
| `prims.js` | khối hình cơ bản (`Acc` gom đỉnh theo màu, có dải cửa kính `wb` / `win`; `TAcc` + `xform`: hệ riêng u–v–w của chi tiết → tọa độ tàu), hộp, trụ, ống đứng tròn / bầu dục, elipxoit, `loftRings` nối mặt cắt nhiều cạnh |
| `curve.js` | `shapePts`: nét cong mềm qua các điểm (Catmull–Rom hướng tâm), góc sắc, bo góc; `simplifyPts` |
| `fittings.js` | thư viện chi tiết đặt sẵn `FIT_KINDS` (hình chung chung theo kích thước; có cả cần cẩu hàng — h là trụ + ca bin, cần vươn cao hơn —, nắp hầm hàng, container 20 ft màu theo băm số, ống phóng lôi, cửa mũi / cầu dẫn — h là chiều dài tấm —, đường ống boong, đệm va, cột đơn có sàn + xà — `I.yard` / `I.top` như cột dàn lưới, dùng cho cờ / đèn cột —, ống thông gió nấm / cổ ngỗng, cần hạ xuồng, ống phóng mồi bẫy, thùng boong, cột cờ mũi / lái, tấm chắn sóng, cầu chằng container; ống khói có dải màu `n`), `buildFit`, `fitDefaults`, `mirrorFit`; radar có phần quay riêng; neo: miệng lỗ neo dựng vào màu `hawse` (nằm yên trên vỏ), `I.attach` = chỗ nối xích |
| `trace.js` | dò viền trên ảnh: `traceWand` (đũa thần, vượt nét màu, gộp với chi tiết có sẵn), `traceBox` (bóng nét vẽ trong khung), `fillPoly`, `outline`, `simplify` |
| `calib.js` | `calibrate(view, ship)`: mốc (mũi, lái, đáy ky / mép trái, mép phải) + số đo → tỷ lệ ngang, đứng riêng (bình phương tối thiểu), sai số % từng số đo, `toShip` / `toPx` |
| `model.js` | `buildModel(model, ship)` → mảng đỉnh / tam giác theo tọa độ tàu: thân (gom nhiều mảnh, nội suy chỗ hở, dáng sườn theo mặt cắt hoặc hệ số béo, mũi chữ V, đường nước + dải mớn nước, `hull.yAt` mặt vỏ), nét đã làm mượt (`partShape`: chân khối sát boong tự giữ góc sắc), chân khối vẽ cao hơn boong < 0,45 m thì hạ ngập vào thân, hình mũi ∩ hình lái, cửa kính (buồng lái chính mặc định), chi tiết thư viện (`fitBB`), chi tiết vẽ kiểu cũ (radar, pháo, bè, neo, tời, xuồng) dựng bằng hình thư viện, quả neo (vẽ hoặc thư viện) là khối riêng trong `items` có `pivot` = chỗ nối xích và `anchor: { side, bow }`, lan can mép boong một vòng khép kín (hai mạn gặp nhau ở sống mũi, ngang qua lái, 2 thanh), lan can nóc tầng (đoạn bị khối phía trên che — kể cả sàn mỏng — thì bỏ), số hiệu mạn (`decals` bám mặt vỏ), khối đã dựng `solids` (lát cắt, để đặt điểm nắm đúng mặt khối) và hình chiếu tự sinh `auto` (`fb` nhìn từ mũi / lái, `top`, `side`), khối thượng tầng giao 3 hình chiếu (mỗi lát = hình nhìn từ mũi / lái cắt theo các khoảng của hình mạn và mặt boong: giữ hình thang, vách nghiêng, chỗ khuyết; thiếu hình nào thì bề rộng / chiều cao mặc định; đối xứng nếu ở giữa tàu; `loftRings` nối mặt cắt nhiều cạnh, nhiều mảnh), cho biết chi tiết nào ghép với nhau (`links`), dựng từ hình nào (`src`) và vùng tam giác của từng chi tiết trong `items` (`ranges`, để chọn / sáng khối trên 3D), cột, xà, radar, bệ pháo, xuồng, bè, neo, tời, lan can; đèn, mắt người điều động (tự đặt nếu thiếu), chỗ treo cờ `flag` (xà cao nhất của cột cao nhất), khối buồng lái `bridge` (mặt trước, nửa bề rộng — cho khung cửa kính); diện tích hứng gió `areas` |
| `mesh3.js` | `modelGroup(THREE, geom, { inside, shadows })` → nhóm three.js của cảnh (X = mạn phải, Y = trên đường nước, Z = −mũi): tam giác rời, pháp tuyến theo góc gãy (34°, vỏ 42°), nóc khối màu boong, kính buồng lái bằng shader, sơn PBR, phần quay `userData.spin`, quả neo `userData.anchors` (gốc mesh ở chỗ nối xích), `accMesh` (một bộ gom → mesh, cho quả neo mặc định), số hiệu mạn (canvas, chỉ trong trình duyệt); `inside`: khối chỉ vẽ mặt ngoài để đứng trong buồng lái nhìn xuyên ra; `skyEnv` bầu trời phản chiếu |
| `template.js` | mẫu "tàu pháo cỡ nhỏ" chung chung tự dựng + thông số tab 1 gợi ý |
| `shipgen.js` | dựng mô hình mẫu từ bảng thông số gọn (mét: thân — mũi `raked` / `bulb` / `flat` / `tug`, lái `transom` / `cruiser`, cong dọc boong, boong mũi / lái nâng, mặt cắt `box` / `round` / `v`, mạn chắn sóng nhiều đoạn; khối thượng tầng có vách nghiêng `tw` (thêm hình nhìn từ mũi), sàn đi lại nhô quanh nóc `lip`, mái che nắng buồng lái `visor`; cánh gà, cột, neo, đèn, mắt, chi tiết thư viện) ra đúng định dạng mô hình bàn vẽ (sửa tiếp được; hình boong / mũi của một khối mang `grp` = hình mạn để ghép đúng khối); `deckFn`, `hbFn` |
| `store.js` | ảnh sơ đồ trong IndexedDB `mp_shipimg` |

## Local Contracts

- Tọa độ tàu: x về mũi (gốc giữa chiều dài), y sang mạn phải, z lên từ đáy ky; đường nước z = T. Hình mạn (x, z), mặt boong (x, y), nhìn từ mũi / lái (y, z); nhìn từ mũi thì bên trái hình là mạn phải
- Mô hình lưu trong thông số tàu `A.p.model` = `{ v, name, views:[{ id, kind, name, imgId, iw, ih, refs, dims:[{a,b,m}] }], parts:[{ id, view, type:[id…], pts (điểm ảnh), kind: poly|line|point, note, num:{h,w,l}, curve, sharp:[chỉ số điểm], fillet (m), win, grp (chi tiết chính của khối — nét tạo từ hình tự sinh chỉ ghép vào khối đó) }], guides:[{ ax: x|y|z, v (m) }], fits:[{ id, kind, x, y, z (mét, điểm đặt giữa đáy), rot (độ, từ mũi sang mạn phải), l, w, h, n, bl, rows, cols, el, rpm, note }], opts:{ shade, colors:{ hull, super, deck, boot }, roofDeck, rails, roofRails, hullNo, hullNoCol } }`; điểm chi tiết lưu theo điểm ảnh, đổi sang mét lúc dựng (đổi mốc / số đo là cập nhật ngay)
- Chiều dài mốc mũi–lái lấy LOA, mốc hai mép lấy B ở tab 1; số đo người dùng ghi được ưu tiên hơn mốc
- Đối xứng: nét mặt boong / hình mũi / mặt boong thân tàu vẽ một nửa (không vượt hẳn qua đường tâm, `halfDrawn`) thì lấy đối xứng; vẽ đủ hai mạn thì dựng đúng như vẽ (thân tàu: mỗi mạn một nửa bề rộng `hull.hbs(x, ±1)`)
- Ghép hình chiếu của một khối theo vị trí: mặt boong chồng theo chiều dài với hình mạn, hình mũi / lái chồng theo chiều cao (và bề rộng nếu có mặt boong), cùng nhóm loại (thượng tầng / buồng lái / khác coi như một nhóm); cùng loại đầy đủ thì ưu tiên. Chi tiết chỉ vẽ ở hình mũi / lái không dựng được (báo)
- Bàn vẽ: hình chưa có mốc không hiện trên bàn vẽ (đặt mốc ở chế độ một hình); vẽ vào ô chưa có hình thì app tạo hình trống (lưới 20 điểm ảnh / m, mốc theo kích thước tàu)
- Tam giác của `model.js` dựng sao cho sau phép đổi trục của `mesh3.js` mặt hướng ra ngoài (test kiểm tra bằng thể tích có dấu)
- File xuất `.mohinh.json` = `{ app, loai: 'mo-hinh-tau', v, model, images: { imgId: dataURL } }`
- Bộ gom màu của `model.js`: hull, super, dark, deck, metal, white, orange, yellow, red, blue, green, cgrey, black (chi tiết thư viện gọi màu thiếu thì về `super`)
- Mẫu có sẵn chỉ là mẫu chung chung tự dựng; không đưa sơ đồ / mô hình tàu thật (nhất là tàu quân sự) vào kho; chi tiết thư viện là hình chung chung theo kích thước, chi tiết thư viện của mẫu co theo chiều dài tàu
- «Góc sắc» của một điểm: không làm cong, không bo; nét thẳng có bo góc thì bo mọi góc trừ góc sắc
- Màu theo đỉnh đưa vào three.js phải đổi sRGB → tuyến tính

## Work Guidance

- Người khác phải tự làm được cho tàu của họ: mỗi công cụ có chữ hướng dẫn, chỗ nào thiếu thì app tự suy và báo

## Verification

- `cd app && npm test` (`tests/shipdraw.test.mjs`, `shipdraw3.test.mjs`, `shipdraw4.test.mjs`)

## Child DOX Index

- Không có

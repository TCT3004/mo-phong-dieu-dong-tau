# app/src/shipdraw — vẽ tàu từ sơ đồ

## Purpose

- Dựng mô hình 3D tàu từ sơ đồ (ảnh / PDF, 1–3 hình chiếu) người dùng tự vẽ lại trong app; thiếu hình chiếu thì tự suy

## Ownership

| File | Trách nhiệm |
|---|---|
| `parts.js` | cây chi tiết nhiều nấc `PART_TREE` (nấc cuối có `role` = cách dựng, `key` = đèn nối bảng Đèn tab 3, `side`, `face`…), `resolve`, `childrenAt`, tông xám `SHADES` |
| `trace.js` | dò viền trên ảnh: `traceWand` (đũa thần, vượt nét màu, gộp với chi tiết có sẵn), `traceBox` (bóng nét vẽ trong khung), `fillPoly`, `outline`, `simplify` |
| `calib.js` | `calibrate(view, ship)`: mốc (mũi, lái, đáy ky / mép trái, mép phải) + số đo → tỷ lệ ngang, đứng riêng (bình phương tối thiểu), sai số % từng số đo, `toShip` / `toPx` |
| `model.js` | `buildModel(model, ship)` → mảng đỉnh / tam giác theo tọa độ tàu: thân (gom nhiều mảnh, nội suy chỗ hở, dáng sườn theo mặt cắt hoặc hệ số béo, mũi chữ V, đường nước + dải mớn nước), khối thượng tầng giao 3 hình chiếu (mỗi lát = hình nhìn từ mũi / lái cắt theo các khoảng của hình mạn và mặt boong: giữ hình thang, vách nghiêng, chỗ khuyết; thiếu hình nào thì bề rộng / chiều cao mặc định; đối xứng nếu ở giữa tàu; `loftRings` nối mặt cắt nhiều cạnh, nhiều mảnh), cho biết chi tiết nào ghép với nhau (`links`), dựng từ hình nào (`src`) và vùng tam giác của từng chi tiết trong `items` (`ranges`, để chọn / sáng khối trên 3D), cột, xà, radar, bệ pháo, xuồng, bè, neo, tời, lan can; đèn, mắt người điều động (tự đặt nếu thiếu), chỗ treo cờ `flag` (xà cao nhất của cột cao nhất), khối buồng lái `bridge` (mặt trước, nửa bề rộng — cho khung cửa kính); diện tích hứng gió `areas` |
| `mesh3.js` | `modelGroup(THREE, geom, { inside })` → nhóm three.js của cảnh (X = mạn phải, Y = trên đường nước, Z = −mũi); `inside`: khối chỉ vẽ mặt ngoài để đứng trong buồng lái nhìn xuyên ra |
| `template.js` | mẫu "tàu pháo cỡ nhỏ" chung chung tự dựng + thông số tab 1 gợi ý |
| `store.js` | ảnh sơ đồ trong IndexedDB `mp_shipimg` |

## Local Contracts

- Tọa độ tàu: x về mũi (gốc giữa chiều dài), y sang mạn phải, z lên từ đáy ky; đường nước z = T. Hình mạn (x, z), mặt boong (x, y), nhìn từ mũi / lái (y, z); nhìn từ mũi thì bên trái hình là mạn phải
- Mô hình lưu trong thông số tàu `A.p.model` = `{ v, name, views:[{ id, kind, name, imgId, iw, ih, refs, dims:[{a,b,m}] }], parts:[{ id, view, type:[id…], pts (điểm ảnh), kind: poly|line|point, note, num:{h,w,l} }], guides:[{ ax: x|y|z, v (m) }], opts:{ shade, rails } }`; điểm chi tiết lưu theo điểm ảnh, đổi sang mét lúc dựng (đổi mốc / số đo là cập nhật ngay)
- Chiều dài mốc mũi–lái lấy LOA, mốc hai mép lấy B ở tab 1; số đo người dùng ghi được ưu tiên hơn mốc
- Đối xứng: nét mặt boong / hình mũi / mặt boong thân tàu vẽ một nửa (không vượt hẳn qua đường tâm, `halfDrawn`) thì lấy đối xứng; vẽ đủ hai mạn thì dựng đúng như vẽ (thân tàu: mỗi mạn một nửa bề rộng `hull.hbs(x, ±1)`)
- Ghép hình chiếu của một khối theo vị trí: mặt boong chồng theo chiều dài với hình mạn, hình mũi / lái chồng theo chiều cao (và bề rộng nếu có mặt boong), cùng nhóm loại (thượng tầng / buồng lái / khác coi như một nhóm); cùng loại đầy đủ thì ưu tiên. Chi tiết chỉ vẽ ở hình mũi / lái không dựng được (báo)
- Bàn vẽ: hình chưa có mốc không hiện trên bàn vẽ (đặt mốc ở chế độ một hình); vẽ vào ô chưa có hình thì app tạo hình trống (lưới 20 điểm ảnh / m, mốc theo kích thước tàu)
- Tam giác của `model.js` dựng sao cho sau phép đổi trục của `mesh3.js` mặt hướng ra ngoài (test kiểm tra bằng thể tích có dấu)
- File xuất `.mohinh.json` = `{ app, loai: 'mo-hinh-tau', v, model, images: { imgId: dataURL } }`
- Mẫu có sẵn chỉ là mẫu chung chung tự dựng; không đưa sơ đồ / mô hình tàu thật (nhất là tàu quân sự) vào kho

## Work Guidance

- Người khác phải tự làm được cho tàu của họ: mỗi công cụ có chữ hướng dẫn, chỗ nào thiếu thì app tự suy và báo

## Verification

- `cd app && npm test` (`tests/shipdraw.test.mjs`)

## Child DOX Index

- Không có

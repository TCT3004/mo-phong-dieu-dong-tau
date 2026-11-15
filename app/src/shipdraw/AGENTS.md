# app/src/shipdraw — vẽ tàu từ sơ đồ

## Purpose

- Dựng mô hình 3D tàu từ sơ đồ (ảnh / PDF, 1–3 hình chiếu) người dùng tự vẽ lại trong app; thiếu hình chiếu thì tự suy

## Ownership

| File | Trách nhiệm |
|---|---|
| `parts.js` | cây chi tiết nhiều nấc `PART_TREE` (nấc cuối có `role` = cách dựng, `key` = đèn nối bảng Đèn tab 3, `side`, `face`…), `resolve`, `childrenAt`, tông xám `SHADES` |
| `trace.js` | dò viền trên ảnh: `traceWand` (đũa thần, vượt nét màu, gộp với chi tiết có sẵn), `traceBox` (bóng nét vẽ trong khung), `fillPoly`, `outline`, `simplify` |
| `calib.js` | `calibrate(view, ship)`: mốc (mũi, lái, đáy ky / mép trái, mép phải) + số đo → tỷ lệ ngang, đứng riêng (bình phương tối thiểu), sai số % từng số đo, `toShip` / `toPx` |
| `model.js` | `buildModel(model, ship)` → mảng đỉnh / tam giác theo tọa độ tàu: thân (gom nhiều mảnh, nội suy chỗ hở, dáng sườn theo mặt cắt hoặc hệ số béo, mũi chữ V, đường nước + dải mớn nước), khối thượng tầng (cắt theo hình mạn × mặt boong / mặt cắt / bề rộng mặc định, đối xứng nếu ở giữa tàu), cột, xà, radar, bệ pháo, xuồng, bè, neo, tời, lan can; đèn, mắt người điều động (tự đặt nếu thiếu); diện tích hứng gió `areas` |
| `mesh3.js` | `modelGroup(THREE, geom, { inside })` → nhóm three.js của cảnh (X = mạn phải, Y = trên đường nước, Z = −mũi); `inside`: khối chỉ vẽ mặt ngoài để đứng trong buồng lái nhìn xuyên ra |
| `template.js` | mẫu "tàu pháo cỡ nhỏ" chung chung tự dựng + thông số tab 1 gợi ý |
| `store.js` | ảnh sơ đồ trong IndexedDB `mp_shipimg` |

## Local Contracts

- Tọa độ tàu: x về mũi (gốc giữa chiều dài), y sang mạn phải, z lên từ đáy ky; đường nước z = T. Hình mạn (x, z), mặt boong (x, y), nhìn từ mũi / lái (y, z); nhìn từ mũi thì bên trái hình là mạn phải
- Mô hình lưu trong thông số tàu `A.p.model` = `{ v, name, views:[{ id, kind, name, imgId, iw, ih, refs, dims:[{a,b,m}] }], parts:[{ id, view, type:[id…], pts (điểm ảnh), kind: poly|line|point, note, num:{h,w,l} }], opts:{ shade, rails } }`; điểm chi tiết lưu theo điểm ảnh, đổi sang mét lúc dựng (đổi mốc / số đo là cập nhật ngay)
- Chiều dài mốc mũi–lái lấy LOA, mốc hai mép lấy B ở tab 1; số đo người dùng ghi được ưu tiên hơn mốc
- Tam giác của `model.js` dựng sao cho sau phép đổi trục của `mesh3.js` mặt hướng ra ngoài (test kiểm tra bằng thể tích có dấu)
- File xuất `.mohinh.json` = `{ app, loai: 'mo-hinh-tau', v, model, images: { imgId: dataURL } }`
- Mẫu có sẵn chỉ là mẫu chung chung tự dựng; không đưa sơ đồ / mô hình tàu thật (nhất là tàu quân sự) vào kho

## Work Guidance

- Người khác phải tự làm được cho tàu của họ: mỗi công cụ có chữ hướng dẫn, chỗ nào thiếu thì app tự suy và báo

## Verification

- `cd app && npm test` (`tests/shipdraw.test.mjs`)

## Child DOX Index

- Không có

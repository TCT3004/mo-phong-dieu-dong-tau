# Mô phỏng điều động tàu 3D

Phần mềm mô phỏng 3D dành cho **người điều động tàu** (không phải người lái), chạy offline trên Windows.
Bản thử nghiệm v0.3.9 — giai đoạn 3: vẽ mô hình tàu từ sơ đồ (mặt mượt, màu thật, thư viện chi tiết), cờ trên tàu, dữ liệu cảng nạp từ file, vệt nước sau tàu, cây / nhà trên bờ, kho tàu 12 mẫu, tàu đậu ở cảng.

## Các phần chính

| Tab | Nội dung |
|---|---|
| 1 · Thông số tàu | **Kho tàu**: chọn loại → tên tàu là nạp luôn làm tàu điều động (có sẵn 12 tàu mẫu chung chung: tàu hàng 50 m, tàu hàng có cẩu 90 m, tàu container 100 m, tàu dầu 70 m, tàu khách 40 m, tàu lai 30 m, tàu pháo 62 m, tàu tên lửa 50 m, tàu phóng lôi 35 m, tàu tuần tra 45 m, tàu hộ vệ 100 m, tàu đổ bộ 80 m), tàu tự vẽ thì «Lưu vào kho» để dùng lại; kích thước, mớn nước, máy (1–4 máy, chân vịt FPP/CPP, chiều quay từng chân vịt, tỷ số hộp số), bảng nấc máy (app tự hiệu chỉnh cho khớp tốc độ từng nấc và đường kính quay trở, nhắc khi số liệu bất thường), bánh lái, neo, dây buộc, diện tích hứng gió; **vẽ tàu từ sơ đồ** trên bàn vẽ 3 hình chiếu (mạn · mặt boong · nhìn từ mũi / lái cùng tỷ lệ, vạch gióng, thước kiểu CAD: bắt dính, vẽ thẳng, gõ số; ảnh / PDF sơ đồ làm nền, dò viền tự động): app giao 3 hình chiếu thành mô hình 3D, sửa được ngay trên 3D (kéo điểm nắm, dời khối, xem thẳng từ trên / mạn / mũi), có hoàn tác / làm lại; nét thẳng hoặc cong mềm, bo góc theo bán kính; hình nhìn từ mũi / lái (và hình chiếu còn thiếu) tự sinh, kéo điểm là thành nét thật; điểm nắm ở cả hai đầu khối, bấm đúp lên cạnh để thêm điểm; thư viện chi tiết đặt trên 3D (cột dàn lưới, radar quay, vòm radar, ăng-ten, bè, neo, tời, cột bích, đèn pha, còi, cầu thang, ống khói, tháp pháo, giá phóng, xuồng, cần cẩu hàng, nắp hầm hàng, container, ống phóng lôi, cửa mũi / cầu dẫn, đường ống boong, đệm va); màu vỏ / thượng tầng / boong / dải đường nước, nóc tầng màu boong, số hiệu mạn, cửa kính, lan can nóc tầng, ánh sáng phản chiếu bầu trời và bóng đổ — buồng lái, đèn, hứng gió theo mô hình; cờ trên cột cao nhất (cờ Tổ quốc + cờ Hải quân, chỉ cờ Tổ quốc, hoặc không treo) |
| 2 · Cảng & luồng | Kho hải đồ `.kap` và PDF: các tờ ghép liền mạch theo tọa độ như OpenCPN (tờ tỷ lệ lớn nằm trên, kéo / phóng to thu nhỏ mượt), tìm tờ theo tên / tọa độ, lưới kinh vĩ để kiểm tra, chọn datum và dời tay cho từng tờ; cầu bến, cọc bích, đèn / phao / tiêu (chớp nhóm), tuyến đi, vị trí xuất phát (lưu theo tọa độ WGS-84); **tàu đậu ở cảng**: chọn tàu trong kho, cập mạn trái / phải, cập lái (2 neo mũi), cập mạn tàu khác (nhiều lớp), đậu neo; dây buộc và xích neo sửa từng cái; kéo để dời; lưu ra / mở từ file đối tượng (kèm tàu đậu và mô hình tàu) để chép sang máy khác; nút «Về tàu» |
| 3 · Điều động | Buồng lái 3 cửa sổ gắn trên tàu (kéo chuột để quay đầu nhìn sang); cảnh 3D có vệt nước sau lái, sóng mũi, nước sủi khi lùi, cây / nhà / kho trên bờ (đèn nhà ban đêm), quầng sáng và vệt phản chiếu của đèn phao; tàu đậu nhấp nhô theo sóng (cả trên hải đồ nhỏ, radar; chạm vào là va chạm, đưa dây sang cọc bích tàu đậu được); radar (tới 24 Hl, EBL/VRM), hải đồ nhỏ, khẩu lệnh lái tiếng Việt, tay chuông máy, vô lăng, neo (mỗi neo chọn tốc độ tời cấp 1 / cấp 2 cho thả và kéo, thả tự do; quả neo 3D rơi theo xích, nằm đáy, kéo lên về đúng chỗ cũ), dây, đèn hành trình, còi theo COLREG, chuông, báo động |
| 4 · Môi trường & kịch bản | Gió, dòng chảy, sóng (độ cao, hướng, bước sóng), thủy triều, tầm nhìn, giờ trong ngày; hoặc thời tiết «Ngẫu nhiên»: app tự đổi nắng, mây, mưa, giông (có sấm sét), sương mù theo thời gian chạy bài; ánh sáng xem thử (theo giờ / ngày / hoàng hôn / đêm), sương mù dày; vị trí xuất phát có sẵn |
| 5 · Xem lại | Phát lại bài tập 2D / 3D, đồ thị, xuất video |

Mô hình chuyển động: kiểu MMG 3 bậc tự do (thân tàu, chân vịt, bánh lái), có squat, hiệu ứng bờ, chân vịt kéo lái, gió, dòng chảy, sóng.

Tọa độ: toàn app dùng WGS-84. Hải đồ VN-2000 (ghi trong file KAP, hoặc chọn khi nạp PDF) được chuyển sang WGS-84 theo tham số EPSG:6960. Độ sâu, radar, địa hình 3D ghép từ mọi tờ đã nạp; ngoài vùng hải đồ là biển trống sâu 30 m.

Nạp hải đồ PDF: tab 2 → «Thêm hải đồ PDF…», nhập tỷ lệ, chọn datum, phóng sát và bấm vào 2–4 giao điểm lưới kinh vĩ rồi gõ tọa độ in ở mép, bấm các góc khung trong để cắt lề, xem sai số rồi nạp.

Phím tắt ở tab 3: **phím cách** chạy / tạm dừng · **← / →** đánh lái từng nấc · **↑ / ↓** tăng / giảm một nấc máy.

## Cấu trúc thư mục

```
app/        mã nguồn chính (JavaScript, three.js, pdf.js) → đóng thành 1 file HTML
  src/      physics.js (mô hình tàu), world.js (môi trường, neo, dây), view3d.js (3D), radar.js,
            geo/ (phép chiếu, datum, tọa độ), charts/ (đọc KAP / PDF, georef, kho hải đồ),
            render/ (vẽ hải đồ WebGL2), depth/ (độ sâu nhiều tờ), shipdraw/ (vẽ tàu từ sơ đồ),
            weather.js (thời tiết ngẫu nhiên), wake.js (vệt nước), scenery.js (cây / nhà trên bờ),
            fleet.js (kho tàu), moored.js / moored3d.js (tàu đậu ở cảng),
            windage.js, ui_*.js (giao diện)
electron/   vỏ Electron để đóng gói thành file .exe chạy luôn (portable)
```

## Tự build

Cần Node.js 18 trở lên.

```bash
cd app
npm install
npm run build          # tạo app/dist/MoPhongDieuDongTau.html (mở bằng Chrome / Edge là chạy)
npm test               # chạy unit test

# đóng gói .exe cho Windows
cp dist/MoPhongDieuDongTau.html ../electron/index.html
cd ../electron
npm install
npx electron-builder --win portable --x64   # tạo electron/dist/MoPhongDieuDongTau-0.3.9.exe
```

File `.exe` chưa có chữ ký số: lần đầu mở, nếu Windows chặn thì bấm **More info → Run anyway**.

## Lưu ý

- Kho mã **không kèm hải đồ** (file `.kap`, `.pdf`) vì đó là dữ liệu có bản quyền của đơn vị phát hành hải đồ. Khi chạy, nạp hải đồ của mình ở tab 2.
- Kho mã cũng không kèm sơ đồ hay mô hình tàu thật. Mẫu «tàu pháo» trong app là mẫu chung chung tự dựng; sơ đồ tàu của mình nạp và vẽ ngay trên máy, có thể xuất file `.mohinh.json` để chép sang máy khác.
- Dữ liệu cảng thật (cầu bến, phao, tuyến vào) không đưa vào kho mã; dùng file đối tượng `.json` nạp ở tab 2.
- Dữ liệu (tàu, kho hải đồ, bài tập) lưu ngay trong máy, không gửi đi đâu. Dữ liệu của bản 0.1 được chuyển sang tự động ở lần mở đầu tiên.

## Giai đoạn tiếp theo

- Giai đoạn 4 (0.4.x): tự đọc số độ sâu, độ cao trên hải đồ PDF vector; thủy triều theo trạm chính (nhập bảng triều từ ảnh) và số hiệu chỉnh cảng phụ.
- Giai đoạn 5 (0.5.x): các tàu khác — tàu lai, tàu trên luồng, tàu đậu sẵn ở bến, tình huống tránh va.

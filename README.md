# Mô phỏng điều động tàu 3D

Phần mềm mô phỏng 3D dành cho **người điều động tàu** (không phải người lái), chạy offline trên Windows.
Bản thử nghiệm v0.3.1 — giai đoạn 3: vẽ mô hình tàu từ sơ đồ.

## Các phần chính

| Tab | Nội dung |
|---|---|
| 1 · Thông số tàu | Kích thước, mớn nước, máy (1–4 máy, chân vịt FPP/CPP), bảng nấc máy, bánh lái, neo, dây buộc, diện tích hứng gió; **vẽ tàu từ sơ đồ** (ảnh / PDF, 1–3 hình chiếu): app dò viền, người dùng chấm sửa và chọn loại chi tiết, app dựng mô hình 3D — buồng lái, đèn, hứng gió theo mô hình |
| 2 · Cảng & luồng | Kho hải đồ `.kap` và PDF: các tờ ghép liền mạch theo tọa độ như OpenCPN (tờ tỷ lệ lớn nằm trên, kéo / phóng to thu nhỏ mượt), tìm tờ theo tên / tọa độ, lưới kinh vĩ để kiểm tra, chọn datum và dời tay cho từng tờ; cầu bến, cọc bích, đèn phao, tuyến đi, vị trí xuất phát (lưu theo tọa độ WGS-84) |
| 3 · Điều động | Buồng lái 3 cửa sổ, radar (tới 24 Hl, EBL/VRM), hải đồ nhỏ, khẩu lệnh lái tiếng Việt, tay chuông máy, vô lăng, neo, dây, đèn hành trình, còi theo COLREG, chuông, báo động |
| 4 · Môi trường & kịch bản | Gió, dòng chảy, sóng (độ cao, hướng, bước sóng), thủy triều, tầm nhìn, giờ trong ngày; hoặc thời tiết «Ngẫu nhiên»: app tự đổi nắng, mây, mưa, giông (có sấm sét), sương mù theo thời gian chạy bài |
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
            weather.js (thời tiết ngẫu nhiên), windage.js, ui_*.js (giao diện)
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
npx electron-builder --win portable --x64   # tạo electron/dist/MoPhongDieuDongTau-0.3.1.exe
```

File `.exe` chưa có chữ ký số: lần đầu mở, nếu Windows chặn thì bấm **More info → Run anyway**.

## Lưu ý

- Kho mã **không kèm hải đồ** (file `.kap`, `.pdf`) vì đó là dữ liệu có bản quyền của đơn vị phát hành hải đồ. Khi chạy, nạp hải đồ của mình ở tab 2.
- Kho mã cũng không kèm sơ đồ hay mô hình tàu thật. Mẫu «tàu pháo» trong app là mẫu chung chung tự dựng; sơ đồ tàu của mình nạp và vẽ ngay trên máy, có thể xuất file `.mohinh.json` để chép sang máy khác.
- Dữ liệu (tàu, kho hải đồ, bài tập) lưu ngay trong máy, không gửi đi đâu. Dữ liệu của bản 0.1 được chuyển sang tự động ở lần mở đầu tiên.

## Giai đoạn tiếp theo

- Giai đoạn 3 (0.3.x): dựng mô hình 3D tàu từ sơ đồ / ảnh (1–3 hình chiếu): app dò viền, người dùng chấm sửa, chọn chi tiết theo nhiều nấc (thân, thượng tầng, buồng lái, cột, đèn…), ghi kích thước; thiếu hình chiếu thì app tự suy.
- Giai đoạn 4 (0.4.x): tự đọc số độ sâu, độ cao trên hải đồ PDF vector; dữ liệu cảng thật.
- Giai đoạn 5 (0.5.x): các tàu khác — tàu lai, tàu trên luồng, tình huống tránh va.

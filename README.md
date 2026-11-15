# Mô phỏng điều động tàu 3D

Phần mềm mô phỏng 3D dành cho **người điều động tàu** (không phải người lái), chạy offline trên Windows.
Đây là bản thử nghiệm, kết thúc giai đoạn 1.

## Các phần chính

| Tab | Nội dung |
|---|---|
| 1 · Thông số tàu | Kích thước, mớn nước, máy (1–4 máy, chân vịt FPP/CPP), bảng nấc máy, bánh lái, neo, dây buộc, diện tích hứng gió (tính được từ sơ đồ tàu PDF / ảnh scan) |
| 2 · Cảng & luồng | Thư viện hải đồ `.kap` (như OpenCPN), tìm hải đồ theo tên / tọa độ, cầu bến, cọc bích, đèn phao, tuyến đi, vị trí xuất phát |
| 3 · Điều động | Buồng lái 3 cửa sổ, radar (tới 24 Hl, EBL/VRM), hải đồ nhỏ, khẩu lệnh lái tiếng Việt, tay chuông máy, vô lăng, neo, dây, đèn hành trình, còi theo COLREG, chuông, báo động |
| 4 · Môi trường & kịch bản | Gió, dòng chảy, sóng, thủy triều, tầm nhìn, giờ trong ngày |
| 5 · Xem lại | Phát lại bài tập 2D / 3D, đồ thị, xuất video |

Mô hình chuyển động: kiểu MMG 3 bậc tự do (thân tàu, chân vịt, bánh lái), có squat, hiệu ứng bờ, chân vịt kéo lái, gió, dòng chảy, sóng.

Phím tắt ở tab 3: **phím cách** chạy / tạm dừng · **← / →** đánh lái từng nấc · **↑ / ↓** tăng / giảm một nấc máy.

## Cấu trúc thư mục

```
app/        mã nguồn chính (JavaScript, three.js, pdf.js) → đóng thành 1 file HTML
  src/      physics.js (mô hình tàu), world.js (môi trường, neo, dây), view3d.js (3D),
            radar.js, kap.js (đọc hải đồ BSB/KAP), windage.js (diện tích hứng gió), ui_*.js (giao diện)
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
npx electron-builder --win portable --x64   # tạo electron/dist/MoPhongDieuDongTau-0.1.0.exe
```

File `.exe` chưa có chữ ký số: lần đầu mở, nếu Windows chặn thì bấm **More info → Run anyway**.

## Lưu ý

- Kho mã **không kèm hải đồ** (file `.kap`, `.pdf`) vì đó là dữ liệu có bản quyền của đơn vị phát hành hải đồ. Khi chạy, nạp hải đồ của mình ở tab 2.
- Dữ liệu (tàu, hải đồ đã nạp, bài tập) lưu ngay trong máy, không gửi đi đâu.

## Giai đoạn tiếp theo

Giai đoạn 2: hệ tọa độ chung, xem nhiều hải đồ liền mạch kiểu OpenCPN, nạp hải đồ PDF vector (tự đọc số độ sâu, độ cao), mô hình độ sâu và địa hình ghép từ nhiều tờ, dữ liệu cảng thật.
Giai đoạn 3: tàu lai, tàu khác trên luồng, tình huống tránh va.

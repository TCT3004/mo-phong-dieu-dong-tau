# electron — vỏ Electron

## Purpose

- Đóng gói file HTML đã build thành `.exe` portable cho Windows x64

## Ownership

- `main.js`: cửa sổ phóng to, F11 toàn màn hình, không menu, nạp `index.html`
- `package.json`: cấu hình electron-builder (target `portable`, tên `MoPhongDieuDongTau-<version>.exe`, không ký số)

## Local Contracts

- `index.html` là bản chép của `app/dist/MoPhongDieuDongTau.html`, không commit
- File `.exe` không commit; phát hành qua GitHub Releases

## Work Guidance

- Đóng gói: `cp ../app/dist/MoPhongDieuDongTau.html index.html && npm install && npx electron-builder --win portable --x64`

## Verification

## Child DOX Index

- Không có

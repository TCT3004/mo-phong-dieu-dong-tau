# app — ứng dụng web

## Purpose

- Toàn bộ ứng dụng mô phỏng, bundle thành `app/dist/MoPhongDieuDongTau.html` (một file, chạy offline)

## Ownership

- `build.mjs`: bundle esbuild (IIFE, target es2022) vào `src/template.html` tại chỗ `/*BUNDLE*/`; tạo `src/_pdfworker.js` từ pdf.js worker (bundle IIFE để chạy được dưới `file://`)
- `package.json`: phụ thuộc `three`, `pdfjs-dist`, `esbuild`
- `src/`: mã nguồn (xem `src/AGENTS.md`)
- `tests/`: unit test Node (xem `tests/AGENTS.md`)

## Local Contracts

- `src/_pdfworker.js` và `dist/` là sản phẩm build, không sửa tay, không commit
- Mọi tài nguyên (shader, worker, font chữ số) phải nằm trong bundle; không tải gì từ mạng lúc chạy

## Work Guidance

- Build: `cd app && npm install && npm run build`
- Kiểm thử: `npm test`

## Verification

- `npm run build` phải in `built ... KB` không lỗi
- `npm test` phải pass hết

## Child DOX Index

- `src/AGENTS.md` — các module nguồn, quy ước tọa độ, lưu trữ, giao diện
- `tests/AGENTS.md` — unit test

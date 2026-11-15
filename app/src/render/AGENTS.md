# app/src/render — vẽ hải đồ

## Purpose

- Chọn tờ (quilting) và vẽ hải đồ liền mạch nhiều tờ

## Ownership

| File | Trách nhiệm |
|---|---|
| `quilt.js` | `selectCharts(recs, vp, { under })` → `{ draw: [thô → chi tiết], ref }` |

## Local Contracts

- Tọa độ khung nhìn và tờ hải đồ theo m Mercator WGS-84 (`geo/proj.js`); tính đa giác quanh tâm khung nhìn (đơn vị km) để tránh sai số số học
- Ưu tiên tờ chi tiết nhất; bỏ tờ bị tờ chi tiết hơn che kín; bỏ tờ thu nhỏ quá `under` lần (mặc định 8, quyết định D6)

## Work Guidance

## Verification

- `cd app && npm test` (`tests/charts.test.mjs`)

## Child DOX Index

- Không có

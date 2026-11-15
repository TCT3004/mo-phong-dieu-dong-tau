# app/src/depth — độ sâu

## Purpose

- Tra lớp đáy / độ sâu tại một điểm khi có nhiều tờ hải đồ chồng nhau

## Ownership

| File | Trách nhiệm |
|---|---|
| `provider.js` | `DepthProvider`: `ensure(bbox)` nạp lưới các tờ trong vùng, `sample(X, Y)` → `{ cls, rec }` (tờ chi tiết nhất có PLY chứa điểm), `drop`, `forget`, `loadedSince` |

## Local Contracts

- Tọa độ vào là m Mercator WGS-84; lớp 0 đất, 1 bãi cạn hở, 2 nông, 3 nông vừa, 4 sâu; ngoài mọi tờ trả `rec = null`
- Đổi lớp → mét bằng `classDepth` của chính tờ đó (ở `world.depthAt`)
- Lưới nạp bất đồng bộ: trước khi nạp xong điểm đó coi như ngoài hải đồ; nơi gọi phải `ensure` trước vùng cần dùng

## Work Guidance

## Verification

## Child DOX Index

- Không có

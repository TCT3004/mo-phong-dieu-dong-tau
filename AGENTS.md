# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

> DOX framework © 2026 Agent Zero — MIT License (`LICENSE-DOX`), https://github.com/agent0ai/dox

## Project

- Mô phỏng điều động tàu 3D cho **người điều động** (không phải người lái), offline, Windows
- JavaScript ES modules + three.js + pdf.js, bundle bằng esbuild thành **1 file HTML**; Electron bọc thành `.exe` portable
- Giai đoạn 1 xong (v0.1.0). Giai đoạn 2 xong các mốc M1–M6 (v0.2.0): hải đồ liền mạch kiểu OpenCPN (quilting), mét thế giới + gốc trôi, kho hải đồ KAP / PDF, độ sâu ghép nhiều tờ. Còn: đọc số độ sâu trên PDF vector, dữ liệu cảng thật

## Project-wide Rules

- Giao diện, chú thích code, commit message, tài liệu: **tiếng Việt**
- Đơn vị hiển thị: tốc độ hl/h; khoảng cách Hl, dưới 0,3 Hl đổi sang m; góc độ (°); độ sâu m
- Không commit hải đồ (`.kap`, `.pdf` hải đồ), file `.exe`, `node_modules`, `app/dist` — hải đồ có bản quyền của đơn vị phát hành
- Bản build phải chạy được từ `file://` (mở trực tiếp file HTML) và trong Electron: không dùng module worker; worker tạo từ Blob kiểu classic
- Không thêm framework UI; thư viện ngoài chỉ thêm khi nhỏ và bundle được vào file HTML
- Làm xong phần nào commit và push lên `main` (người khác theo dõi và sửa trên GitHub)

## Phase 2 Decisions (đã duyệt)

- D1: "mét thế giới" = Mercator elipxoit WGS‑84 ÷ hệ số phóng tại φ₀ (Mercator cầu bị loại vì lệch tỷ lệ 0,65% ở 21°N), gốc theo bài tập, có gốc trôi; mọi dữ liệu lưu bằng WGS‑84 lat/lon (`app/src/geo/`)
- D2: renderer hải đồ WebGL2 thuần, một context dùng chung tab 2 và tab 3
- D3: được dùng `earcut` và `polygon-clipping`
- D4: cache ô ảnh hải đồ trên đĩa, giới hạn dung lượng chỉnh được
- D5: cầu bến, cọc bích, tuyến đi lưu theo lat/lon toàn cục, có chuyển dữ liệu cũ tự động
- D6: chọn tờ hải đồ: phóng to tối đa ×4, thu nhỏ tối đa ×8 so với tỷ lệ gốc (chỉnh được)
- **Toàn app dùng WGS‑84**: tọa độ hiển thị, nhập và lưu đều là WGS‑84. Hải đồ của người dùng phần lớn là VN‑2000 (KAP hoặc PDF) và được chuyển sang WGS‑84 khi nạp (EPSG:6960, lệch ≈ 224 m ở Vạn Hoa); KAP theo datum ghi ở `GD`, không ghi thì coi như WGS‑84 và báo cho người dùng
- Người dùng nhập hải đồ vào kho của app rồi app đọc
- Bài tập theo tuyến hành trình, trước mắt dưới 100 Hl

## User Preferences

- Người dùng là sĩ quan điều động; khẩu lệnh lái / máy tiếng Việt; tay chuông Tiến max/3/2/1, Dừng, Lùi 1/2
- Phím tắt tab 3: phím cách chạy / tạm dừng; ← / → đánh lái từng nấc (lái tự động: đổi hướng đặt 1°); ↑ / ↓ tăng / giảm một nấc máy
- Máy đích: Lenovo LOQ (RTX 3050), 1 màn hình; tab 3 phải vừa một màn hình, không cuộn
- Mặc định bước sóng ×4 và tốc độ lắc tàu ×4 (chỉnh trong Cài đặt)

## Child DOX Index

- `app/AGENTS.md` — ứng dụng web: build 1 file HTML, phụ thuộc, cấu trúc nguồn
- `electron/AGENTS.md` — vỏ Electron và đóng gói `.exe`
- Gốc giữ: `README.md` (giới thiệu cho người dùng), `LICENSE-DOX`, `.gitignore`

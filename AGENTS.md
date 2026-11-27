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
- Giai đoạn 1 xong (v0.1.0). Giai đoạn 2 xong (v0.2.0): hải đồ liền mạch kiểu OpenCPN (quilting), mét thế giới + gốc trôi, kho hải đồ KAP / PDF, độ sâu ghép nhiều tờ
- Giai đoạn 3 đang làm: 0.3.0 nấc lái theo góc lái tối đa, thời tiết ngẫu nhiên; 0.3.1 vẽ tàu từ sơ đồ (dò viền + chấm tay, chọn chi tiết nhiều nấc, đo kích thước, tự suy hình chiếu thiếu); 0.3.2 cờ trên tàu, ánh sáng / sương mù sang tab 4, nút «Về tàu» tab 2, file đối tượng hải đồ + vị trí xuất phát có sẵn, dữ liệu cảng thật dựng từ hải đồ (giao riêng, không commit); 0.3.3 tỷ số hộp số, câu nhắc số liệu tàu lạ, sửa quay trở ra NaN; 0.3.4 bàn vẽ 3 hình chiếu + thước CAD, 3D giao 3 hình chiếu, chiều quay từng chân vịt; 0.3.5 sửa trên 3D + hoàn tác, đối xứng thông minh, buồng lái 3 ô gắn trên tàu (quay đầu thì cụm ô trượt); 0.3.6 tàu đẹp giống thật: mặt mượt (pháp tuyến theo góc gãy, nét cong mềm, bo góc, chân khối ngập boong), màu + số hiệu mạn + cửa kính, ánh sáng PBR + bóng đổ, thư viện chi tiết đặt trên 3D, điểm nắm hai đầu khối, hình mũi / lái tự sinh; 0.3.7 neo: quả neo 3D rơi theo xích, nằm đáy, thu về đúng chỗ cũ; tời cấp 1 / cấp 2 riêng từng neo; thả tự do; 0.3.8 cảnh: vệt nước sau lái (vệt chân vịt + hai cánh sóng Kelvin), sóng mũi, nước sủi ở lái khi lùi, cây / nhà / kho trên bờ dựng từ đất hải đồ (đèn nhà ban đêm), quầng sáng + vệt phản chiếu của đèn phao ban đêm; 0.3.9 kho tàu (12 mẫu chung chung chạy được + tàu người dùng lưu, chọn loại → tên ở tab 1), tàu đậu ở cảng (tab 2: cập mạn trái / phải, cập lái 2 neo, cập mạn tàu khác nhiều lớp, đậu neo; dây + neo sửa được; khi chạy có 3D nhấp nhô, hải đồ nhỏ, radar, va chạm, đưa dây sang tàu đậu); 0.3.10 sửa theo góp ý: tàu đậu không còn «sàn» dưới tàu, trước cầu bến / dưới tàu đậu là nước, lan can khép kín ở mũi, ô dây buộc gọn và đọc rõ, hướng mũi tàu đậu chỉnh lệch được, mở vẽ tàu theo đúng tàu đang dùng, tàu mẫu thêm nhiều chi tiết (vách nghiêng, sàn đi lại, mái che, ống khói, cột radar, xuồng + cần, tời, thông gió, mồi bẫy…), cảnh báo neo trôi xuống dưới các ô neo; 0.3.11 đáy thân tàu kín, thượng tầng tự chồng tầng (test chống lơ lửng), 2 kiểu tàu đổ bộ (mũi bằng cầu dẫn, cửa mũi hai cánh), kéo / xóa neo tàu đậu, hộp thoại của app thay hộp thoại Windows
- Giai đoạn 4 đang làm: 0.4.0 đọc hải đồ KAP raster — số đo sâu (cả phần lẻ, độ cao bãi cạn), độ cao núi (chấm / ngoặc), đường bình độ → núi; mặt đáy theo số đo sâu, viền đất / bãi / nước đúng từng điểm ảnh; xem / sửa / thêm điểm ở tab 2; địa hình 3D theo độ cao thật, lưới rất mịn quanh tàu; 0.4.1 nội suy mặt nước theo số đo sâu + độ dốc bờ (hết nông giả giữa các hòn gần nhau, tờ đã đọc tự dựng lại mặt nước); 0.4.2 chia vùng theo màu nước (dải độ sâu tự suy từ số đo, luồng nạo vét theo số đo trong luồng, tờ đã đọc tự lấy màu nước và dựng lại mặt nước); 0.4.3 điểm nghi đọc sai hiện rõ (vòng vàng nhấp nháy, thấy cả khi thu nhỏ, nút «‹ Trước · Sau ›», chỉ hiện điểm nghi), hàng chờ đọc độ sâu (tờ người dùng bấm làm ngay, ghi thứ tự chờ, quá 10 phút không tiến triển thì báo lỗi); 0.4.4 đọc đường đẳng sâu trên hải đồ KAP (giá trị suy từ số đo hai bên, góp vào nội suy mặt nước, tờ đã đọc tự lấy từ ảnh), mở file đối tượng thì kho tàu cập nhật ngay
- Lộ trình: giai đoạn 4 (0.4.x) còn đọc số độ sâu trên hải đồ PDF vector, triều Hòn Dáu (nhập bảng triều từ ảnh, số hiệu chỉnh cảng phụ); giai đoạn 5 (0.5.x) các tàu khác chạy được (tàu lai, tàu trên luồng, tránh va)

## Project-wide Rules

- Giao diện, chú thích code, commit message, tài liệu: **tiếng Việt**
- Đơn vị hiển thị: tốc độ hl/h; khoảng cách Hl, dưới 0,3 Hl đổi sang m; góc độ (°); độ sâu m
- Không commit hải đồ (`.kap`, `.pdf` hải đồ), file `.exe`, `node_modules`, `app/dist` — hải đồ có bản quyền của đơn vị phát hành
- Bản build phải chạy được từ `file://` (mở trực tiếp file HTML) và trong Electron: không dùng module worker; worker tạo từ Blob kiểu classic
- Không thêm framework UI; thư viện ngoài chỉ thêm khi nhỏ và bundle được vào file HTML
- Làm xong phần nào commit và push lên `main` (người khác theo dõi và sửa trên GitHub)
- Phiên bản: giai đoạn N phát hành `0.N.0`; mỗi đợt yêu cầu thêm trong giai đoạn tăng số cuối (`0.N.1`, `0.N.2`…); ghi ở `app/package.json` và `electron/package.json` (`version`, `artifactName`)
- Kho GitHub công khai: không đưa sơ đồ hay mô hình tàu quân sự cụ thể lên; mẫu tàu có sẵn trong app phải là mẫu chung chung tự dựng
- Dữ liệu cảng thật (nhất là cảng quân sự: cầu bến, phao, tuyến vào) không commit; dựng thành file đối tượng `.json` gửi riêng cho người dùng nạp ở tab 2

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
- Khẩu lệnh máy tàu 2 máy: cùng nấc hô «2 máy tiến 1», «2 máy lùi»; tách riêng hô gộp một câu «Trái tiến 1, phải dừng»
- Mục tiêu: một app làm được mọi việc điều động; độ sâu sát thực tế và mô hình tàu giống thật là ưu tiên
- Người khác sẽ tự dùng app cho tàu của họ (tự nạp sơ đồ, tự vẽ): công cụ phải tự giải thích, không cần người làm app hướng dẫn
- Phím tắt tab 3: phím cách chạy / tạm dừng; ← / → đánh lái từng nấc (lái tự động: đổi hướng đặt 1°); ↑ / ↓ tăng / giảm một nấc máy
- Máy đích: Lenovo LOQ (RTX 3050), 1 màn hình; tab 3 phải vừa một màn hình, không cuộn
- Bước sóng chỉnh theo m ở tab 4, mặc định 225 m (tương đương «×4» cũ); tốc độ lắc tàu mặc định ×4 (Cài đặt)
- Nút lệnh lái: 5 · 10 · 15 · hết lái, hết lái lấy đúng góc lái tối đa ở tab 1 (tàu chiến thường 25°); vạch giữa thanh quay trở phải thẳng hàng với kim góc lái
- Thời tiết «Ngẫu nhiên» ở tab 4: app tự đổi gió, sóng, mưa, giông, sương mù theo thời gian chạy bài; ngày / đêm luôn theo giờ, không đổi đột ngột
- Nút ánh sáng xem thử (Theo giờ / Ngày / Hoàng hôn / Đêm) và Sương mù dày nằm ở tab 4, không ở tab 3
- Cờ: cờ Tổ quốc và cờ Hải quân trên cột cao nhất, cờ Tổ quốc mạn phải, cờ Hải quân mạn trái thấp hơn 20 cm (nhìn từ lái lên mũi)
- Chiều quay chân vịt: người dùng tự chọn cho từng chiếc (1–4 chân vịt), app không đặt sẵn
- Buồng lái giữ 3 ô cửa sổ như cũ (viền đen, hai ô bên nghiêng), gắn trên tàu: mỗi ô nhìn cố định so với tàu; kéo chuột = quay đầu, cả cụm 3 ô trượt trên màn hình; không dựng khung bằng thanh 3D
- Vẽ tàu: bàn vẽ 3 hình chiếu kiểu bản vẽ kỹ thuật với vạch gióng và thước kiểu CAD, sửa được trên 3D như CAD; vẽ đủ hai mạn thì dựng đúng như vẽ (chỗ lõm một bên vẫn giữ)
- Tàu phải giống thật hết mức có thể; «mượt» nghĩa là mặt tàu không gấp khúc, không bị chia cắt; tàu mẫu tham khảo là kiểu vỏ trắng xám, boong xanh, nhiều chi tiết nhỏ (người dùng tự lắp từ thư viện, không chép mô hình tàu thật)
- Hình nhìn từ mũi / lái phải tự hiện khi khối đã có hình mạn + mặt boong; ô «Nhìn từ lái» luôn hiện
- Bảng Neo tab 3: cảnh báo «NEO TRÔI» nằm dưới các ô neo; báo va chạm tàu đậu chỉ ghi «VA CHẠM TÀU ĐẬU» (không hiện tốc độ)
- Neo: thả thì quả neo rơi trước, xích ra theo; thu thì quả neo về đúng chỗ cũ trên mạn. Mỗi neo một nút cấp riêng, chữ chỉ ghi «Cấp 1» / «Cấp 2» (1 m/s, 2 m/s — không hiện số), dùng cho thả, thả kéo lê và kéo neo. «Thả tự do» 3 m/s, neo chạm đáy thì xích chạy chậm lại, không tự dừng (người điều động tự hãm)
- Tàu đổ bộ mẫu có cả 2 kiểu: mũi bằng với cầu dẫn làm mặt mũi, và mũi tròn cửa hai cánh
- Neo tàu đậu (cập lái, đậu neo): kéo ký hiệu neo để dời, xích dài / ngắn theo; xóa thì mất quả neo + xích, độ dài về 0; «Thả lại» để thả lại
- Không dùng hộp thoại gốc của trình duyệt / Windows (alert, confirm, prompt): dùng hộp thoại của app (`dialog.js`)
- Kho tàu: tab 1 chọn loại → tên tàu là nạp làm tàu điều động; «Lưu vào kho» ở tab 1 và hộp thoại vẽ tàu; loại tàu chuẩn + loại người dùng tự gõ
- Tàu đậu ở cảng do người dùng tự sắp ở tab 2 (tàu nào, chỗ nào, cập kiểu gì, dây, neo); cảng nào có thì app đưa lên khi chạy; tàu đậu phải nhấp nhô theo sóng
- Không làm: soạn bài tập, chấm điểm (chỉ cần xem lại), nhập nhanh thông số tàu
- Độ sâu là ưu tiên số 1, độ cao núi để cảnh đẹp và giống thật; chữ khác trên hải đồ (lưới kinh vĩ, năm, ghi chú) không cần đọc
- Viền đảo / hòn phải vẽ đúng như hải đồ (là mép luồng); độ cao trên hải đồ tính từ số 0 hải đồ; chấm cạnh số độ cao là vị trí đỉnh núi, số trong ngoặc cạnh hoặc dưới tên hòn là độ cao của cả hòn
- Điểm nghi đọc sai phải thấy rõ (vòng to, cả khi thu nhỏ) và sửa được lần lượt từng điểm; bấm đọc độ sâu một tờ thì làm ngay, không bắt chờ các tờ app tự đọc nền
- Người dùng muốn bàn trước, khi nào bảo «làm» mới làm (trừ khi nói làm luôn)

## Child DOX Index

- `app/AGENTS.md` — ứng dụng web: build 1 file HTML, phụ thuộc, cấu trúc nguồn
- `electron/AGENTS.md` — vỏ Electron và đóng gói `.exe`
- Gốc giữ: `README.md` (giới thiệu cho người dùng), `LICENSE-DOX`, `.gitignore`

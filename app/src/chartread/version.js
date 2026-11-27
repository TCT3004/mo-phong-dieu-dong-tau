// Phiên bản thuật toán mô hình độ sâu — tách riêng để giao diện đọc được mà không kéo cả bộ đọc chữ số vào bundle chính.
// 2: mặt nước theo số đo sâu + độ dốc bờ (không nối tam giác qua mép bờ)
// 3: mặt nước chia vùng theo màu nước (dải độ sâu 0–2 / 2–5 / > 5 m…), lưới màu nước `tn` lấy từ ảnh
// 4: đường đẳng sâu dò từ ảnh (`iso`), có giá trị thì góp điểm vào nội suy mặt nước
export const ALG = 4;
export const WATER_ONLY_FROM = 4; // tờ có alg từ số này tới ALG − 1: chỉ dựng lại mặt nước (không cần ảnh)
export const TINT_FROM = 1;       // tờ có alg từ số này tới WATER_ONLY_FROM − 1: lấy thêm từ ảnh (màu nước, đường đẳng sâu) rồi dựng lại mặt nước

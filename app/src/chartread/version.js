// Phiên bản thuật toán mô hình độ sâu — tách riêng để giao diện đọc được mà không kéo cả bộ đọc chữ số vào bundle chính.
// ALG 1 → 2: đổi cách nội suy mặt nước (tờ dựng bằng ALG 1 chỉ cần dựng lại mặt nước, không phải đọc lại số)
export const ALG = 2;
export const WATER_ONLY_FROM = 1; // tờ có alg từ số này tới ALG − 1: chỉ dựng lại mặt nước

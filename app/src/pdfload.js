// Mở PDF bằng pdf.js; worker bundle sẵn thành chuỗi, chạy kiểu classic từ Blob (được dưới file:// và Electron).
import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';
import WORKER_SRC from './_pdfworker.js';

function ensureWorker() {
  if (pdfjsLib.GlobalWorkerOptions.workerPort) return;
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(url);
}
export function openPdf(bytes) { ensureWorker(); return pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise; }

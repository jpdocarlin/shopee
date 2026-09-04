// Converte uma foto/print da etiqueta de envio em PDF, direto no navegador
// (canvas + jsPDF) — sem serviço externo, sem enviar a imagem pra lugar
// nenhum antes da conversão. Usado no upload da etiqueta em Pedidos: o
// fornecedor recebe sempre um PDF certinho, mesmo se o revendedor mandar
// print.
import { jsPDF } from "jspdf";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não deu pra ler essa imagem."));
    };
    img.src = url;
  });
}

export async function convertImageToPdf(file: File): Promise<File> {
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    throw new Error("Não deu pra converter essa imagem em PDF.");
  }
  // Fundo branco antes de desenhar: prints em PNG com transparência viram
  // preto no PDF se a página não tiver um fundo por baixo.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);

  // Pixel -> pt a 96dpi (1px = 72/96 = 0.75pt), pra a página do PDF sair do
  // mesmo tamanho/proporção da imagem original — sem cortar e sem sobrar
  // margem em volta da etiqueta.
  const widthPt = canvas.width * 0.75;
  const heightPt = canvas.height * 0.75;

  const pdf = new jsPDF({
    orientation: widthPt >= heightPt ? "landscape" : "portrait",
    unit: "pt",
    format: [widthPt, heightPt],
  });
  pdf.addImage(jpegDataUrl, "JPEG", 0, 0, widthPt, heightPt);

  const blob = pdf.output("blob");
  const baseName = file.name.replace(/\.[^./]+$/, "") || "etiqueta";
  return new File([blob], `${baseName}.pdf`, { type: "application/pdf" });
}

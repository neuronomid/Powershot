/**
 * PDF page rendering using pdfjs-dist (lazy-loaded).
 * Every page is rendered to a canvas image and routed through the existing
 * VLM extraction pipeline. No native-text-layer extraction in v2.
 */

export type PdfPageImage = {
  id: string;
  dataUrl: string;
  pageNumber: number;
  width: number;
  height: number;
};

const MAX_PDF_PAGES = 50;

function getWorkerSrc(pdfjsLib: typeof import("pdfjs-dist")) {
  // Use CDN worker to avoid bundling the large worker file.
  return `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export async function renderPdfToPageImages(
  file: File,
  opts: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<{ pages: PdfPageImage[]; warning: string | null }> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.85 } = opts;

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = getWorkerSrc(pdfjsLib);

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let warning: string | null = null;
  if (pdf.numPages > MAX_PDF_PAGES) {
    warning = `Large PDFs may take longer. Consider splitting into sections.`;
  }

  const pages: PdfPageImage[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });

    let scale = 1;
    if (viewport.width > maxWidth || viewport.height > maxHeight) {
      scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
    }
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(scaledViewport.width);
    canvas.height = Math.round(scaledViewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context not available");
    }

    await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas }).promise;
    page.cleanup();

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    pages.push({
      id: `${file.name}::page-${pageNum}`,
      dataUrl,
      pageNumber: pageNum,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return { pages, warning };
}

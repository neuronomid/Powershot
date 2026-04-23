import type { PowershotCaptureMessage } from "@/lib/intake/messages";

const SAMPLE_NOTE_TITLE = "Powershot sample note";

export const sampleAssets = [
  {
    id: "lecture-slide",
    label: "Lecture slide",
    fileName: "lecture-slide.svg",
  },
  {
    id: "docs-page",
    label: "Documentation page",
    fileName: "documentation-page.svg",
  },
  {
    id: "slack-thread",
    label: "Slack conversation",
    fileName: "slack-conversation.svg",
  },
  {
    id: "recipe-article",
    label: "Recipe article",
    fileName: "recipe-article.svg",
  },
] as const;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read sample asset"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function loadSampleCaptureMessage(): Promise<PowershotCaptureMessage> {
  const images = await Promise.all(
    sampleAssets.map(async (asset) => {
      const response = await fetch(`/samples/${asset.fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to load sample asset: ${asset.fileName}`);
      }

      const dataUrl = await blobToDataUrl(await response.blob());
      return {
        dataUrl,
        title: asset.label,
        source: "sample" as const,
      };
    }),
  );

  return {
    type: "POWERSHOT_CAPTURE",
    captureId: "sample-demo",
    title: SAMPLE_NOTE_TITLE,
    autoStart: true,
    transient: true,
    images,
  };
}

export { SAMPLE_NOTE_TITLE };

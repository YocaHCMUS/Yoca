import type { jsPDF } from "jspdf";
import robotoRegularTtfUrl from "@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf?url";

const ROBOTO_FONT_FILE_NAME = "Roboto-Regular.ttf";
const ROBOTO_FONT_FAMILY = "Roboto";

let robotoRegularBase64Promise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function loadRobotoRegularBase64(): Promise<string> {
  if (!robotoRegularBase64Promise) {
    robotoRegularBase64Promise = fetch(robotoRegularTtfUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load PDF font asset: ${response.status} ${response.statusText}`);
      }

      return arrayBufferToBase64(await response.arrayBuffer());
    });
  }

  return robotoRegularBase64Promise;
}

export async function applyRobotoRegularPdfFont(pdf: jsPDF): Promise<void> {
  const robotoRegularBase64 = await loadRobotoRegularBase64();
  pdf.addFileToVFS(ROBOTO_FONT_FILE_NAME, robotoRegularBase64);
  pdf.addFont(ROBOTO_FONT_FILE_NAME, ROBOTO_FONT_FAMILY, "normal");
  pdf.setFont(ROBOTO_FONT_FAMILY);
}
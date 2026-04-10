export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import PDFParser from "pdf2json";

function parsePDFBuffer(buffer: Buffer): Promise<ReturnType<PDFParser["getRawTextContent"]> extends never ? never : any> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataReady", (data: any) => resolve(data));
    pdfParser.on("pdfParser_dataError", (err: any) => reject(err));
    pdfParser.parseBuffer(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "Only PDF allowed" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfData = await parsePDFBuffer(buffer);

    // pdf2json divides PDF point coordinates by 9.6 — multiply back to restore
    // the same coordinate scale as pdfjs-dist so all thresholds stay identical.
    const SCALE = 9.6;

    const ordersMap = new Map<string, number>();

    const pages: any[] = pdfData.Pages ?? [];

    for (const page of pages) {
      const texts: any[] = page.Texts ?? [];

      // Reconstruct items in the same shape as pdfjs-dist's getTextContent()
      const items = texts.flatMap((textItem: any) =>
        (textItem.R ?? []).map((run: any) => ({
          str: decodeURIComponent(run.T),
          transform: [
            0, 0, 0, 0,
            Math.round(textItem.x * SCALE),
            Math.round(textItem.y * SCALE),
          ],
        }))
      );

      const pageText = items.map((it) => it.str).join(" ").toUpperCase();

      // Page filter — unchanged
      if (!pageText.includes("PICKLIST") || pageText.includes("COURIER")) {
        continue;
      }

      // Row grouping by Y axis — unchanged
      const rowMap: Map<number, Array<{ x: number; text: string }>> = new Map();

      for (const item of items) {
        if (!item.str?.trim()) continue;

        const x = Math.round(item.transform[4]);
        const y = Math.round(item.transform[5]);

        let matchedKey: number | null = null;

        for (const key of rowMap.keys()) {
          if (Math.abs(key - y) <= 6) {
            matchedKey = key;
            break;
          }
        }

        if (matchedKey === null) {
          rowMap.set(y, []);
          matchedKey = y;
        }

        rowMap.get(matchedKey)!.push({
          x,
          text: item.str.trim(),
        });
      }

      const sortedRows = [...rowMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, cells]) =>
          cells.sort((a, b) => a.x - b.x).map((c) => c.text)
        );

      for (const row of sortedRows) {
        if (row.length < 3) continue;

        if (row[0]?.toUpperCase().trim() === "SKU") continue;

        const styleCode = row[0]?.toUpperCase().trim();
        const size = row[row.length - 2]?.toUpperCase().trim();
        const qtyRaw = row[row.length - 1];

        if (!styleCode || !size) continue;

        let qty = 1;
        const parsed = parseInt(qtyRaw);
        if (!isNaN(parsed) && parsed > 0) {
          qty = parsed;
        } else {
          continue;
        }

        const fullSku = `${styleCode}-${size}`;

        ordersMap.set(fullSku, (ordersMap.get(fullSku) || 0) + qty);
      }
    }

    // Convert to array — unchanged
    const orders = Array.from(ordersMap.entries()).map(
      ([Portal_SKU, Qty]) => ({
        Portal_SKU,
        Qty,
      })
    );

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("PDF error:", error);
    return NextResponse.json(
      { error: "Failed to parse PDF" },
      { status: 500 }
    );
  }
}

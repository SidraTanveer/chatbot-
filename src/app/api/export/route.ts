import { NextResponse } from "next/server";
import { Document, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { json2csv } from "json-2-csv";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null ||
      !("text" in body) || typeof body.text !== "string") {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }
  const format = "format" in body && typeof body.format === "string" ? body.format : "txt";
  const text = body.text;

  if (format === "docx") {
    const doc = new Document({
      sections: [{
        children: text.split(/\n{2,}/).map((paragraph) =>
          new Paragraph({ text: paragraph, heading: paragraph.length < 80 ? undefined : undefined }),
        ),
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": 'attachment; filename="nexora-response.docx"' },
    });
  }

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Nexora");
    text.split(/\r?\n/).forEach((line, index) => sheet.getRow(index + 1).values = [line]);
    sheet.columns = [{ width: 100 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="nexora-response.xlsx"' },
    });
  }

  if (format === "pdf") {
    const chunks: Buffer[] = [];
    const pdf = new PDFDocument({ margin: 50 });
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));
    pdf.font("Helvetica").fontSize(11).text(text);
    pdf.end();
    const buffer = await done;
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="nexora-response.pdf"' },
    });
  }

  if (format === "csv") {
    const rows = text.split(/\r?\n/).filter(Boolean).map((line) => ({ response: line }));
    const csv = await json2csv(rows);
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="nexora-response.csv"' },
    });
  }

  const contentType = format === "json" ? "application/json" : "text/plain";
  const content = format === "json" ? JSON.stringify({ response: text }, null, 2) : text;
  return new NextResponse(content, {
    headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="nexora-response.${format === "md" ? "md" : "txt"}"` },
  });
}

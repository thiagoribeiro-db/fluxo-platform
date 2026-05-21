/**
 * API route DEV-ONLY que recebe um arquivo (blob URL via fetch + FormData)
 * e salva em `tmp/dev-export/`. Usado pelo `/dev-preview` pra eu validar
 * o export autonomamente sem depender de download do browser.
 */
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return new NextResponse('campo "file" ausente ou inválido', { status: 400 });
    }
    const filename = (file.name || 'export.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
    const outDir = path.join(process.cwd(), 'tmp', 'dev-export');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, filename);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(outPath, buf);
    return NextResponse.json({ ok: true, path: outPath, size: buf.length });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

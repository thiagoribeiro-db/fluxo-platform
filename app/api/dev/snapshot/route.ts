/**
 * API route DEV-ONLY pra carregar o `tmp/state-snapshot.json` no
 * `/dev-preview` sem precisar de autenticação. Permite testar o export
 * visual de forma autônoma. Retorna 404 em produção.
 */
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }
  try {
    const filePath = path.join(process.cwd(), 'tmp', 'state-snapshot.json');
    const data = await fs.readFile(filePath, 'utf8');
    return new NextResponse(data, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (err) {
    return new NextResponse(
      JSON.stringify({
        error: 'snapshot indisponível',
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

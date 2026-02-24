import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { episodes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; ep: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const epNumber = parseInt(params.ep);

    const episode = db.select().from(episodes)
      .where(and(
        eq(episodes.projectId, projectId),
        eq(episodes.episodeNumber, epNumber)
      ))
      .get();

    if (!episode) {
      return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
    }

    return new NextResponse(episode.rawPrompt || '', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: '导出 Prompt 失败' }, { status: 500 });
  }
}

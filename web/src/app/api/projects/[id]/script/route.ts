import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scripts, scriptEpisodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const script = db.select().from(scripts).where(eq(scripts.projectId, projectId)).get();
    if (!script) {
      return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
    }

    const eps = db.select().from(scriptEpisodes).where(eq(scriptEpisodes.scriptId, script.id)).all();

    return NextResponse.json({
      ...script,
      episodes: eps.map(ep => ({
        ...ep,
        keyPlots: JSON.parse(ep.keyPlots || '[]'),
      })),
    });
  } catch {
    return NextResponse.json({ error: '获取剧本失败' }, { status: 500 });
  }
}

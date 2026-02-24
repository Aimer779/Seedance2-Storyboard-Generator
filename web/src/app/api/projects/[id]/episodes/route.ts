import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { episodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const eps = db.select().from(episodes).where(eq(episodes.projectId, projectId)).all();

    return NextResponse.json(
      eps.map(e => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
        styleLine: e.styleLine,
        soundDesign: e.soundDesign,
        endFrameDescription: e.endFrameDescription,
      }))
    );
  } catch {
    return NextResponse.json({ error: '获取分镜列表失败' }, { status: 500 });
  }
}

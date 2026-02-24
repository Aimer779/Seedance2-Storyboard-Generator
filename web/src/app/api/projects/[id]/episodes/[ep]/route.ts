import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { episodes, timeSlots, assetSlots } from '@/lib/db/schema';
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

    const slots = db.select().from(timeSlots)
      .where(eq(timeSlots.episodeId, episode.id))
      .all();

    const aSlots = db.select().from(assetSlots)
      .where(eq(assetSlots.episodeId, episode.id))
      .all();

    return NextResponse.json({
      ...episode,
      timeSlots: slots,
      assetSlots: aSlots,
    });
  } catch {
    return NextResponse.json({ error: '获取分镜详情失败' }, { status: 500 });
  }
}

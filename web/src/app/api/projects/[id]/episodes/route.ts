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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const body = await request.json();

    // Find next episode number
    const existing = db.select().from(episodes).where(eq(episodes.projectId, projectId)).all();
    const maxEp = existing.reduce((max, e) => Math.max(max, e.episodeNumber), 0);
    const episodeNumber = body.episodeNumber || maxEp + 1;

    const episode = db.insert(episodes).values({
      projectId,
      episodeNumber,
      title: body.title || `第${episodeNumber}集`,
      rawMarkdown: '',
      filePath: '',
      styleLine: body.styleLine || '',
      soundDesign: body.soundDesign || '',
      referenceList: body.referenceList || '',
      endFrameDescription: body.endFrameDescription || '',
      rawPrompt: '',
    }).returning().get();

    return NextResponse.json({
      id: episode.id,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      styleLine: episode.styleLine,
      soundDesign: episode.soundDesign,
      endFrameDescription: episode.endFrameDescription,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '新增分镜失败' }, { status: 500 });
  }
}

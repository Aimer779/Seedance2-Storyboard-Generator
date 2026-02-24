import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, assets, episodes, pipelineStages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // 获取关联数据数量
    const assetCount = db.select().from(assets).where(eq(assets.projectId, id)).all().length;
    const episodeList = db.select().from(episodes).where(eq(episodes.projectId, id)).all();
    const pipeline = db.select().from(pipelineStages).where(eq(pipelineStages.projectId, id)).all();

    return NextResponse.json({
      ...project,
      assetCount,
      episodeCount: episodeList.length,
      episodes: episodeList.map(e => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
      })),
      pipeline,
    });
  } catch {
    return NextResponse.json({ error: '获取项目详情失败' }, { status: 500 });
  }
}

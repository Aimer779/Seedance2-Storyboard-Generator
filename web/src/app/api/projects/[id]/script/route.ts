import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scripts, scriptEpisodes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncScriptFile } from '@/lib/fileSync';

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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const body = await request.json();

    let script = db.select().from(scripts).where(eq(scripts.projectId, projectId)).get();

    // If updating raw markdown directly
    if (body.rawMarkdown !== undefined) {
      if (script) {
        db.update(scripts)
          .set({ rawMarkdown: body.rawMarkdown })
          .where(eq(scripts.id, script.id))
          .run();
      } else {
        script = db.insert(scripts).values({
          projectId,
          rawMarkdown: body.rawMarkdown,
          filePath: '',
        }).returning().get();
      }
      syncScriptFile(projectId);
      return NextResponse.json({ success: true });
    }

    // Structured update: episodes array
    if (body.episodes && Array.isArray(body.episodes)) {
      if (!script) {
        script = db.insert(scripts).values({
          projectId,
          rawMarkdown: '',
          filePath: '',
        }).returning().get();
      }

      // Delete existing episodes for this script
      db.delete(scriptEpisodes).where(eq(scriptEpisodes.scriptId, script.id)).run();

      // Insert updated episodes
      for (const ep of body.episodes) {
        db.insert(scriptEpisodes).values({
          scriptId: script.id,
          episodeNumber: ep.episodeNumber,
          title: ep.title || '',
          emotionalTone: ep.emotionalTone || '',
          keyPlots: JSON.stringify(ep.keyPlots || []),
          openingFrame: ep.openingFrame || '',
          closingFrame: ep.closingFrame || '',
        }).run();
      }

      // Sync to file (will regenerate markdown)
      syncScriptFile(projectId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '无效的请求数据' }, { status: 400 });
  } catch (e) {
    console.error('更新剧本失败:', e);
    return NextResponse.json({ error: '更新剧本失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { AssetType } from '@/types';
import { syncAssetListFile } from '@/lib/fileSync';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') as AssetType | null;

    const query = db.select().from(assets).where(eq(assets.projectId, projectId));

    const allAssets = query.all();

    const filtered = typeFilter
      ? allAssets.filter(a => a.type === typeFilter)
      : allAssets;

    return NextResponse.json(
      filtered.map(a => ({
        ...a,
        usedInEpisodes: JSON.parse(a.usedInEpisodes || '[]'),
      }))
    );
  } catch {
    return NextResponse.json({ error: '获取素材失败' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const body = await request.json();

    if (!body.code || !body.type) {
      return NextResponse.json({ error: '素材编号和类型不能为空' }, { status: 400 });
    }

    const asset = db.insert(assets).values({
      projectId,
      code: body.code,
      type: body.type,
      name: body.name || '',
      prompt: body.prompt || '',
      description: body.description || '',
      usedInEpisodes: JSON.stringify(body.usedInEpisodes || []),
    }).returning().get();

    syncAssetListFile(projectId);

    return NextResponse.json({
      ...asset,
      usedInEpisodes: JSON.parse(asset.usedInEpisodes || '[]'),
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '新增素材失败' }, { status: 500 });
  }
}

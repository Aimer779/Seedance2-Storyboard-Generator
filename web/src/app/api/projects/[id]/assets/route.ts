import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { AssetType } from '@/types';

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

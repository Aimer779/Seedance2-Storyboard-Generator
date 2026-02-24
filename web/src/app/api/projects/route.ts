import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const allProjects = db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
    return NextResponse.json(allProjects);
  } catch {
    return NextResponse.json({ error: '获取项目列表失败' }, { status: 500 });
  }
}

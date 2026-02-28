import { NextResponse } from "next/server";

export async function GET() {
  const hasToken = !!process.env.META_ACCESS_TOKEN;
  return NextResponse.json({ configured: hasToken });
}

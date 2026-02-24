import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { metaGet } from "@/lib/meta-api";
import type { MetaAccount } from "@/types/meta";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = (await metaGet("me/adaccounts", {
      fields: "id,name,account_id,account_status,currency,timezone_name,amount_spent",
    })) as { data?: MetaAccount[] };

    return NextResponse.json(response.data ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}

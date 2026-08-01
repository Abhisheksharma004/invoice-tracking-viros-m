import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { success: true, message: "Logged out successfully" },
    { status: 200 }
  );

  // Clear the token cookie
  const isSecure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  response.cookies.set("token", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

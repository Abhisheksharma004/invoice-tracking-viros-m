import { NextRequest, NextResponse } from "next/server";
import { otpStore } from "@/lib/otpStore";

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    console.log("Verify OTP request:", { email, otp });

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: "Email and OTP are required" },
        { status: 400 }
      );
    }

    const storedData = otpStore.get(email.toLowerCase());

    console.log("Stored data found:", !!storedData, storedData ? `expires at ${new Date(storedData.expiresAt).toLocaleString()}` : "not found");

    if (!storedData) {
      return NextResponse.json(
        { success: false, message: "OTP not found or expired" },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return NextResponse.json(
        { success: false, message: "OTP has expired" },
        { status: 400 }
      );
    }

    // Verify OTP - convert both to string for comparison
    const otpString = String(otp).trim();
    const storedOtpString = String(storedData.otp).trim();
    
    console.log("OTP comparison:", { received: otpString, stored: storedOtpString, match: otpString === storedOtpString });

    if (otpString !== storedOtpString) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP. Please check and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

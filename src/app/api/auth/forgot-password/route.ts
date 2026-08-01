import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { otpStore } from "@/lib/otpStore";
import nodemailer from "nodemailer";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createTransporter() {
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPass,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "No account found with this email" },
        { status: 404 }
      );
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email.toLowerCase(), otp, expiresAt);

    try {
      const transporter = createTransporter();

      console.log("Verifying SMTP connection...");
      await transporter.verify();
      console.log("SMTP connection verified successfully");

      const mailOptions = {
        from: `"Invoice Tracking Portal" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Password Reset OTP - Invoice Tracking Portal",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { padding: 30px; }
                .otp-box { background: #f0f9ff; border: 2px dashed #2563eb; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
                .otp-code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace; }
                .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔐 Password Reset Request</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>We received a request to reset your password for your <strong>Invoice Tracking Portal</strong> account.</p>
                  <p>Your One-Time Password (OTP) is:</p>
                  <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                  </div>
                  <div class="info-box">
                    <strong>⏰ Important:</strong> This OTP will expire in <strong>10 minutes</strong>.
                  </div>
                  <p>Enter this code on the password reset page to continue.</p>
                  <p>If you didn't request this password reset, please ignore this email.</p>
                  <p>Best regards,<br><strong>Invoice Tracking Portal Team</strong></p>
                </div>
                <div class="footer">
                  <p>This is an automated email. Please do not reply to this message.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `Password Reset OTP\n\nYour OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.`,
      };

      console.log("Sending email to:", email);
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully! MessageID: ${info.messageId}`);

      return NextResponse.json({
        success: true,
        message: "OTP sent to your email",
      });
    } catch (emailError: any) {
      console.error("Email sending error details:", emailError.message);

      if (process.env.NODE_ENV === "development") {
        console.log(`Development mode - OTP for ${email}: ${otp}`);
        return NextResponse.json({
          success: true,
          message: "OTP generated (Email service not configured. Check console for OTP)",
          otp,
          expiresIn: "10 minutes",
        });
      }

      return NextResponse.json(
        { success: false, message: "Failed to send email. Please check SMTP configuration." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

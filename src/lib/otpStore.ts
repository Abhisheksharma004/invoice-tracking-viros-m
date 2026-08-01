// Shared OTP store for forgot password flow
// In production, replace this with Redis or database storage

interface OTPData {
  otp: string;
  expiresAt: number;
}

class OTPStore {
  private store: Map<string, OTPData>;

  constructor() {
    this.store = new Map();
    // Cleanup expired OTPs every minute
    setInterval(() => this.cleanupExpired(), 60000);
  }

  set(email: string, otp: string, expiresAt: number): void {
    this.store.set(email.toLowerCase(), { otp, expiresAt });
  }

  get(email: string): OTPData | undefined {
    return this.store.get(email.toLowerCase());
  }

  delete(email: string): void {
    this.store.delete(email.toLowerCase());
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [email, data] of this.store.entries()) {
      if (data.expiresAt < now) {
        this.store.delete(email);
      }
    }
  }
}

// Export singleton instance
export const otpStore = new OTPStore();

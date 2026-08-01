// Run this script to reset the user password
// Usage: node scripts/reset-user-password.js

const resetPassword = async () => {
  try {
    const response = await fetch("http://localhost:3000/api/auth/reset-user-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "sales@virosentrepreneurs.com",
        newPassword: "Viros@2025",
        secretKey: "CREATE_USER_SECRET_2025",
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      console.log("✅ Password reset successfully!");
      console.log("\nYou can now login with:");
      console.log("Email: sales@virosentrepreneurs.com");
      console.log("Password: Viros@2025");
    } else {
      console.error("❌ Error:", data.message);
    }
  } catch (error) {
    console.error("❌ Failed to reset password:", error.message);
    console.log("\nMake sure:");
    console.log("1. The development server is running (npm run dev)");
    console.log("2. MySQL connection string (DATABASE_URL) is set in .env.local");
  }
};

resetPassword();

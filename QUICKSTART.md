# 🚀 Quick Start - 3 Simple Steps

## Step 1: Configure MongoDB Atlas (5 minutes)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create FREE account
3. Create a cluster (select FREE tier)
4. Create database user (username + password)
5. Whitelist your IP (or "Allow from Anywhere" for testing)
6. Get connection string from "Connect" button

## Step 2: Update .env.local

Replace the MongoDB URI in `.env.local`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/invoice-tracking?retryWrites=true&w=majority
JWT_SECRET=change-this-to-random-string-abc123xyz789
NODE_ENV=development
```

## Step 3: Run the Application

```bash
# Start the server
npm run dev

# In another terminal, create the user
npm run create-user
```

## Login Credentials

```
Email: sales@virosentrepreneurs.com
Password: Viros@2025
```

## ✅ That's It!

Visit http://localhost:3000 and login!

---

## 🆘 Having Issues?

### MongoDB Connection Failed
- Double-check username and password in connection string
- Make sure IP address is whitelisted
- Verify cluster is active

### Can't Create User
- Make sure server is running (`npm run dev`)
- Check `.env.local` is configured correctly
- Look at terminal for error messages

### Need Detailed Instructions?
See `AUTHENTICATION_SETUP.md` for complete setup guide.

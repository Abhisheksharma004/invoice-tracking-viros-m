# Authentication Setup Instructions

## Overview
This project now has a complete authentication system using MongoDB Atlas, JWT tokens, and secure password hashing.

## Setup Steps

### 1. MongoDB Atlas Configuration

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free account
2. Create a new cluster (free tier is fine)
3. Create a database user:
   - Go to "Database Access"
   - Click "Add New Database User"
   - Set username and password
   - Give "Read and write to any database" permissions
4. Allow network access:
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (or add your specific IP)
5. Get your connection string:
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string

### 2. Update Environment Variables

Open the `.env.local` file and update it with your MongoDB connection string:

```env
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/invoice-tracking?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-to-something-random
NODE_ENV=development
```

**Important:** Replace:
- `YOUR_USERNAME` with your MongoDB username
- `YOUR_PASSWORD` with your MongoDB password
- `YOUR_CLUSTER` with your cluster name
- Change `JWT_SECRET` to a random secure string

### 3. Create Initial User

Once your environment variables are set up, you need to create the initial user with the credentials you provided.

1. Start the development server:
```bash
npm run dev
```

2. Use a tool like Postman, cURL, or your browser to call the create user endpoint:

**Using cURL (PowerShell):**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/create-user" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"email":"sales@virosentrepreneurs.com","password":"Viros@2025","secretKey":"CREATE_USER_SECRET_2025"}'
```

**Or visit this URL in your browser:**
```
http://localhost:3000/api/auth/create-user
```

And use a REST client to POST:
```json
{
  "email": "sales@virosentrepreneurs.com",
  "password": "Viros@2025",
  "secretKey": "CREATE_USER_SECRET_2025"
}
```

3. You should see a success response:
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "...",
    "email": "sales@virosentrepreneurs.com"
  }
}
```

### 4. Login

Now you can login with the credentials:
- **Email:** sales@virosentrepreneurs.com
- **Password:** Viros@2025

Go to `http://localhost:3000` and enter the credentials.

## Security Features

✅ **Password Hashing:** Passwords are hashed using bcrypt before storage
✅ **JWT Authentication:** Secure JWT tokens for session management
✅ **HTTP-Only Cookies:** Tokens stored in HTTP-only cookies (can't be accessed by JavaScript)
✅ **Protected Routes:** Middleware protects dashboard and other routes
✅ **Input Validation:** Email and password validation on login

## API Endpoints

### POST `/api/auth/login`
Login with email and password
```json
{
  "email": "sales@virosentrepreneurs.com",
  "password": "Viros@2025"
}
```

### POST `/api/auth/logout`
Logout and clear session cookie

### POST `/api/auth/create-user`
Create new user (requires secret key)
```json
{
  "email": "user@example.com",
  "password": "password123",
  "secretKey": "CREATE_USER_SECRET_2025"
}
```

### GET `/api/auth/create-user`
Check if users exist in the database

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts          # Login endpoint
│   │       ├── logout/route.ts         # Logout endpoint
│   │       └── create-user/route.ts    # User creation endpoint
│   ├── page.tsx                         # Login page
│   └── dashboard/page.tsx               # Protected dashboard
├── lib/
│   └── mongodb.ts                       # MongoDB connection
├── models/
│   └── User.ts                          # User model with password hashing
└── middleware.ts                        # Route protection middleware
```

## Troubleshooting

### Can't connect to MongoDB
- Check if your IP address is whitelisted in MongoDB Atlas
- Verify your connection string is correct
- Make sure you replaced placeholders with actual values

### Login not working
- Ensure you created the user first using the create-user endpoint
- Check that email and password are correct
- Look at browser console and server logs for errors

### Can't access dashboard
- Make sure you're logged in
- Check if cookies are enabled in your browser
- Verify the JWT_SECRET is set in .env.local

## Next Steps

- Add password reset functionality
- Implement user profile management
- Add role-based access control
- Implement email verification
- Add multi-factor authentication

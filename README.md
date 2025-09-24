# SkinSync AI Backend API

A comprehensive backend API for the SkinSync AI mobile application, built with Express.js and MongoDB using the MVC pattern.

## Features

- **Passwordless Authentication**: Email-based OTP authentication for both registration and login
- **OTP Verification**: Secure 6-digit OTP verification system
- **User Profile Management**: Complete profile setup and management
- **Notification System**: Push notification management and preferences
- **MVC Architecture**: Clean separation of concerns with Models, Views (Controllers), and Routes
- **Input Validation**: Comprehensive request validation using Zod
- **Error Handling**: Centralized error handling and logging
- **Security**: JWT authentication, CORS protection, and OTP rate limiting

## API Endpoints

### Authentication (`/api/auth`)
- `POST /send-otp` - Send OTP to email (for both registration and login)
- `POST /verify-otp` - Verify OTP and authenticate user
- `POST /complete-profile` - Complete user profile (for new users)
- `POST /resend-otp` - Resend OTP to email

### User Management (`/api/user`)
- `GET /profile` - Get user profile (requires authentication)
- `PUT /profile` - Update user profile (requires authentication)
- `PUT /notifications` - Update notification preferences (requires authentication)
- `DELETE /account` - Deactivate user account (requires authentication)

### Notifications (`/api/notifications`)
- `GET /` - Get user notifications with pagination (requires authentication)
- `PUT /:notificationId/read` - Mark notification as read (requires authentication)
- `PUT /read-all` - Mark all notifications as read (requires authentication)
- `DELETE /:notificationId` - Delete notification (requires authentication)
- `POST /create` - Create notification (admin function, requires authentication)

### Health Check
- `GET /api/health` - API health status

## Project Structure

```
├── controllers/          # Business logic controllers
│   ├── authController.js
│   ├── userController.js
│   └── notificationController.js
├── middleware/           # Custom middleware
│   └── auth.js
├── models/              # MongoDB models
│   ├── User.js
│   ├── VerificationCode.js
│   └── Notification.js
├── routes/              # API routes
│   ├── auth.js
│   ├── user.js
│   └── notifications.js
├── utils/               # Utility functions
│   └── emailService.js
├── server.js            # Main server file
├── package.json
└── README.md
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd skin-sync
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Copy `env.example` to `.env`
   - Update the environment variables:
     ```env
     PORT=5000
     NODE_ENV=development
     MONGODB_URI=mongodb://localhost:27017/skinsync
     JWT_SECRET=your_super_secret_jwt_key_here
     JWT_EXPIRE=7d
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_USER=your_email@gmail.com
     EMAIL_PASS=your_app_password
     FRONTEND_URL=http://localhost:3000
     ```

4. **Start MongoDB**
   - Make sure MongoDB is running on your system
   - Default connection: `mongodb://localhost:27017/skinsync`

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment mode | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/skinsync |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRE` | JWT expiration time | 7d |
| `EMAIL_HOST` | SMTP host | smtp.gmail.com |
| `EMAIL_PORT` | SMTP port | 587 |
| `EMAIL_USER` | SMTP username | - |
| `EMAIL_PASS` | SMTP password | - |
| `FRONTEND_URL` | Frontend application URL | http://localhost:3000 |

## API Usage Examples

### Send OTP (Registration/Login)
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Verify OTP
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "code": "123456"
  }'
```

### Complete Profile (New Users)
```bash
curl -X POST http://localhost:5000/api/auth/complete-profile?email=user@example.com \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+1234567890",
    "location": "New York, NY",
    "bio": "Skincare enthusiast"
  }'
```

### Update Profile (with authentication)
```bash
curl -X PUT http://localhost:5000/api/user/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "John Doe",
    "phone": "+1234567890",
    "location": "New York, NY",
    "bio": "Skincare enthusiast"
  }'
```

## Database Models

### User Model
- `name`: User's full name
- `email`: Unique email address
- `phone`: Phone number (optional)
- `location`: User location (optional)
- `bio`: User biography (optional)
- `password`: Hashed password
- `isEmailVerified`: Email verification status
- `notificationsEnabled`: Notification preferences
- `isActive`: Account status

### VerificationCode Model
- `email`: Email address for verification
- `code`: 6-digit verification code
- `type`: Code type (email_verification, password_reset)
- `expiresAt`: Code expiration time
- `attempts`: Number of verification attempts
- `isUsed`: Code usage status

### Notification Model
- `userId`: Reference to user
- `title`: Notification title
- `message`: Notification message
- `type`: Notification type
- `isRead`: Read status
- `scheduledFor`: Scheduled delivery time
- `metadata`: Additional data

## Security Features

- **Password Hashing**: Using bcrypt with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Cross-origin resource sharing configuration
- **Rate Limiting**: Built-in protection against abuse
- **Email Verification**: Secure email verification process

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors (if any)
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { authService } from '../services/auth.service';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret_here';

// Extract base URL from env or default to localhost for development
const API_URL = process.env.API_URL || 'http://localhost:4000';

passport.use(
    new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: `${API_URL}/api/auth/google/callback`,
            scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Use authService to upsert user and generate JWT
                const result = await authService.googleLogin(profile);
                // Pass the whole result (user + token) so the route handler can use it
                return done(null, result);
            } catch (error) {
                return done(error, false);
            }
        }
    )
);

export default passport;

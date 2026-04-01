import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your email address...');

    useEffect(() => {
        const token = searchParams.get('token');
        
        if (!token) {
            setStatus('error');
            setMessage('Verification token is missing from the URL.');
            return;
        }

        const verifyToken = async () => {
            try {
                const response = await api.get(`/auth/verify-email/${token}`);
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');
            } catch (err: any) {
                setStatus('error');
                setMessage(err.response?.data?.detail || 'Invalid or expired verification token.');
            }
        };

        verifyToken();
    }, [searchParams]);

    return (
        <div className="flex h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md shadow-xl text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                        {status === 'success' && <CheckCircle2 className="h-12 w-12 text-green-500" />}
                        {status === 'error' && <XCircle className="h-12 w-12 text-destructive" />}
                    </div>
                    <CardTitle className="text-2xl">Email Verification</CardTitle>
                    <CardDescription>
                        {status === 'loading' ? 'Please wait while we verify your email.' : 'Verification result'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className={`text-sm ${status === 'error' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {message}
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button 
                        onClick={() => navigate('/login')}
                        className="w-full max-w-xs"
                    >
                        Return to Login
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

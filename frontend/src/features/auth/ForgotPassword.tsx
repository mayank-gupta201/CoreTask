import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
    email: z.string().email('Invalid email address'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors, isValid, isSubmitting } } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormValues) => {
        try {
            setStatus('idle');
            const res = await api.post('/auth/forgot-password', data);
            setStatus('success');
            setMessage(res.data.message);
        } catch (err: any) {
            setStatus('error');
            setMessage(err.response?.data?.detail || 'An error occurred.');
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-sm shadow-xl">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="text-2xl">Forgot Password</CardTitle>
                        <CardDescription>Enter your email address to receive a password reset link.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {status === 'success' && <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded-md border border-green-200">{message}</div>}
                        {status === 'error' && <div className="text-sm font-medium text-destructive">{message}</div>}

                        {status !== 'success' && (
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="m@example.com" {...register('email')} />
                                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        {status !== 'success' ? (
                            <Button className="w-full" type="submit" disabled={isSubmitting || !isValid}>
                                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                            </Button>
                        ) : (
                            <Button className="w-full" type="button" onClick={() => navigate('/login')}>
                                Return to Login
                            </Button>
                        )}
                        <div className="text-sm text-center text-muted-foreground">
                            Remember your password?{' '}
                            <span className="text-primary hover:underline cursor-pointer" onClick={() => navigate('/login')}>
                                Log in
                            </span>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

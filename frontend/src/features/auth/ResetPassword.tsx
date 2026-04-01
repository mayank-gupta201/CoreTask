import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
});

type FormValues = z.infer<typeof schema>;

export function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors, isValid, isSubmitting } } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormValues) => {
        if (!token) {
            setStatus('error');
            setMessage('No reset token provided. Please request a new password reset.');
            return;
        }

        try {
            setStatus('idle');
            await api.post(`/auth/reset-password/${token}`, { password: data.password });
            setStatus('success');
            setMessage('Your password has been reset successfully!');
        } catch (err: any) {
            setStatus('error');
            setMessage(err.response?.data?.detail || 'An error occurred. The link might be expired.');
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-sm shadow-xl">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="text-2xl">Reset Password</CardTitle>
                        <CardDescription>Enter your new password below.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {status === 'success' && <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded-md border border-green-200">{message}</div>}
                        {status === 'error' && <div className="text-sm font-medium text-destructive">{message}</div>}

                        {status !== 'success' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="password">New Password</Label>
                                    <Input id="password" type="password" {...register('password')} />
                                    {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
                                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        {status !== 'success' ? (
                            <Button className="w-full" type="submit" disabled={isSubmitting || !isValid || !token}>
                                {isSubmitting ? 'Resetting...' : 'Reset Password'}
                            </Button>
                        ) : (
                            <Button className="w-full" type="button" onClick={() => navigate('/login')}>
                                Return to Login
                            </Button>
                        )}
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

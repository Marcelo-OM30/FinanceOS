'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      const res = await api.post('/auth/login', data);
      const { user, accessToken, refreshToken } = res.data;
      setAuth(user, accessToken, refreshToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Credenciais inválidas');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Entrar na sua conta
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email', {
            required: 'E-mail é obrigatório',
            pattern: {
              value: /\S+@\S+\.\S+/,
              message: 'E-mail inválido',
            },
          })}
        />
        <Input
          label="Senha"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { required: 'Senha é obrigatória' })}
        />

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" fullWidth loading={isSubmitting} size="lg">
          Entrar
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-600">
        Não tem conta?{' '}
        <Link
          href="/register"
          className="text-primary-600 hover:underline font-medium"
        >
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}

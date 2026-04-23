'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface RegisterForm {
  nome: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>();

  const onSubmit = async (data: RegisterForm) => {
    setError('');
    try {
      const res = await api.post('/auth/register', {
        nome: data.nome,
        email: data.email,
        password: data.password,
      });
      const { user, accessToken, refreshToken } = res.data;
      setAuth(user, accessToken, refreshToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao criar conta'));
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Criar sua conta
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Nome completo"
          placeholder="Seu Nome"
          autoComplete="name"
          error={errors.nome?.message}
          {...register('nome', { required: 'Nome é obrigatório' })}
        />
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
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password', {
            required: 'Senha é obrigatória',
            minLength: { value: 6, message: 'Mínimo 6 caracteres' },
          })}
        />
        <Input
          label="Confirmar senha"
          type="password"
          placeholder="Repita a senha"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Confirme sua senha',
            validate: (val) =>
              val === watch('password') || 'Senhas não coincidem',
          })}
        />

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" fullWidth loading={isSubmitting} size="lg">
          Criar conta
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-600">
        Já tem conta?{' '}
        <Link
          href="/login"
          className="text-primary-600 hover:underline font-medium"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}

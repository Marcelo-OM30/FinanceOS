export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💰</div>
          <h1 className="text-3xl font-bold text-white">Finance OS</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Inteligência Financeira Pessoal
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de lenvoi';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-success-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-success-500" />
          </div>
          <h1 className="text-2xl font-bold text-primary-800 mb-2">Email envoyé</h1>
          <p className="text-gray-500 mb-6">
            Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
          </p>
          <Link to="/auth/connexion">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/auth/connexion" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
          <img src="/logo.jpg" alt="Ciento-Immobilier" className="h-12 w-auto rounded-xl object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary-800">Mot de passe oublié</h1>
          <p className="text-gray-500 mt-1">Entrez votre email pour réinitialiser votre mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 bg-danger-50 text-danger-600 text-sm rounded-lg" role="alert">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
              icon={<Mail className="w-4 h-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-semibold" size="lg" isLoading={isLoading}>
              Envoyer le lien
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

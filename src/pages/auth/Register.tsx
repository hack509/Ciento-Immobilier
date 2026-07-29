import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Head } from '@/components/seo/Head';
import { useAuth } from '@/contexts/AuthContext';

export function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'inscription";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head title="Créer un compte" description="Rejoignez la communauté Ciento-Immobilier et publiez vos annonces." />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.jpg" alt="Ciento-Immobilier" className="h-12 w-auto rounded-xl object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-primary-800">Créer un compte</h1>
          <p className="text-gray-500 mt-1">Rejoignez la communauté Ciento-Immobilier</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 bg-danger-50 text-danger-600 text-sm rounded-lg" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Prénom"
                placeholder="Jean"
                icon={<User className="w-4 h-4" />}
                value={formData.first_name}
                onChange={handleChange('first_name')}
                required
              />
              <Input
                label="Nom"
                placeholder="Dupont"
                value={formData.last_name}
                onChange={handleChange('last_name')}
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
              icon={<Mail className="w-4 h-4" />}
              value={formData.email}
              onChange={handleChange('email')}
              required
            />
            <Input
              label="Téléphone"
              type="tel"
              placeholder="+509 xxx-xxxx"
              icon={<Phone className="w-4 h-4" />}
              value={formData.phone}
              onChange={handleChange('phone')}
            />
            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                placeholder="8 caractères minimum"
                icon={<Lock className="w-4 h-4" />}
                value={formData.password}
                onChange={handleChange('password')}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              label="Confirmer le mot de passe"
              type={showPassword ? 'text' : 'password'}
              placeholder="Répétez le mot de passe"
              icon={<Lock className="w-4 h-4" />}
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              required
            />
            <Button type="submit" className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-semibold" size="lg" isLoading={isLoading}>
              Créer mon compte
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link to="/auth/connexion" className="text-secondary-600 font-semibold hover:text-secondary-700">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
    </>
  );
}

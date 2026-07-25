import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function Contact() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contactez-nous</h1>
          <p className="text-gray-500">Nous sommes là pour vous aider</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Envoyez-nous un message</h2>
            <form className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Prénom" placeholder="Votre prénom" />
                <Input label="Nom" placeholder="Votre nom" />
              </div>
              <Input label="Email" type="email" placeholder="votre@email.com" />
              <Input label="Téléphone" type="tel" placeholder="+509 xxx-xxxx" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  rows={5}
                  placeholder="Votre message..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-secondary-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/20"
                />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Envoyer le message
              </Button>
            </form>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Nos coordonnées</h2>
            <div className="space-y-6">
              {[
                { icon: MapPin, label: 'Adresse', value: 'Les Gonaïves, Artibonite, Haïti' },
                { icon: Phone, label: 'Téléphone', value: '+509 2813-1234' },
                { icon: Mail, label: 'Email', value: 'info@ciento-immobilier.com' },
                { icon: Clock, label: 'Horaires', value: 'Lun-Sam: 8h - 18h' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-secondary-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.label}</div>
                      <div className="text-sm text-gray-500">{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

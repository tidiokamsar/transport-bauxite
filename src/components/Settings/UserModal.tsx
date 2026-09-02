import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Shield, Building, Image, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSuccess: () => void;
}

interface UserForm {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
  department: string;
  photo_url: string;
  status: string;
}

const ROLES = [
  { value: 'admin', label: 'Administrateur', color: 'red' },
  { value: 'manager', label: 'Gestionnaire', color: 'blue' },
  { value: 'dispatcher', label: 'Dispatcheur', color: 'green' },
  { value: 'fleet_manager', label: 'Responsable Flotte', color: 'purple' },
  { value: 'mechanic', label: 'Mécanicien', color: 'orange' },
  { value: 'accountant', label: 'Comptable', color: 'teal' },
  { value: 'hr_manager', label: 'RH Manager', color: 'pink' },
  { value: 'driver', label: 'Chauffeur', color: 'slate' },
];

const DEPARTMENTS = [
  'Direction',
  'Opérations',
  'Maintenance',
  'Comptabilité',
  'Ressources Humaines',
  'Logistique',
  'Sécurité',
];

export const UserModal = ({ isOpen, onClose, userId, onSuccess }: UserModalProps) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<UserForm>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'driver',
    department: 'Opérations',
    photo_url: '',
    status: 'active',
  });

  useEffect(() => {
    if (isOpen && userId) {
      fetchUser();
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, userId]);

  const fetchUser = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFormData({
          email: data.email || '',
          password: '',
          full_name: data.full_name || '',
          phone: data.phone || '',
          role: data.role || 'driver',
          department: data.department || 'Opérations',
          photo_url: data.photo_url || '',
          status: data.status || 'active',
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'driver',
      department: 'Opérations',
      photo_url: '',
      status: 'active',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (userId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
            department: formData.department,
            photo_url: formData.photo_url,
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (error) throw error;

        await supabase.rpc('log_user_activity', {
          p_action: 'user_updated',
          p_details: { user_id: userId, changes: formData },
        });
      } else {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              phone: formData.phone,
              role: formData.role,
              department: formData.department,
              photo_url: formData.photo_url,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          await supabase.rpc('log_user_activity', {
            p_action: 'user_created',
            p_details: { user_id: authData.user.id, email: formData.email },
          });
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {userId ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {userId ? 'Mettre à jour les informations' : 'Créer un nouveau compte utilisateur'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!userId && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="utilisateur@exemple.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mot de passe *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Minimum 6 caractères</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Nom complet *
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Jean Dupont"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              Téléphone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+224 XXX XX XX XX"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Rôle *
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Building className="w-4 h-4 inline mr-2" />
                Département *
              </label>
              <select
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Image className="w-4 h-4 inline mr-2" />
              Photo URL
            </label>
            <input
              type="url"
              value={formData.photo_url}
              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://exemple.com/photo.jpg"
            />
          </div>

          {userId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="suspended">Suspendu</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enregistrement...' : userId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserModal } from './UserModal';
import {
  Users, Save, Building2, Truck, Wrench, Bell, Shield,
  MapPin, Fuel, Package, FileText, Zap, Edit, Trash2, Plus, Search
} from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string;
  department: string;
  status: string;
  photo_url: string;
  created_at: string;
  last_login: string;
}

export const AdminSettingsView = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();

  useEffect(() => {
    fetchUsers();
    fetchAllSettings();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inactive' })
        .eq('id', userId);

      if (error) throw error;
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleUserModalClose = () => {
    setIsUserModalOpen(false);
    setSelectedUserId(undefined);
    fetchUsers();
  };

  const fetchAllSettings = async () => {
    try {
      const { data } = await supabase.from('settings').select('*');
      const settingsObj: any = {};
      (data || []).forEach((setting: any) => {
        settingsObj[setting.key] = setting.value?.value || '';
      });
      setSettings(settingsObj);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const user = (await supabase.auth.getUser()).data.user;

      for (const [key, value] of Object.entries(settings)) {
        await supabase
          .from('settings')
          .upsert({
            key,
            value: { value },
            category: getCategoryForKey(key),
            description: getDescriptionForKey(key),
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          }, { onConflict: 'key' });
      }

      alert('Paramètres enregistrés avec succès');
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryForKey = (key: string): string => {
    if (key.startsWith('company_')) return 'general';
    if (key.startsWith('fuel_')) return 'fuel';
    if (key.startsWith('maintenance_')) return 'maintenance';
    if (key.startsWith('alert_')) return 'alerts';
    if (key.startsWith('invoice_')) return 'invoicing';
    if (key.startsWith('gps_')) return 'gps';
    if (key.startsWith('tire_')) return 'tires';
    return 'general';
  };

  const getDescriptionForKey = (key: string): string => {
    const descriptions: Record<string, string> = {
      company_name: 'Nom de l\'entreprise',
      company_address: 'Adresse',
      company_phone: 'Téléphone',
      company_email: 'Email',
      fuel_price_diesel: 'Prix du diesel (GNF/L)',
      maintenance_interval_km: 'Intervalle maintenance (km)',
      alert_fuel_threshold: 'Seuil alerte carburant (%)',
      alert_maintenance_advance_km: 'Avance alerte maintenance (km)',
    };
    return descriptions[key] || key;
  };

  const tabs = [
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'general', label: 'Général', icon: Building2 },
    { id: 'vehicles', label: 'Véhicules', icon: Truck },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'fuel', label: 'Carburant', icon: Fuel },
    { id: 'tires', label: 'Pneus', icon: Package },
    { id: 'gps', label: 'GPS & Suivi', icon: MapPin },
    { id: 'invoicing', label: 'Facturation', icon: FileText },
    { id: 'alerts', label: 'Alertes', icon: Bell },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'integrations', label: 'Intégrations', icon: Zap },
  ];

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string; color: string }> = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
      manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700' },
      dispatcher: { label: 'Dispatcheur', color: 'bg-green-100 text-green-700' },
      fleet_manager: { label: 'Flotte', color: 'bg-purple-100 text-purple-700' },
      mechanic: { label: 'Mécanicien', color: 'bg-orange-100 text-orange-700' },
      accountant: { label: 'Comptable', color: 'bg-teal-100 text-teal-700' },
      hr_manager: { label: 'RH', color: 'bg-pink-100 text-pink-700' },
      driver: { label: 'Chauffeur', color: 'bg-slate-100 text-slate-700' },
    };
    const roleInfo = roles[role] || { label: role, color: 'bg-slate-100 text-slate-700' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>{roleInfo.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    const statuses: Record<string, { label: string; color: string }> = {
      active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
      inactive: { label: 'Inactif', color: 'bg-slate-100 text-slate-700' },
      suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-700' },
    };
    const statusInfo = statuses[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Administration</h1>
          <p className="text-slate-600 mt-1">Gestion des utilisateurs et paramètres système</p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Enregistrement...' : 'Enregistrer tout'}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Gestion des utilisateurs</h2>
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter utilisateur
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Utilisateur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rôle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Département</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Créé le</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.photo_url ? (
                          <img src={user.photo_url} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{user.full_name || 'Nom non défini'}</div>
                          <div className="text-sm text-slate-600">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 text-sm">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 text-sm">
                      {new Date(user.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditUser(user.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Désactiver"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Informations entreprise</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nom de l'entreprise
                </label>
                <input
                  type="text"
                  value={settings.company_name || ''}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="DARI HOLDING"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Adresse
                </label>
                <textarea
                  value={settings.company_address || ''}
                  onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  rows={3}
                  placeholder="Conakry, Guinée"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Téléphone
                </label>
                <input
                  type="text"
                  value={settings.company_phone || ''}
                  onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="+224 XX XX XX XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.company_email || ''}
                  onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="contact@dariholding.gn"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Configuration système</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Devise
                </label>
                <select
                  value={settings.system_currency || 'GNF'}
                  onChange={(e) => setSettings({ ...settings, system_currency: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="GNF">Franc Guinéen (GNF)</option>
                  <option value="USD">Dollar US (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Langue
                </label>
                <select
                  value={settings.system_language || 'fr'}
                  onChange={(e) => setSettings({ ...settings, system_language: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fuseau horaire
                </label>
                <select
                  value={settings.system_timezone || 'Africa/Conakry'}
                  onChange={(e) => setSettings({ ...settings, system_timezone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="Africa/Conakry">Conakry (GMT+0)</option>
                  <option value="Africa/Dakar">Dakar (GMT+0)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Format de date
                </label>
                <select
                  value={settings.date_format || 'DD/MM/YYYY'}
                  onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="DD/MM/YYYY">JJ/MM/AAAA</option>
                  <option value="MM/DD/YYYY">MM/JJ/AAAA</option>
                  <option value="YYYY-MM-DD">AAAA-MM-JJ</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Configuration véhicules</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kilométrage minimum pour alerte maintenance (km)
                </label>
                <input
                  type="number"
                  value={settings.vehicle_maintenance_km_alert || 5000}
                  onChange={(e) => setSettings({ ...settings, vehicle_maintenance_km_alert: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vitesse maximale autorisée (km/h)
                </label>
                <input
                  type="number"
                  value={settings.vehicle_max_speed || 90}
                  onChange={(e) => setSettings({ ...settings, vehicle_max_speed: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Consommation moyenne (L/100km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.vehicle_avg_consumption || 35}
                  onChange={(e) => setSettings({ ...settings, vehicle_avg_consumption: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="vehicle_auto_inspection"
                  checked={settings.vehicle_auto_inspection || false}
                  onChange={(e) => setSettings({ ...settings, vehicle_auto_inspection: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="vehicle_auto_inspection" className="text-sm text-slate-700">
                  Rappels automatiques d'inspection technique
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="vehicle_insurance_reminder"
                  checked={settings.vehicle_insurance_reminder || false}
                  onChange={(e) => setSettings({ ...settings, vehicle_insurance_reminder: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="vehicle_insurance_reminder" className="text-sm text-slate-700">
                  Alertes renouvellement assurance
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Types de véhicules</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Capacité standard dumper (tonnes)
                </label>
                <input
                  type="number"
                  value={settings.dumper_capacity || 50}
                  onChange={(e) => setSettings({ ...settings, dumper_capacity: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Capacité standard tracteur (tonnes)
                </label>
                <input
                  type="number"
                  value={settings.tractor_capacity || 40}
                  onChange={(e) => setSettings({ ...settings, tractor_capacity: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Intervalle vidange standard (km)
                </label>
                <input
                  type="number"
                  value={settings.oil_change_interval || 10000}
                  onChange={(e) => setSettings({ ...settings, oil_change_interval: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Maintenance préventive</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Intervalle maintenance routière (km)
                </label>
                <input
                  type="number"
                  value={settings.maintenance_routine_km || 10000}
                  onChange={(e) => setSettings({ ...settings, maintenance_routine_km: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Intervalle maintenance majeure (km)
                </label>
                <input
                  type="number"
                  value={settings.maintenance_major_km || 50000}
                  onChange={(e) => setSettings({ ...settings, maintenance_major_km: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Avance alerte maintenance (km)
                </label>
                <input
                  type="number"
                  value={settings.maintenance_alert_advance || 1000}
                  onChange={(e) => setSettings({ ...settings, maintenance_alert_advance: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Jours avant expiration inspection
                </label>
                <input
                  type="number"
                  value={settings.maintenance_inspection_alert_days || 30}
                  onChange={(e) => setSettings({ ...settings, maintenance_inspection_alert_days: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="maintenance_auto_schedule"
                  checked={settings.maintenance_auto_schedule || false}
                  onChange={(e) => setSettings({ ...settings, maintenance_auto_schedule: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="maintenance_auto_schedule" className="text-sm text-slate-700">
                  Planification automatique des maintenances
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Coûts et budget</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Budget mensuel maintenance (GNF)
                </label>
                <input
                  type="number"
                  value={settings.maintenance_monthly_budget || 50000000}
                  onChange={(e) => setSettings({ ...settings, maintenance_monthly_budget: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Coût moyen vidange (GNF)
                </label>
                <input
                  type="number"
                  value={settings.maintenance_oil_change_cost || 500000}
                  onChange={(e) => setSettings({ ...settings, maintenance_oil_change_cost: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Taux horaire main d'oeuvre (GNF)
                </label>
                <input
                  type="number"
                  value={settings.maintenance_hourly_rate || 25000}
                  onChange={(e) => setSettings({ ...settings, maintenance_hourly_rate: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="maintenance_budget_alert"
                  checked={settings.maintenance_budget_alert || false}
                  onChange={(e) => setSettings({ ...settings, maintenance_budget_alert: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="maintenance_budget_alert" className="text-sm text-slate-700">
                  Alertes dépassement budget
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fuel' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tarification carburant</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prix diesel (GNF/litre)
                </label>
                <input
                  type="number"
                  value={settings.fuel_price_diesel || 8500}
                  onChange={(e) => setSettings({ ...settings, fuel_price_diesel: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prix essence (GNF/litre)
                </label>
                <input
                  type="number"
                  value={settings.fuel_price_gasoline || 9000}
                  onChange={(e) => setSettings({ ...settings, fuel_price_gasoline: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Capacité réservoir standard (litres)
                </label>
                <input
                  type="number"
                  value={settings.fuel_tank_capacity || 300}
                  onChange={(e) => setSettings({ ...settings, fuel_tank_capacity: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="fuel_auto_update_price"
                  checked={settings.fuel_auto_update_price || false}
                  onChange={(e) => setSettings({ ...settings, fuel_auto_update_price: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="fuel_auto_update_price" className="text-sm text-slate-700">
                  Mise à jour automatique des prix
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Alertes carburant</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Seuil alerte faible niveau (%)
                </label>
                <input
                  type="number"
                  value={settings.fuel_low_level_alert || 20}
                  onChange={(e) => setSettings({ ...settings, fuel_low_level_alert: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Seuil alerte niveau critique (%)
                </label>
                <input
                  type="number"
                  value={settings.fuel_critical_level_alert || 10}
                  onChange={(e) => setSettings({ ...settings, fuel_critical_level_alert: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Variation anormale détection (%)
                </label>
                <input
                  type="number"
                  value={settings.fuel_anomaly_threshold || 15}
                  onChange={(e) => setSettings({ ...settings, fuel_anomaly_threshold: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="fuel_theft_detection"
                  checked={settings.fuel_theft_detection || false}
                  onChange={(e) => setSettings({ ...settings, fuel_theft_detection: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="fuel_theft_detection" className="text-sm text-slate-700">
                  Détection automatique de vol de carburant
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tires' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Gestion des pneus</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kilométrage moyen avant remplacement (km)
                </label>
                <input
                  type="number"
                  value={settings.tire_replacement_km || 80000}
                  onChange={(e) => setSettings({ ...settings, tire_replacement_km: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Profondeur minimale (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.tire_min_tread_depth || 3.0}
                  onChange={(e) => setSettings({ ...settings, tire_min_tread_depth: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pression recommandée (PSI)
                </label>
                <input
                  type="number"
                  value={settings.tire_pressure_psi || 110}
                  onChange={(e) => setSettings({ ...settings, tire_pressure_psi: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre maximum de rechapage
                </label>
                <input
                  type="number"
                  value={settings.tire_max_retreads || 3}
                  onChange={(e) => setSettings({ ...settings, tire_max_retreads: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="tire_rotation_reminder"
                  checked={settings.tire_rotation_reminder || false}
                  onChange={(e) => setSettings({ ...settings, tire_rotation_reminder: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="tire_rotation_reminder" className="text-sm text-slate-700">
                  Rappels rotation des pneus
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Coûts pneus</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prix moyen pneu neuf (GNF)
                </label>
                <input
                  type="number"
                  value={settings.tire_new_price || 1500000}
                  onChange={(e) => setSettings({ ...settings, tire_new_price: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Coût rechapage (GNF)
                </label>
                <input
                  type="number"
                  value={settings.tire_retread_cost || 600000}
                  onChange={(e) => setSettings({ ...settings, tire_retread_cost: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Budget mensuel pneus (GNF)
                </label>
                <input
                  type="number"
                  value={settings.tire_monthly_budget || 20000000}
                  onChange={(e) => setSettings({ ...settings, tire_monthly_budget: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gps' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Configuration GPS</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Intervalle de mise à jour (secondes)
                </label>
                <input
                  type="number"
                  value={settings.gps_update_interval || 30}
                  onChange={(e) => setSettings({ ...settings, gps_update_interval: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Durée historique conservé (jours)
                </label>
                <input
                  type="number"
                  value={settings.gps_history_retention || 90}
                  onChange={(e) => setSettings({ ...settings, gps_history_retention: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rayon géofencing par défaut (mètres)
                </label>
                <input
                  type="number"
                  value={settings.gps_geofence_radius || 500}
                  onChange={(e) => setSettings({ ...settings, gps_geofence_radius: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="gps_realtime_tracking"
                  checked={settings.gps_realtime_tracking || false}
                  onChange={(e) => setSettings({ ...settings, gps_realtime_tracking: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="gps_realtime_tracking" className="text-sm text-slate-700">
                  Suivi en temps réel activé
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="gps_route_recording"
                  checked={settings.gps_route_recording || false}
                  onChange={(e) => setSettings({ ...settings, gps_route_recording: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="gps_route_recording" className="text-sm text-slate-700">
                  Enregistrement automatique des trajets
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Alertes GPS</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Temps maximum hors connexion (minutes)
                </label>
                <input
                  type="number"
                  value={settings.gps_offline_timeout || 30}
                  onChange={(e) => setSettings({ ...settings, gps_offline_timeout: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="gps_speed_alert"
                  checked={settings.gps_speed_alert || false}
                  onChange={(e) => setSettings({ ...settings, gps_speed_alert: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="gps_speed_alert" className="text-sm text-slate-700">
                  Alertes excès de vitesse
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="gps_geofence_alert"
                  checked={settings.gps_geofence_alert || false}
                  onChange={(e) => setSettings({ ...settings, gps_geofence_alert: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="gps_geofence_alert" className="text-sm text-slate-700">
                  Alertes sortie de zone
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="gps_idle_alert"
                  checked={settings.gps_idle_alert || false}
                  onChange={(e) => setSettings({ ...settings, gps_idle_alert: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="gps_idle_alert" className="text-sm text-slate-700">
                  Alertes temps d'arrêt prolongé
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoicing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Configuration facturation</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Préfixe numéro facture
                </label>
                <input
                  type="text"
                  value={settings.invoice_prefix || 'INV'}
                  onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Délai de paiement par défaut (jours)
                </label>
                <input
                  type="number"
                  value={settings.invoice_payment_terms || 30}
                  onChange={(e) => setSettings({ ...settings, invoice_payment_terms: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Taux TVA (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.invoice_vat_rate || 18}
                  onChange={(e) => setSettings({ ...settings, invoice_vat_rate: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pénalités de retard (% par mois)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.invoice_late_fee || 2}
                  onChange={(e) => setSettings({ ...settings, invoice_late_fee: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="invoice_auto_numbering"
                  checked={settings.invoice_auto_numbering || false}
                  onChange={(e) => setSettings({ ...settings, invoice_auto_numbering: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="invoice_auto_numbering" className="text-sm text-slate-700">
                  Numérotation automatique
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Rappels paiement</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Premier rappel avant échéance (jours)
                </label>
                <input
                  type="number"
                  value={settings.invoice_reminder_1 || 7}
                  onChange={(e) => setSettings({ ...settings, invoice_reminder_1: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Deuxième rappel après échéance (jours)
                </label>
                <input
                  type="number"
                  value={settings.invoice_reminder_2 || 7}
                  onChange={(e) => setSettings({ ...settings, invoice_reminder_2: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="invoice_auto_reminder"
                  checked={settings.invoice_auto_reminder || false}
                  onChange={(e) => setSettings({ ...settings, invoice_auto_reminder: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="invoice_auto_reminder" className="text-sm text-slate-700">
                  Envoi automatique des rappels
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Configuration des alertes</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Types d'alertes</h3>
              {[
                { key: 'alert_maintenance', label: 'Alertes maintenance' },
                { key: 'alert_fuel_low', label: 'Alertes niveau carburant bas' },
                { key: 'alert_inspection', label: 'Alertes inspection technique' },
                { key: 'alert_insurance', label: 'Alertes renouvellement assurance' },
                { key: 'alert_speed', label: 'Alertes excès de vitesse' },
                { key: 'alert_geofence', label: 'Alertes sortie de zone' },
                { key: 'alert_tire', label: 'Alertes usure pneus' },
                { key: 'alert_overdue_invoice', label: 'Alertes factures impayées' },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={item.key}
                    checked={settings[item.key] ?? true}
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor={item.key} className="text-sm text-slate-700">
                    {item.label}
                  </label>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Canaux de notification</h3>
              {[
                { key: 'notification_email', label: 'Notifications par email' },
                { key: 'notification_sms', label: 'Notifications par SMS' },
                { key: 'notification_push', label: 'Notifications push' },
                { key: 'notification_dashboard', label: 'Notifications dans l\'application' },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={item.key}
                    checked={settings[item.key] ?? true}
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor={item.key} className="text-sm text-slate-700">
                    {item.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sécurité</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Durée de session (minutes)
                </label>
                <input
                  type="number"
                  value={settings.session_timeout || 60}
                  onChange={(e) => setSettings({ ...settings, session_timeout: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Longueur minimale mot de passe
                </label>
                <input
                  type="number"
                  value={settings.password_min_length || 8}
                  onChange={(e) => setSettings({ ...settings, password_min_length: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="require_strong_password"
                  checked={settings.require_strong_password || false}
                  onChange={(e) => setSettings({ ...settings, require_strong_password: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="require_strong_password" className="text-sm text-slate-700">
                  Exiger mots de passe complexes
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enable_2fa"
                  checked={settings.enable_2fa || false}
                  onChange={(e) => setSettings({ ...settings, enable_2fa: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="enable_2fa" className="text-sm text-slate-700">
                  Authentification à deux facteurs
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="log_user_activity"
                  checked={settings.log_user_activity || false}
                  onChange={(e) => setSettings({ ...settings, log_user_activity: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="log_user_activity" className="text-sm text-slate-700">
                  Journaliser activité utilisateurs
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sauvegardes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fréquence sauvegardes automatiques
                </label>
                <select
                  value={settings.backup_frequency || 'daily'}
                  onChange={(e) => setSettings({ ...settings, backup_frequency: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="hourly">Chaque heure</option>
                  <option value="daily">Quotidienne</option>
                  <option value="weekly">Hebdomadaire</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Durée conservation sauvegardes (jours)
                </label>
                <input
                  type="number"
                  value={settings.backup_retention || 30}
                  onChange={(e) => setSettings({ ...settings, backup_retention: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="backup_enabled"
                  checked={settings.backup_enabled || false}
                  onChange={(e) => setSettings({ ...settings, backup_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="backup_enabled" className="text-sm text-slate-700">
                  Activer sauvegardes automatiques
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Intégrations tierces</h2>
          <div className="space-y-6">
            <div className="border-b pb-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">API REST</h3>
                  <p className="text-sm text-slate-600">Accès API pour intégrations externes</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.api_enabled || false}
                    onChange={(e) => setSettings({ ...settings, api_enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>
              </div>
              {settings.api_enabled && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Clé API
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.api_key || 'sk_xxxxxxxxxxxxx'}
                      readOnly
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                    />
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                      Régénérer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Webhook</h3>
                  <p className="text-sm text-slate-600">Notifications événements en temps réel</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.webhook_enabled || false}
                  onChange={(e) => setSettings({ ...settings, webhook_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>
            </div>

            <div className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Google Maps</h3>
                  <p className="text-sm text-slate-600">Intégration cartographie GPS</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.google_maps_enabled || false}
                  onChange={(e) => setSettings({ ...settings, google_maps_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Export comptabilité</h3>
                  <p className="text-sm text-slate-600">Export automatique vers logiciel comptable</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.accounting_export_enabled || false}
                  onChange={(e) => setSettings({ ...settings, accounting_export_enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <UserModal
        isOpen={isUserModalOpen}
        onClose={handleUserModalClose}
        userId={selectedUserId}
        onSuccess={handleUserModalClose}
      />
    </div>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, RefreshCw, Building2, DollarSign, Bell, AlertTriangle, Calculator, Settings as SettingsIcon, TestTube } from 'lucide-react';

interface Setting {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string;
}

export const SettingsView = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'tests'>('settings');
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;

      setSettings(data || []);

      const initialData: Record<string, any> = {};
      (data || []).forEach((setting) => {
        initialData[setting.key] = setting.value?.value !== undefined ? setting.value.value : '';
      });
      setFormData(initialData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const user = (await supabase.auth.getUser()).data.user;

      const updates = Object.entries(formData).map(([key, value]) => {
        const setting = settings.find(s => s.key === key);
        if (!setting) return null;

        return supabase
          .from('settings')
          .update({
            value: { value },
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          })
          .eq('key', key);
      });

      await Promise.all(updates.filter(Boolean));

      alert('Paramètres enregistrés avec succès');
      fetchSettings();
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const getCategorySettings = (category: string) => {
    return settings.filter(s => s.category === category);
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      general: Building2,
      pricing: DollarSign,
      alerts: AlertTriangle,
      notifications: Bell,
      accounting: Calculator,
    };
    return icons[category] || SettingsIcon;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: 'Paramètres généraux',
      pricing: 'Tarification',
      alerts: 'Alertes et seuils',
      notifications: 'Notifications',
      accounting: 'Comptabilité',
    };
    return labels[category] || category;
  };

  const renderInput = (setting: Setting) => {
    const value = formData[setting.key] ?? '';
    const type = typeof value === 'boolean' ? 'checkbox' : typeof value === 'number' ? 'number' : 'text';

    if (type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setFormData({ ...formData, [setting.key]: e.target.checked })}
            className="w-4 h-4 text-slate-900 rounded focus:ring-slate-900"
          />
          <span className="text-sm text-slate-600">{value ? 'Activé' : 'Désactivé'}</span>
        </label>
      );
    }

    return (
      <input
        type={type}
        value={value}
        onChange={(e) => {
          const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
          setFormData({ ...formData, [setting.key]: newValue });
        }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
      />
    );
  };

  const categories = ['general', 'pricing', 'alerts', 'notifications', 'accounting'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Administration</h1>
          <p className="text-slate-600 mt-1">Configuration et tests du système</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab(activeTab === 'settings' ? 'tests' : 'settings')}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <TestTube className="w-5 h-5" />
            {activeTab === 'settings' ? 'Tests' : 'Paramètres'}
          </button>
          <button
            onClick={fetchSettings}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map((category) => {
          const categorySettings = getCategorySettings(category);
          if (categorySettings.length === 0) return null;

          const Icon = getCategoryIcon(category);

          return (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Icon className="w-6 h-6 text-slate-700" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {getCategoryLabel(category)}
                </h2>
              </div>

              <div className="space-y-5">
                {categorySettings.map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-900">
                        {setting.description || setting.key}
                      </span>
                      <div className="mt-1.5">
                        {renderInput(setting)}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Informations importantes
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>Les modifications des tarifs s'appliquent uniquement aux nouveaux voyages et transactions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>Les seuils d'alerte sont vérifiés quotidiennement par le système</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>Les notifications par email nécessitent une configuration SMTP valide</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>Certains paramètres peuvent nécessiter un redémarrage de l'application</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Paramètres</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{settings.length}</p>
          <p className="text-sm text-slate-600">configurables</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Tarifs</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{getCategorySettings('pricing').length}</p>
          <p className="text-sm text-slate-600">barèmes définis</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Bell className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Alertes</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{getCategorySettings('alerts').length}</p>
          <p className="text-sm text-slate-600">seuils configurés</p>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserModal } from './UserModal';
import { FicheSociete } from './FicheSociete';
import { ReglagesServeur } from './ReglagesServeur';
import { AffectationsSites } from './AffectationsSites';
import { Delegations } from './Delegations';
import { JournalConnexions } from './JournalConnexions';
import { Referentiels } from './Referentiels';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Building2, SlidersHorizontal, Edit, Trash2, Plus, Search, MapPin, UserCheck, History, ListOrdered } from 'lucide-react';

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
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [organisations, setOrganisations] = useState<{ id: string; raison_sociale: string; statut: string }[]>([]);
  const [nouvelleOrg, setNouvelleOrg] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchOrganisations();
  }, []);

  const fetchOrganisations = async () => {
    const { data } = await supabase
      .from('organisations')
      .select('id, raison_sociale, statut')
      .order('raison_sociale');
    setOrganisations((data as { id: string; raison_sociale: string; statut: string }[] | null) ?? []);
  };

  const creerOrganisation = async () => {
    const nom = nouvelleOrg.trim();
    if (!nom) return;
    const { error } = await supabase.from('organisations').insert({ raison_sociale: nom });
    if (error) { alert(error.message); return; }
    setNouvelleOrg('');
    fetchOrganisations();
  };

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

  // Parametres : seuls les onglets qui agissent reellement (D-061). Les
  // anciens onglets Bolt (vehicules, carburant, GPS, integrations...)
  // enregistraient des cles lues nulle part, dont une cle API fictive.
  const tabs = [
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'organisations', label: 'Organisations', icon: Building2 },
    { id: 'affectations', label: 'Affectations multisites', icon: MapPin },
    { id: 'delegations', label: 'Délégations', icon: UserCheck },
    { id: 'connexions', label: 'Journal de connexion', icon: History },
    { id: 'referentiels', label: 'Référentiels et numérotation', icon: ListOrdered },
    { id: 'general', label: 'Général', icon: SlidersHorizontal },
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

      {activeTab === 'organisations' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Organisations</h3>
          <p className="text-sm text-slate-600 mb-4">
            Référentiel des organisations (D-038) : chaque site s'y rattache ; la création est réservée à l'administrateur.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              value={nouvelleOrg}
              onChange={(e) => setNouvelleOrg(e.target.value)}
              placeholder="Raison sociale de la nouvelle organisation"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
            />
            <button onClick={creerOrganisation} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">
              <Plus className="w-4 h-4" /> Créer
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Raison sociale</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {organisations.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{o.raison_sociale}</td>
                  <td className="px-6 py-4 text-slate-700 text-sm">{o.statut === 'active' ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
              {organisations.length === 0 && (
                <tr><td className="px-6 py-4 text-slate-500 text-sm" colSpan={2}>Aucune organisation saisie.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'affectations' && <AffectationsSites />}
      {activeTab === 'delegations' && <Delegations administration />}
      {activeTab === 'connexions' && <JournalConnexions />}
      {activeTab === 'referentiels' && <Referentiels />}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <FicheSociete peutEcrire={hasPermission('settings', 'edit') || hasPermission('settings', 'create')} />
          <ReglagesServeur peutEcrire={hasPermission('settings', 'edit') || hasPermission('settings', 'create')} />
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

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  MapPin, Building2, Package, TrendingUp, Users, Plus,
  Edit, Trash2, Search, Filter, Phone, Mail
} from 'lucide-react';
import { buttonStyles, cardStyles } from '../../styles/theme';
import { SiteModal } from './SiteModal';

interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  capacity?: number;
  current_stock?: number;
  is_active: boolean;
  manager_id?: string;
  manager_name?: string;
  notes?: string;
}

export const SitesView = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sites')
        .select(`
          *,
          employees(name)
        `)
        .order('name');

      if (error) throw error;

      const formattedSites: Site[] = (data || []).map((site: any) => ({
        id: site.id,
        name: site.name,
        type: site.type,
        address: site.address,
        city: site.city,
        country: site.country,
        latitude: site.latitude,
        longitude: site.longitude,
        contact_name: site.contact_name,
        contact_phone: site.contact_phone,
        contact_email: site.contact_email,
        capacity: site.capacity,
        current_stock: site.current_stock,
        is_active: site.is_active,
        manager_id: site.manager_id,
        manager_name: site.employees?.name,
        notes: site.notes
      }));

      setSites(formattedSites);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce site ?')) return;

    try {
      const { error } = await supabase
        .from('sites')
        .delete()
        .eq('id', siteId);

      if (error) throw error;
      fetchSites();
    } catch (error) {
      console.error('Error deleting site:', error);
      alert('Erreur lors de la suppression du site');
    }
  };

  const getSiteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      headquarters: 'Siège social',
      warehouse: 'Entrepôt',
      depot: 'Dépôt',
      office: 'Bureau',
      maintenance_center: 'Centre de maintenance',
      fuel_station: 'Station carburant',
      parking: 'Parking',
      mine: 'Mine',
      port: 'Port',
      other: 'Autre'
    };
    return labels[type] || type;
  };

  const getSiteTypeIcon = (type: string) => {
    switch (type) {
      case 'warehouse':
      case 'depot':
        return <Package className="w-8 h-8" />;
      case 'headquarters':
      case 'office':
        return <Building2 className="w-8 h-8" />;
      case 'mine':
      case 'port':
        return <TrendingUp className="w-8 h-8" />;
      default:
        return <MapPin className="w-8 h-8" />;
    }
  };

  const filteredSites = sites.filter(site => {
    if (filterType !== 'all' && site.type !== filterType) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!site.name.toLowerCase().includes(search) &&
          !site.city.toLowerCase().includes(search) &&
          !site.address.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: sites.length,
    active: sites.filter(s => s.is_active).length,
    warehouses: sites.filter(s => s.type === 'warehouse' || s.type === 'depot').length,
    totalCapacity: sites.reduce((sum, s) => sum + (s.capacity || 0), 0),
    totalStock: sites.reduce((sum, s) => sum + (s.current_stock || 0), 0)
  };

  const siteTypes = [...new Set(sites.map(s => s.type))];

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
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Sites</h1>
          <p className="text-gray-600">Entrepôts, dépôts et sites de l'entreprise</p>
        </div>
        <button
          onClick={() => {
            setSelectedSite(null);
            setShowModal(true);
          }}
          className={buttonStyles.primary}
        >
          <Plus className="w-5 h-5 inline mr-2" />
          Nouveau site
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total sites</p>
              <p className="text-4xl font-bold mt-2">{stats.total}</p>
            </div>
            <MapPin className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Sites actifs</p>
              <p className="text-4xl font-bold mt-2">{stats.active}</p>
            </div>
            <Building2 className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Entrepôts</p>
              <p className="text-4xl font-bold mt-2">{stats.warehouses}</p>
            </div>
            <Package className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Utilisation</p>
              <p className="text-4xl font-bold mt-2">
                {stats.totalCapacity > 0 ? Math.round((stats.totalStock / stats.totalCapacity) * 100) : 0}%
              </p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      <div className={cardStyles}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un site..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">Tous les types</option>
                {siteTypes.map(type => (
                  <option key={type} value={type}>
                    {getSiteTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSites.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucun site trouvé</h3>
            <p className="text-gray-500">Ajoutez votre premier site pour commencer</p>
          </div>
        ) : (
          filteredSites.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all overflow-hidden"
            >
              <div className={`h-2 ${site.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      {getSiteTypeIcon(site.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{site.name}</h3>
                      <p className="text-sm text-gray-600">{getSiteTypeLabel(site.type)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedSite(site);
                        setShowModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(site.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-900">{site.address}</p>
                      <p className="text-gray-600">{site.city}, {site.country}</p>
                    </div>
                  </div>

                  {site.contact_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{site.contact_name}</span>
                    </div>
                  )}

                  {site.contact_phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{site.contact_phone}</span>
                    </div>
                  )}

                  {site.contact_email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{site.contact_email}</span>
                    </div>
                  )}

                  {site.manager_name && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-600">Responsable</p>
                      <p className="text-sm font-medium text-gray-900">{site.manager_name}</p>
                    </div>
                  )}

                  {(site.capacity || site.current_stock) && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Capacité</span>
                        <span className="font-medium text-gray-900">
                          {site.current_stock || 0} / {site.capacity || 0}
                        </span>
                      </div>
                      {site.capacity && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, ((site.current_stock || 0) / site.capacity) * 100)}%`
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <SiteModal
          site={selectedSite}
          onClose={() => {
            setShowModal(false);
            setSelectedSite(null);
          }}
          onSave={() => {
            fetchSites();
            setShowModal(false);
            setSelectedSite(null);
          }}
        />
      )}
    </div>
  );
};

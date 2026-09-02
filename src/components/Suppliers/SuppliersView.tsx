import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, Users, Star, Phone, Mail, MapPin, RefreshCw, Edit, Eye
} from 'lucide-react';
import { SupplierModal } from './SupplierModal';

interface Supplier {
  id: string;
  supplier_number: string;
  supplier_type: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  rating: number | null;
  active: boolean;
}

export const SuppliersView = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | undefined>();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('company_name', { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch =
      supplier.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.supplier_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || supplier.supplier_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const activeSuppliers = suppliers.filter(s => s.active).length;
  const avgRating = suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.filter(s => s.rating).length || 0;

  const getTypeLabel = (type: string) => {
    const labels = {
      parts: 'Pièces détachées',
      tires: 'Pneus',
      fuel: 'Carburant',
      services: 'Services',
      other: 'Autre',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-xs text-slate-400">Non évalué</span>;

    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

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
          <h1 className="text-3xl font-bold text-slate-900">Gestion des Fournisseurs</h1>
          <p className="text-slate-600 mt-1">Répertoire et évaluation des fournisseurs</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSuppliers}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setSelectedSupplier(undefined); setShowModal(true); }}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nouveau fournisseur
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total fournisseurs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{suppliers.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Actifs</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeSuppliers}</p>
            </div>
            <Users className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Note moyenne</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold text-yellow-600">{avgRating.toFixed(1)}</p>
                <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              </div>
            </div>
            <Star className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou numéro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="all">Tous les types</option>
              <option value="parts">Pièces détachées</option>
              <option value="tires">Pneus</option>
              <option value="fuel">Carburant</option>
              <option value="services">Services</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                Aucun fournisseur trouvé
              </div>
            ) : (
              filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="bg-slate-50 rounded-lg p-6 border border-slate-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">{supplier.company_name}</h3>
                      <p className="text-sm text-slate-600 mt-1">{supplier.supplier_number}</p>
                      <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 mt-2">
                        {getTypeLabel(supplier.supplier_type)}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      supplier.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {supplier.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {supplier.contact_name && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Users className="w-4 h-4 flex-shrink-0" />
                        <span>{supplier.contact_name}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Évaluation</p>
                      {renderStars(supplier.rating)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setSelectedSupplier(supplier); setShowModal(true); }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <SupplierModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedSupplier(undefined); }}
        onSuccess={() => { fetchSuppliers(); setShowModal(false); setSelectedSupplier(undefined); }}
        supplier={selectedSupplier}
      />
    </div>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, FileText, AlertTriangle, CheckCircle, Clock,
  RefreshCw, Edit, Eye, Calendar, DollarSign
} from 'lucide-react';
import { VehicleDocumentModal } from './VehicleDocumentModal';

interface VehicleDocument {
  id: string;
  vehicle_id: string;
  document_type: string;
  document_name: string;
  reference_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  provider: string | null;
  cost: number;
  notes: string | null;
  uploaded_at: string;
  vehicle?: {
    registration: string;
    brand_model: string;
  };
}

export const VehicleDocumentsView = () => {
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<VehicleDocument | undefined>();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicle_documents')
        .select(`
          *,
          vehicle:vehicles(registration, brand_model)
        `)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      insurance: 'Assurance',
      registration: 'Carte Grise',
      technical_inspection: 'Visite Technique',
      transport_license: 'Autorisation Transport',
      circulation_permit: 'Permis Circulation',
      tax_vignette: 'Vignette',
      authorization: 'Autorisation',
      other: 'Autre'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      pending_renewal: 'bg-orange-100 text-orange-800',
      archived: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Actif',
      expired: 'Expiré',
      pending_renewal: 'À renouveler',
      archived: 'Archivé'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4" />;
      case 'pending_renewal':
        return <Clock className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.document_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.vehicle?.registration?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || doc.document_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesVehicle = vehicleFilter === 'all' || doc.vehicle_id === vehicleFilter;

    return matchesSearch && matchesType && matchesStatus && matchesVehicle;
  });

  const activeDocuments = documents.filter(d => d.status === 'active').length;
  const expiredDocuments = documents.filter(d => d.status === 'expired').length;
  const pendingRenewal = documents.filter(d => d.status === 'pending_renewal').length;
  const totalCost = documents.reduce((sum, d) => sum + (d.cost || 0), 0);

  const documentTypes = [...new Set(documents.map(d => d.document_type))];

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
          <h1 className="text-3xl font-bold text-slate-900">Documents Véhicules</h1>
          <p className="text-slate-600 mt-1">Gestion des assurances, cartes grises, visites techniques</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDocuments}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setSelectedDocument(undefined);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nouveau document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Actifs</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeDocuments}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">À renouveler</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{pendingRenewal}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Expirés</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{expiredDocuments}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Coût total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {(totalCost / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-slate-500">GNF</p>
            </div>
            <DollarSign className="w-8 h-8 text-slate-400" />
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
                placeholder="Rechercher par nom, référence ou véhicule..."
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
              {documentTypes.map(type => (
                <option key={type} value={type}>{getDocumentTypeLabel(type)}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="pending_renewal">À renouveler</option>
              <option value="expired">Expiré</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Document</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Véhicule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Référence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date d'expiration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fournisseur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Coût</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    Aucun document trouvé
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const daysUntilExpiry = getDaysUntilExpiry(doc.expiry_date);

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">
                          {getDocumentTypeLabel(doc.document_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{doc.document_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-slate-900">{doc.vehicle?.registration}</div>
                          <div className="text-slate-500">{doc.vehicle?.brand_model}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {doc.reference_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {doc.expiry_date ? (
                          <div className="text-sm">
                            <div className="text-slate-900">
                              {new Date(doc.expiry_date).toLocaleDateString('fr-FR')}
                            </div>
                            {daysUntilExpiry !== null && (
                              <div className={`text-xs ${
                                daysUntilExpiry < 0 ? 'text-red-600' :
                                daysUntilExpiry <= 30 ? 'text-orange-600' :
                                'text-slate-500'
                              }`}>
                                {daysUntilExpiry < 0 ? `Expiré depuis ${Math.abs(daysUntilExpiry)} jours` :
                                 daysUntilExpiry === 0 ? 'Expire aujourd\'hui' :
                                 `Dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}`}
                              </div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {doc.provider || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {((doc.cost || 0) / 1000000).toFixed(2)}M
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                          {getStatusIcon(doc.status)}
                          {getStatusLabel(doc.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Voir détails"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowModal(true);
                            }}
                            className="p-1 text-slate-600 hover:bg-slate-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Documents nécessitant une action
          </h3>
          <div className="space-y-3">
            {documents
              .filter(d => d.status === 'expired' || d.status === 'pending_renewal')
              .slice(0, 5)
              .map(doc => {
                const daysUntilExpiry = getDaysUntilExpiry(doc.expiry_date);
                return (
                  <div key={doc.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                    doc.status === 'expired' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
                  }`}>
                    {doc.status === 'expired' ? (
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {doc.document_name}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {doc.vehicle?.registration} - {getDocumentTypeLabel(doc.document_type)}
                      </p>
                      {daysUntilExpiry !== null && (
                        <p className="text-xs text-slate-600 mt-1">
                          {daysUntilExpiry < 0 ? `Expiré depuis ${Math.abs(daysUntilExpiry)} jours` :
                           `Expire dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Prochaines expirations
          </h3>
          <div className="space-y-3">
            {documents
              .filter(d => d.status === 'active' && d.expiry_date)
              .sort((a, b) => {
                const dateA = new Date(a.expiry_date!).getTime();
                const dateB = new Date(b.expiry_date!).getTime();
                return dateA - dateB;
              })
              .slice(0, 5)
              .map(doc => {
                const daysUntilExpiry = getDaysUntilExpiry(doc.expiry_date);
                return (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{doc.document_name}</p>
                      <p className="text-xs text-slate-600">{doc.vehicle?.registration}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('fr-FR') : '-'}
                      </p>
                      {daysUntilExpiry !== null && (
                        <p className="text-xs text-slate-600">
                          {daysUntilExpiry} jour{daysUntilExpiry > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <VehicleDocumentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDocument(undefined);
        }}
        onSuccess={() => {
          fetchDocuments();
          setShowModal(false);
          setSelectedDocument(undefined);
        }}
        document={selectedDocument}
      />
    </div>
  );
};

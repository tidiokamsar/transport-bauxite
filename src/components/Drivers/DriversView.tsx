import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Plus, Search, AlertCircle, Phone, Mail, Calendar, FileText, Ban, CheckCircle, Table } from 'lucide-react';
import { DriverModal } from './DriverModal';
import { exportToCSV, exportToPDF } from '../../lib/exports';

interface Driver {
  id: string;
  name: string;
  employee_id: string;
  phone: string | null;
  email: string | null;
  hire_date: string;
  birth_date: string | null;
  license_number: string;
  license_category: string;
  license_expiry: string;
  health_certificate_expiry: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  contract_type: string;
  base_salary: number;
  status: 'active' | 'suspended' | 'terminated';
  notes: string | null;
  total_tonnage: number;
  total_km: number;
  created_at: string;
}

export const DriversView = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name');

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = () => {
    setSelectedDriver(null);
    setIsModalOpen(true);
  };

  const handleEditDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setIsModalOpen(true);
  };

  const handleModalClose = (saved: boolean) => {
    setIsModalOpen(false);
    setSelectedDriver(null);
    if (saved) {
      fetchDrivers();
    }
  };

  const handleExportCSV = () => {
    const formattedData = filteredDrivers.map(d => ({
      'Nom': d.name,
      'ID Employé': d.employee_id,
      'Téléphone': d.phone || '-',
      'Email': d.email || '-',
      'Permis': d.license_number,
      'Catégorie': d.license_category,
      'Expire permis': new Date(d.license_expiry).toLocaleDateString('fr-FR'),
      'Type contrat': d.contract_type,
      'Salaire': d.base_salary,
      'Statut': d.status === 'active' ? 'Actif' : d.status === 'suspended' ? 'Suspendu' : 'Terminé',
      'Date embauche': new Date(d.hire_date).toLocaleDateString('fr-FR'),
      'Total KM': d.total_km || 0,
      'Total tonnage': d.total_tonnage || 0
    }));
    exportToCSV(formattedData, 'chauffeurs');
  };

  const handleExportPDF = () => {
    const formattedData = filteredDrivers.map(d => ({
      'Nom': d.name,
      'ID': d.employee_id,
      'Téléphone': d.phone || '-',
      'Permis': d.license_number,
      'Catégorie': d.license_category,
      'Expire': new Date(d.license_expiry).toLocaleDateString('fr-FR'),
      'Contrat': d.contract_type,
      'Statut': d.status === 'active' ? 'Actif' : d.status === 'suspended' ? 'Suspendu' : 'Terminé'
    }));
    exportToPDF('Liste des chauffeurs', formattedData, 'chauffeurs');
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-orange-100 text-orange-800',
      terminated: 'bg-red-100 text-red-800',
    };
    const labels = {
      active: 'Actif',
      suspended: 'Suspendu',
      terminated: 'Terminé',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status === 'active' && <CheckCircle className="w-3 h-3" />}
        {status === 'suspended' && <AlertCircle className="w-3 h-3" />}
        {status === 'terminated' && <Ban className="w-3 h-3" />}
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const isExpiringSoon = (date: string) => {
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (date: string) => {
    return new Date(date) < new Date();
  };

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.license_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeDrivers = drivers.filter(d => d.status === 'active').length;
  const suspendedDrivers = drivers.filter(d => d.status === 'suspended').length;
  const expiringLicenses = drivers.filter(d => isExpiringSoon(d.license_expiry)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chauffeurs</h1>
          <p className="text-slate-600 mt-1">Gestion des chauffeurs et du personnel</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              title="Exporter en CSV/Excel"
            >
              <Table className="w-5 h-5" />
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              title="Exporter en PDF"
            >
              <FileText className="w-5 h-5" />
              PDF
            </button>
          </div>
          <button
            onClick={handleAddDriver}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Ajouter un chauffeur
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total chauffeurs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{drivers.length}</p>
            </div>
            <Users className="w-8 h-8 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Chauffeurs actifs</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeDrivers}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Suspendus</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{suspendedDrivers}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Permis à renouveler</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{expiringLicenses}</p>
            </div>
            <Calendar className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, ID ou permis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="suspended">Suspendus</option>
              <option value="terminated">Terminés</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Chauffeur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Permis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Contrat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Aucun chauffeur trouvé
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => (
                  <tr
                    key={driver.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleEditDriver(driver)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-semibold">
                          {driver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{driver.name}</div>
                          <div className="text-sm text-slate-500">{driver.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {driver.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-4 h-4" />
                            {driver.phone}
                          </div>
                        )}
                        {driver.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-4 h-4" />
                            {driver.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-900">{driver.license_number}</div>
                        <div className="text-sm text-slate-600">Catégorie {driver.license_category}</div>
                        <div className={`text-xs ${isExpired(driver.license_expiry) ? 'text-red-600 font-medium' : isExpiringSoon(driver.license_expiry) ? 'text-orange-600 font-medium' : 'text-slate-500'}`}>
                          Expire: {new Date(driver.license_expiry).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm text-slate-900 capitalize">{driver.contract_type}</div>
                        <div className="text-sm text-slate-600">
                          {driver.base_salary.toLocaleString('fr-FR')} GNF
                        </div>
                        <div className="text-xs text-slate-500">
                          Depuis: {new Date(driver.hire_date).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(driver.status)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDriver(driver);
                        }}
                        className="text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <DriverModal
          driver={selectedDriver}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit2, Eye, FileText, Table } from 'lucide-react';
import { VehicleModal } from './VehicleModal';
import { exportToCSV, exportToPDF } from '../../lib/exports';

interface Vehicle {
  id: string;
  registration: string;
  brand_model: string;
  capacity_tonnes: number;
  vehicle_type: string;
  status: string;
  current_km: number;
  insurance_expiry: string | null;
  technical_inspection_expiry: string | null;
}

export const VehiclesView = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('registration');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter((vehicle) =>
    vehicle.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.brand_model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      maintenance: 'bg-orange-100 text-orange-800',
      immobilized: 'bg-red-100 text-red-800',
      sold: 'bg-slate-100 text-slate-800',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      active: 'Actif',
      maintenance: 'En maintenance',
      immobilized: 'Immobilisé',
      sold: 'Vendu',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const handleCreateNew = () => {
    setSelectedVehicle(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleView = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedVehicle(null);
    fetchVehicles();
  };

  const handleExportCSV = () => {
    const formattedData = filteredVehicles.map(v => ({
      'Immatriculation': v.registration,
      'Modèle': v.brand_model,
      'Type': v.vehicle_type,
      'Capacité (tonnes)': v.capacity_tonnes,
      'Kilométrage': v.current_km,
      'Statut': getStatusLabel(v.status),
      'Assurance expire': v.insurance_expiry ? new Date(v.insurance_expiry).toLocaleDateString('fr-FR') : '-',
      'Contrôle technique expire': v.technical_inspection_expiry ? new Date(v.technical_inspection_expiry).toLocaleDateString('fr-FR') : '-'
    }));
    exportToCSV(formattedData, 'vehicules');
  };

  const handleExportPDF = () => {
    const formattedData = filteredVehicles.map(v => ({
      'Immatriculation': v.registration,
      'Modèle': v.brand_model,
      'Type': v.vehicle_type,
      'Capacité': v.capacity_tonnes + ' T',
      'KM': v.current_km.toLocaleString(),
      'Statut': getStatusLabel(v.status)
    }));
    exportToPDF('Liste des véhicules', formattedData, 'vehicules');
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
          <h1 className="text-3xl font-bold text-slate-900">Parc automobile</h1>
          <p className="text-slate-600 mt-1">Gestion des véhicules et équipements</p>
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
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nouveau véhicule
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par immatriculation ou modèle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Immatriculation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Modèle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Capacité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Kilométrage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleView(vehicle)}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      title="Voir les détails"
                    >
                      {vehicle.registration}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                    {vehicle.brand_model}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700 capitalize">
                    {vehicle.vehicle_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                    {vehicle.capacity_tonnes} T
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                    {vehicle.current_km.toLocaleString()} km
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        vehicle.status
                      )}`}
                    >
                      {getStatusLabel(vehicle.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(vehicle)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(vehicle)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVehicles.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              Aucun véhicule trouvé
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <VehicleModal
          vehicle={selectedVehicle}
          mode={modalMode}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

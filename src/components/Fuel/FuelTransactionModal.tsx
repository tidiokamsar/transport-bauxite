import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Droplet, Truck, Calendar, DollarSign, Gauge, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface FuelTransactionModalProps {
  transaction: any;
  onClose: (saved: boolean) => void;
}

export const FuelTransactionModal = ({ transaction, onClose }: FuelTransactionModalProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    reference: '',
    transaction_type: 'refuel',
    fuel_type_id: '',
    site_id: '',
    station_id: '',
    vehicle_id: '',
    driver_id: '',
    trip_id: '',
    shift_id: '',
    quantity: 0,
    volume_liters: 0,
    unit_price: 12500,
    total_amount: 0,
    total_cost: 0,
    odometer_reading: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    supplier: 'DARI HOLDING',
    invoice_number: '',
    notes: '',
  });

  const [fuelTypes, setFuelTypes] = useState<any[]>([]);
  const [, setSites] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOptions();
    if (transaction) {
      setFormData({
        reference: transaction.reference || '',
        transaction_type: transaction.transaction_type || 'refuel',
        fuel_type_id: transaction.fuel_type_id || '',
        site_id: transaction.site_id || '',
        station_id: transaction.station_id || '',
        vehicle_id: transaction.vehicle_id || '',
        driver_id: transaction.driver_id || '',
        trip_id: transaction.trip_id || '',
        shift_id: transaction.shift_id || '',
        quantity: transaction.quantity || transaction.volume_liters || 0,
        volume_liters: transaction.volume_liters || transaction.quantity || 0,
        unit_price: transaction.unit_price || 12500,
        total_amount: transaction.total_amount || transaction.total_cost || 0,
        total_cost: transaction.total_cost || transaction.total_amount || 0,
        odometer_reading: transaction.odometer_reading || 0,
        transaction_date: transaction.transaction_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        supplier: transaction.supplier || 'DARI HOLDING',
        invoice_number: transaction.invoice_number || '',
        notes: transaction.notes || '',
      });
    }
  }, [transaction]);

  useEffect(() => {
    if (formData.quantity && formData.unit_price) {
      const total = formData.quantity * formData.unit_price;
      setFormData(prev => ({
        ...prev,
        total_amount: total,
        total_cost: total,
        volume_liters: prev.quantity
      }));
    }
  }, [formData.quantity, formData.unit_price]);

  const fetchOptions = async () => {
    const [fuelTypesRes, sitesRes, stationsRes, vehiclesRes, driversRes, shiftsRes] = await Promise.all([
      supabase.from('fuel_types').select('id, name'),
      supabase.from('sites').select('id, name').eq('is_active', true),
      supabase.from('fuel_stations').select('id, name').order('name'),
      supabase.from('vehicles').select('id, registration, brand_model').eq('status', 'active'),
      supabase.from('drivers').select('id, name').eq('status', 'active'),
      supabase.from('work_shifts').select('id, name, display_name').eq('is_active', true).order('shift_order'),
    ]);

    setFuelTypes(fuelTypesRes.data || []);
    setSites(sitesRes.data || []);
    setStations(stationsRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setDrivers(driversRes.data || []);
    setShifts(shiftsRes.data || []);
  };

  const fetchTripsForVehicle = async (vehicleId: string) => {
    if (!vehicleId) {
      setTrips([]);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('trips')
      .select('id, reference, planned_date, shift_id, work_shifts(display_name)')
      .eq('vehicle_id', vehicleId)
      .eq('planned_date', today)
      .in('status', ['planned', 'in_progress'])
      .order('planned_date', { ascending: false })
      .limit(20);

    setTrips(data || []);
  };

  useEffect(() => {
    if (formData.vehicle_id) {
      fetchTripsForVehicle(formData.vehicle_id);
    }
  }, [formData.vehicle_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const dataToSave = {
        reference: formData.reference || `FUEL-${Date.now()}`,
        transaction_type: formData.transaction_type,
        fuel_type_id: formData.fuel_type_id || null,
        site_id: formData.site_id || null,
        station_id: formData.station_id || null,
        vehicle_id: formData.vehicle_id || null,
        driver_id: formData.driver_id || null,
        trip_id: formData.trip_id || null,
        shift_id: formData.shift_id || null,
        volume_liters: formData.quantity,
        quantity: formData.quantity,
        unit_price: formData.unit_price,
        total_cost: formData.total_amount,
        total_amount: formData.total_amount,
        odometer_reading: formData.odometer_reading || null,
        transaction_date: formData.transaction_date,
        supplier: formData.supplier || null,
        invoice_number: formData.invoice_number || null,
        notes: formData.notes || null,
        created_by: user?.id || null,
        entry_method: 'manual',
        is_authorized: true,
        verification_status: 'verified'
      };

      if (transaction?.id) {
        const { error: updateError } = await supabase
          .from('fuel_transactions')
          .update(dataToSave)
          .eq('id', transaction.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('fuel_transactions')
          .insert([dataToSave]);

        if (insertError) throw insertError;
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-2";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 px-6 py-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
              <Droplet className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {transaction ? 'Modifier la transaction' : 'Nouvelle transaction carburant'}
              </h2>
              <p className="text-sm text-blue-100 mt-0.5">
                {transaction ? 'Mettre à jour les informations' : 'Enregistrer un ravitaillement'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[calc(92vh-90px)]">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Informations générales */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Informations générales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date de transaction *
                </label>
                <input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Référence</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className={inputClass}
                  placeholder="Auto-générée si vide"
                />
              </div>

              <div>
                <label className={labelClass}>Type de carburant *</label>
                <select
                  value={formData.fuel_type_id}
                  onChange={(e) => setFormData({ ...formData, fuel_type_id: e.target.value })}
                  className={inputClass}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {fuelTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Station de ravitaillement</label>
                <select
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Sélectionner...</option>
                  {stations.map(station => (
                    <option key={station.id} value={station.id}>{station.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Véhicule et chauffeur */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-600" />
              Véhicule et chauffeur
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Véhicule *</label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className={inputClass}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration} - {vehicle.brand_model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Chauffeur *</label>
                <select
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  className={inputClass}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Quart de travail</label>
                <select
                  value={formData.shift_id}
                  onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Sélectionner...</option>
                  {shifts.map(shift => (
                    <option key={shift.id} value={shift.id}>{shift.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Voyage associé</label>
                <select
                  value={formData.trip_id}
                  onChange={(e) => setFormData({ ...formData, trip_id: e.target.value })}
                  className={inputClass}
                  disabled={!formData.vehicle_id}
                >
                  <option value="">Sélectionner...</option>
                  {trips.map(trip => (
                    <option key={trip.id} value={trip.id}>
                      {trip.reference} - {(trip.work_shifts as any)?.display_name || 'N/A'}
                    </option>
                  ))}
                </select>
                {!formData.vehicle_id && (
                  <p className="text-xs text-gray-500 mt-1">Sélectionnez d'abord un véhicule</p>
                )}
                {formData.vehicle_id && trips.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Aucun voyage actif aujourd'hui</p>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  <Gauge className="w-4 h-4 inline mr-1" />
                  Kilométrage
                </label>
                <input
                  type="number"
                  value={formData.odometer_reading}
                  onChange={(e) => setFormData({ ...formData, odometer_reading: parseInt(e.target.value) })}
                  className={inputClass}
                  placeholder="Ex: 125000"
                />
              </div>

              <div>
                <label className={labelClass}>Fournisseur</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className={inputClass}
                  placeholder="DARI HOLDING"
                />
              </div>
            </div>
          </div>

          {/* Quantité et prix */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Quantité et montant
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>Quantité (litres) *</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  className={inputClass}
                  step="0.1"
                  min="0"
                  placeholder="Ex: 85.5"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Prix unitaire (GNF)</label>
                <input
                  type="number"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })}
                  className={inputClass}
                  min="0"
                  placeholder="12500"
                />
              </div>

              <div>
                <label className={labelClass}>Montant total (GNF)</label>
                <input
                  type="number"
                  value={formData.total_amount}
                  className="w-full px-4 py-3 border-2 border-green-300 bg-green-50 rounded-xl font-bold text-green-700"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Informations complémentaires */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Informations complémentaires
            </h3>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className={labelClass}>Numéro de facture</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: FACT-2025-001234"
                />
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={inputClass}
                  rows={3}
                  placeholder="Observations, remarques..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-all"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  {transaction ? 'Mettre à jour' : 'Enregistrer'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

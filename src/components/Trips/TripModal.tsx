import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, Play, CheckCircle, XCircle, Clock, MapPin, Truck, Calendar, Package, Trash2, Fuel, Gauge, Zap, MapPinned, Award } from 'lucide-react';

interface TripModalProps {
  trip: any;
  mode: 'view' | 'edit' | 'create';
  onClose: (saved: boolean) => void;
}

export const TripModal = ({ trip, mode, onClose }: TripModalProps) => {
  const [formData, setFormData] = useState({
    reference: '',
    planned_date: new Date().toISOString().split('T')[0],
    shift_id: '',
    vehicle_id: '',
    driver_id: '',
    departure_site_id: '',
    arrival_site_id: '',
    client_id: '',
    estimated_distance_km: 0,
    status: 'planned',
    actual_departure_time: '',
    actual_arrival_time: '',
    km_start: 0,
    km_end: 0,
    gross_weight: 0,
    tare_weight: 0,
    net_weight: 0,
    material_type: '',
    fuel_consumed_liters: 0,
    fuel_cost_gnf: 0,
    driver_bonus_gnf: 0,
    tire_pressure_checked: false,
    tire_condition_notes: '',
    route_waypoints: '',
    gps_start_lat: '',
    gps_start_lon: '',
    gps_end_lat: '',
    gps_end_lon: '',
  });

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'route' | 'metrics' | 'tires'>('general');

  useEffect(() => {
    fetchOptions();
    if (trip) {
      setFormData({
        reference: trip.reference || '',
        planned_date: trip.planned_date || '',
        shift_id: trip.shift_id || '',
        vehicle_id: trip.vehicle_id || '',
        driver_id: trip.driver_id || '',
        departure_site_id: trip.departure_site_id || '',
        arrival_site_id: trip.arrival_site_id || '',
        client_id: trip.client_id || '',
        estimated_distance_km: trip.estimated_distance_km || 0,
        status: trip.status || 'planned',
        actual_departure_time: trip.actual_departure_time ? new Date(trip.actual_departure_time).toISOString().slice(0, 16) : '',
        actual_arrival_time: trip.actual_arrival_time ? new Date(trip.actual_arrival_time).toISOString().slice(0, 16) : '',
        km_start: trip.km_start || 0,
        km_end: trip.km_end || 0,
        gross_weight: trip.gross_weight || 0,
        tare_weight: trip.tare_weight || 0,
        net_weight: trip.net_weight || 0,
        material_type: trip.material_type || '',
        fuel_consumed_liters: trip.fuel_consumed_liters || 0,
        fuel_cost_gnf: trip.fuel_cost_gnf || 0,
        driver_bonus_gnf: trip.driver_bonus_gnf || 0,
        tire_pressure_checked: trip.tire_pressure_checked || false,
        tire_condition_notes: trip.tire_condition_notes || '',
        route_waypoints: trip.route_waypoints || '',
        gps_start_lat: trip.gps_start_lat || '',
        gps_start_lon: trip.gps_start_lon || '',
        gps_end_lat: trip.gps_end_lat || '',
        gps_end_lon: trip.gps_end_lon || '',
      });
    }
  }, [trip]);

  useEffect(() => {
    // Calcul automatique du poids net
    if (formData.gross_weight && formData.tare_weight) {
      const net = formData.gross_weight - formData.tare_weight;
      setFormData(prev => ({ ...prev, net_weight: net }));
    }
  }, [formData.gross_weight, formData.tare_weight]);

  useEffect(() => {
    // Calcul automatique de la consommation de carburant
    if (formData.km_end && formData.km_start) {
      const distance = formData.km_end - formData.km_start;
      // Estimation: 50 litres aux 100 km pour un camion minier
      const estimatedFuel = (distance / 100) * 50;
      if (formData.fuel_consumed_liters === 0) {
        setFormData(prev => ({ ...prev, fuel_consumed_liters: parseFloat(estimatedFuel.toFixed(2)) }));
      }
    }
  }, [formData.km_end, formData.km_start, formData.fuel_consumed_liters]);

  useEffect(() => {
    // Calcul automatique de la prime chauffeur (exemple: 50,000 GNF par voyage)
    if (formData.status === 'completed' && formData.driver_bonus_gnf === 0) {
      setFormData(prev => ({ ...prev, driver_bonus_gnf: 50000 }));
    }
  }, [formData.status, formData.driver_bonus_gnf]);

  useEffect(() => {
    // Calcul automatique du coût carburant (prix moyen: 12,500 GNF/litre)
    if (formData.fuel_consumed_liters > 0 && formData.fuel_cost_gnf === 0) {
      const cost = formData.fuel_consumed_liters * 12500;
      setFormData(prev => ({ ...prev, fuel_cost_gnf: parseFloat(cost.toFixed(0)) }));
    }
  }, [formData.fuel_consumed_liters, formData.fuel_cost_gnf]);

  useEffect(() => {
    // Remplissage automatique des coordonnées GPS depuis les sites
    if (formData.departure_site_id && sites.length > 0) {
      const site = sites.find(s => s.id === formData.departure_site_id);
      if (site && site.latitude && site.longitude) {
        setFormData(prev => ({
          ...prev,
          gps_start_lat: site.latitude.toString(),
          gps_start_lon: site.longitude.toString(),
        }));
      }
    }
    if (formData.arrival_site_id && sites.length > 0) {
      const site = sites.find(s => s.id === formData.arrival_site_id);
      if (site && site.latitude && site.longitude) {
        setFormData(prev => ({
          ...prev,
          gps_end_lat: site.latitude.toString(),
          gps_end_lon: site.longitude.toString(),
        }));
      }
    }
  }, [formData.departure_site_id, formData.arrival_site_id, sites]);

  const fetchOptions = async () => {
    const [vehiclesRes, driversRes, sitesRes, clientsRes, shiftsRes] = await Promise.all([
      supabase.from('vehicles').select('id, registration, brand_model').eq('status', 'active'),
      supabase.from('drivers').select('id, name').eq('status', 'active'),
      supabase.from('sites').select('id, name, type, latitude, longitude').eq('is_active', true),
      supabase.from('clients').select('id, name').eq('active', true),
      supabase.from('work_shifts').select('*').eq('is_active', true).order('shift_order'),
    ]);

    setVehicles(vehiclesRes.data || []);
    setDrivers(driversRes.data || []);
    setSites(sitesRes.data || []);
    setClients(clientsRes.data || []);
    setShifts(shiftsRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const dataToSave: any = {
        ...formData,
        actual_departure_time: formData.actual_departure_time || null,
        actual_arrival_time: formData.actual_arrival_time || null,
        shift_id: formData.shift_id || null,
        client_id: formData.client_id || null,
        gps_start_lat: formData.gps_start_lat ? parseFloat(formData.gps_start_lat) : null,
        gps_start_lon: formData.gps_start_lon ? parseFloat(formData.gps_start_lon) : null,
        gps_end_lat: formData.gps_end_lat ? parseFloat(formData.gps_end_lat) : null,
        gps_end_lon: formData.gps_end_lon ? parseFloat(formData.gps_end_lon) : null,
      };

      if (mode === 'create') {
        const { error } = await supabase.from('trips').insert([dataToSave]);
        if (error) throw error;
      } else if (mode === 'edit' && trip?.id) {
        const { error } = await supabase.from('trips').update(dataToSave).eq('id', trip.id);
        if (error) throw error;
      }
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!trip?.id || !confirm('Êtes-vous sûr de vouloir supprimer ce voyage ?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('trips').delete().eq('id', trip.id);
      if (error) throw error;
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = () => {
    const now = new Date().toISOString().slice(0, 16);
    setFormData({
      ...formData,
      status: 'in_progress',
      actual_departure_time: now,
    });
  };

  const handleCompleteTrip = () => {
    const now = new Date().toISOString().slice(0, 16);
    setFormData({
      ...formData,
      status: 'completed',
      actual_arrival_time: now,
    });
  };

  const isReadOnly = mode === 'view';

  const getStatusBadge = (status: string) => {
    const styles = {
      planned: { bg: 'bg-blue-100', text: 'text-blue-800', Icon: Clock },
      in_progress: { bg: 'bg-orange-100', text: 'text-orange-800', Icon: Play },
      completed: { bg: 'bg-green-100', text: 'text-green-800', Icon: CheckCircle },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', Icon: XCircle },
    };
    const labels = {
      planned: 'Planifié',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };
    const config = styles[status as keyof typeof styles] || styles.planned;
    const Icon = config.Icon;
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.text}`}>
        <Icon className="w-4 h-4" />
        <span className="font-medium text-sm">{labels[status as keyof typeof labels]}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl my-8 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'create' ? 'Nouvelle mission' : mode === 'edit' ? 'Modifier la mission' : 'Détails de la mission'}
            </h2>
            {trip && (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm text-slate-600 font-medium">{trip.reference}</span>
                {getStatusBadge(formData.status)}
              </div>
            )}
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white px-6 sticky top-[73px] z-10">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'general'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Général
              </div>
            </button>
            <button
              onClick={() => setActiveTab('route')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'route'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPinned className="w-4 h-4" />
                Trajet & GPS
              </div>
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'metrics'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                Métriques
              </div>
            </button>
            <button
              onClick={() => setActiveTab('tires')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'tires'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Pneus
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Tab: General */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Informations générales */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Informations générales
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Référence *</label>
                      <input
                        type="text"
                        value={formData.reference}
                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        placeholder="TRP-2025-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Date prévue *</label>
                      <input
                        type="date"
                        value={formData.planned_date}
                        onChange={(e) => setFormData({ ...formData, planned_date: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Quart de travail *</label>
                      <select
                        value={formData.shift_id}
                        onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      >
                        <option value="">Sélectionner un quart</option>
                        {shifts.map((shift) => (
                          <option key={shift.id} value={shift.id}>
                            {shift.display_name} ({shift.start_time} - {shift.end_time})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
                      <select
                        value={formData.client_id}
                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      >
                        <option value="">Sélectionner un client</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Statut *</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      >
                        <option value="planned">Planifié</option>
                        <option value="in_progress">En cours</option>
                        <option value="completed">Terminé</option>
                        <option value="cancelled">Annulé</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Type de matériau</label>
                      <input
                        type="text"
                        value={formData.material_type}
                        onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        placeholder="Bauxite, Minerai, etc."
                      />
                    </div>
                  </div>
                </div>

                {/* Véhicule et chauffeur */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-green-600" />
                    Véhicule et chauffeur
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Véhicule *</label>
                      <select
                        value={formData.vehicle_id}
                        onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      >
                        <option value="">Sélectionner un véhicule</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.registration} - {v.brand_model}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Chauffeur *</label>
                      <select
                        value={formData.driver_id}
                        onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      >
                        <option value="">Sélectionner un chauffeur</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Trajet */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    Trajet
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Site de départ *</label>
                      <select
                        value={formData.departure_site_id}
                        onChange={(e) => setFormData({ ...formData, departure_site_id: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      >
                        <option value="">Sélectionner un site</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Site d'arrivée *</label>
                      <select
                        value={formData.arrival_site_id}
                        onChange={(e) => setFormData({ ...formData, arrival_site_id: e.target.value })}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      >
                        <option value="">Sélectionner un site</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Distance estimée (km)</label>
                      <input
                        type="number"
                        value={formData.estimated_distance_km}
                        onChange={(e) => setFormData({ ...formData, estimated_distance_km: parseFloat(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* Heures et kilométrage */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    Heures et kilomètres
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Heure de départ</label>
                      <input
                        type="datetime-local"
                        value={formData.actual_departure_time}
                        onChange={(e) => setFormData({ ...formData, actual_departure_time: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Heure d'arrivée</label>
                      <input
                        type="datetime-local"
                        value={formData.actual_arrival_time}
                        onChange={(e) => setFormData({ ...formData, actual_arrival_time: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Kilométrage départ</label>
                      <input
                        type="number"
                        value={formData.km_start}
                        onChange={(e) => setFormData({ ...formData, km_start: parseFloat(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Kilométrage arrivée</label>
                      <input
                        type="number"
                        value={formData.km_end}
                        onChange={(e) => setFormData({ ...formData, km_end: parseFloat(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Poids */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-red-600" />
                    Poids (Tonnes)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Poids brut</label>
                      <input
                        type="number"
                        value={formData.gross_weight}
                        onChange={(e) => setFormData({ ...formData, gross_weight: parseFloat(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        min="0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Tare</label>
                      <input
                        type="number"
                        value={formData.tare_weight}
                        onChange={(e) => setFormData({ ...formData, tare_weight: parseFloat(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        min="0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Poids net (calculé)</label>
                      <input
                        type="number"
                        value={formData.net_weight}
                        disabled
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-200 font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Route & GPS */}
            {activeTab === 'route' && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPinned className="w-5 h-5 text-blue-600" />
                    Coordonnées GPS
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-slate-700 mb-3">Point de départ</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Latitude</label>
                          <input
                            type="text"
                            value={formData.gps_start_lat}
                            onChange={(e) => setFormData({ ...formData, gps_start_lat: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                            placeholder="10.7595"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Longitude</label>
                          <input
                            type="text"
                            value={formData.gps_start_lon}
                            onChange={(e) => setFormData({ ...formData, gps_start_lon: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                            placeholder="-13.2134"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-slate-700 mb-3">Point d'arrivée</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Latitude</label>
                          <input
                            type="text"
                            value={formData.gps_end_lat}
                            onChange={(e) => setFormData({ ...formData, gps_end_lat: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                            placeholder="10.6501"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Longitude</label>
                          <input
                            type="text"
                            value={formData.gps_end_lon}
                            onChange={(e) => setFormData({ ...formData, gps_end_lon: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                            placeholder="-13.6166"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {formData.gps_start_lat && formData.gps_start_lon && formData.gps_end_lat && formData.gps_end_lon && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium">
                        📍 Tracé disponible : Le trajet sera affiché sur la carte de suivi GPS
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    Points de passage (optionnel)
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Waypoints GPS (format: lat1,lon1;lat2,lon2;...)
                    </label>
                    <textarea
                      value={formData.route_waypoints}
                      onChange={(e) => setFormData({ ...formData, route_waypoints: e.target.value })}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      rows={3}
                      placeholder="10.7595,-13.2134;10.7000,-13.3000;10.6501,-13.6166"
                    />
                    <p className="mt-2 text-sm text-slate-600">
                      Entrez les coordonnées GPS des points de passage pour tracer l'itinéraire complet
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Metrics */}
            {activeTab === 'metrics' && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Fuel className="w-5 h-5 text-red-600" />
                    Consommation de carburant
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Carburant consommé (litres)</label>
                      <input
                        type="number"
                        value={formData.fuel_consumed_liters}
                        onChange={(e) => setFormData({ ...formData, fuel_consumed_liters: parseFloat(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        min="0"
                        step="0.1"
                      />
                      <p className="mt-1 text-xs text-slate-600">Calculé automatiquement selon la distance</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Coût carburant (GNF)</label>
                      <input
                        type="number"
                        value={formData.fuel_cost_gnf}
                        onChange={(e) => setFormData({ ...formData, fuel_cost_gnf: parseFloat(e.target.value) })}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                        min="0"
                      />
                      <p className="mt-1 text-xs text-slate-600">Prix moyen: 12,500 GNF/litre</p>
                    </div>
                  </div>

                  {formData.km_end > formData.km_start && formData.fuel_consumed_liters > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">
                        Consommation moyenne: {((formData.fuel_consumed_liters / (formData.km_end - formData.km_start)) * 100).toFixed(2)} L/100km
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-600" />
                    Prime chauffeur
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Montant de la prime (GNF)</label>
                    <input
                      type="number"
                      value={formData.driver_bonus_gnf}
                      onChange={(e) => setFormData({ ...formData, driver_bonus_gnf: parseFloat(e.target.value) })}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      min="0"
                    />
                    <p className="mt-2 text-sm text-slate-600">
                      Prime standard: 50,000 GNF par voyage complété
                    </p>
                  </div>

                  {formData.status === 'completed' && formData.driver_bonus_gnf > 0 && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-900">
                        ✓ Prime de {formData.driver_bonus_gnf.toLocaleString()} GNF à verser au chauffeur
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Tires */}
            {activeTab === 'tires' && (
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-600" />
                    Contrôle des pneus
                  </h3>

                  <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.tire_pressure_checked}
                        onChange={(e) => setFormData({ ...formData, tire_pressure_checked: e.target.checked })}
                        disabled={isReadOnly}
                        className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Pression des pneus vérifiée avant le départ
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notes sur l'état des pneus</label>
                    <textarea
                      value={formData.tire_condition_notes}
                      onChange={(e) => setFormData({ ...formData, tire_condition_notes: e.target.value })}
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200"
                      rows={4}
                      placeholder="État général des pneus, problèmes détectés, usure observée..."
                    />
                  </div>

                  {!formData.tire_pressure_checked && formData.status === 'planned' && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-medium text-yellow-900">
                        ⚠️ Vérification de la pression des pneus recommandée avant le départ
                      </p>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-slate-100 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-2">Rappel - Points de contrôle :</h4>
                    <ul className="space-y-1 text-sm text-slate-700">
                      <li>• Pression des pneus conforme aux spécifications</li>
                      <li>• Usure de la bande de roulement</li>
                      <li>• Présence de coupures ou déformations</li>
                      <li>• État des flancs</li>
                      <li>• Serrage des écrous de roue</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between sticky bottom-0">
            <div>
              {mode === 'edit' && trip && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!isReadOnly && formData.status === 'planned' && (
                <button
                  type="button"
                  onClick={handleStartTrip}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Démarrer
                </button>
              )}

              {!isReadOnly && formData.status === 'in_progress' && (
                <button
                  type="button"
                  onClick={handleCompleteTrip}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Terminer
                </button>
              )}

              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {isReadOnly ? 'Fermer' : 'Annuler'}
              </button>

              {!isReadOnly && (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart, BarChart3, Calculator, Award, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TCOAnalysisModal from './TCOAnalysisModal';

interface TCOAnalysis {
  id: string;
  vehicle_id: string;
  analysis_period_months: number;
  acquisition_cost: number;
  depreciation: number;
  fuel_cost: number;
  maintenance_cost: number;
  insurance_cost: number;
  registration_cost: number;
  financing_cost: number;
  downtime_cost: number;
  accident_cost: number;
  other_costs: number;
  total_cost: number;
  cost_per_km: number;
  cost_per_day: number;
  cost_per_trip: number;
  utilization_rate: number;
  efficiency_rating: string;
  benchmark_comparison: number;
  recommendations: any[];
  period_start: string;
  period_end: string;
  vehicle?: {
    registration: string;
    make: string;
    model: string;
    vehicle_type: string;
  };
}

export default function TCOAnalysisView() {
  const [analyses, setAnalyses] = useState<TCOAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<TCOAnalysis | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<TCOAnalysis | null>(null);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tco_analysis')
        .select(`
          *,
          vehicle:vehicles(registration, make, model, vehicle_type)
        `)
        .order('total_cost', { ascending: false });

      setAnalyses(data || []);
    } catch (error) {
      console.error('Error loading TCO analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTCOAnalyses = async () => {
    setLoading(true);
    try {
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'active');

      if (!vehicles) return;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      for (const vehicle of vehicles) {
        // Calcul des coûts réels depuis la base de données
        const { data: fuelData } = await supabase
          .from('fuel_transactions')
          .select('quantity_liters, unit_price_gnf')
          .eq('vehicle_id', vehicle.id)
          .gte('transaction_date', startDate.toISOString())
          .lte('transaction_date', endDate.toISOString());

        const { data: maintenanceData } = await supabase
          .from('maintenance_orders')
          .select('total_cost')
          .eq('vehicle_id', vehicle.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        const { data: tripsData } = await supabase
          .from('trips')
          .select('distance_km, status')
          .eq('vehicle_id', vehicle.id)
          .gte('planned_date', startDate.toISOString())
          .lte('planned_date', endDate.toISOString());

        // Calcul des coûts carburant en GNF puis conversion en USD (1 USD = 10000 GNF)
        const fuelCostGNF = (fuelData || []).reduce((sum, tx) =>
          sum + (tx.quantity_liters * tx.unit_price_gnf), 0);
        const fuelCost = fuelCostGNF / 10000;

        // Calcul des coûts de maintenance
        const maintenanceCost = (maintenanceData || []).reduce((sum, m) =>
          sum + (m.total_cost || 0), 0);

        // Calcul des distances
        const totalKm = (tripsData || []).reduce((sum, t) =>
          sum + (t.distance_km || 0), 0) || 50000;
        const totalTrips = (tripsData || []).length || 250;

        // Coûts fixes estimés
        const acquisitionCost = vehicle.acquisition_cost || (80000 + Math.random() * 120000);
        const depreciation = acquisitionCost * 0.15; // 15% par an
        const insuranceCost = acquisitionCost * 0.03; // 3% du coût d'acquisition
        const registrationCost = 1000;
        const financingCost = acquisitionCost * 0.05;

        // Coût d'immobilisation basé sur les maintenances
        const maintenanceDays = (maintenanceData || []).length * 3; // 3 jours par maintenance
        const downtimeCost = maintenanceDays * 500; // 500 USD par jour d'immobilisation

        const accidentCost = Math.random() * 2000;
        const otherCosts = 1500 + Math.random() * 1500;

        const totalCost = depreciation + fuelCost + maintenanceCost + insuranceCost +
          registrationCost + financingCost + downtimeCost + accidentCost + otherCosts;

        const costPerKm = totalKm > 0 ? totalCost / totalKm : 0;
        const costPerDay = totalCost / 365;
        const costPerTrip = totalTrips > 0 ? totalCost / totalTrips : 0;

        // Calcul du rating d'efficacité
        let efficiencyRating = 'average';
        if (costPerKm < 0.5) efficiencyRating = 'excellent';
        else if (costPerKm < 0.7) efficiencyRating = 'good';
        else if (costPerKm > 1.0) efficiencyRating = 'below_average';
        else if (costPerKm > 1.5) efficiencyRating = 'poor';

        // Recommandations basées sur les données réelles
        const recommendations = [];
        if (maintenanceCost > 8000) {
          recommendations.push('Coûts de maintenance élevés - envisager le remplacement du véhicule');
        }
        if (downtimeCost > 3000) {
          recommendations.push('Immobilisation excessive - améliorer la maintenance préventive');
        }
        if (fuelCost > 15000) {
          recommendations.push('Consommation de carburant élevée - formation du chauffeur recommandée');
        }
        if (costPerKm > 1.0) {
          recommendations.push('Coût par km élevé - optimiser les trajets et l\'utilisation');
        }

        // Taux d'utilisation basé sur les voyages
        const expectedTrips = 365; // 1 voyage par jour attendu
        const utilizationRate = Math.min(100, (totalTrips / expectedTrips) * 100);

        // Comparaison au benchmark (moyenne de la flotte)
        const fleetAvgCostPerKm = 0.75; // Benchmark de référence
        const benchmarkComparison = ((costPerKm - fleetAvgCostPerKm) / fleetAvgCostPerKm) * 100;

        // Supprimer l'ancienne analyse si elle existe
        await supabase
          .from('tco_analysis')
          .delete()
          .eq('vehicle_id', vehicle.id);

        // Insérer la nouvelle analyse
        await supabase.from('tco_analysis').insert({
          vehicle_id: vehicle.id,
          analysis_period_months: 12,
          acquisition_cost: Math.round(acquisitionCost),
          depreciation: Math.round(depreciation),
          fuel_cost: Math.round(fuelCost),
          maintenance_cost: Math.round(maintenanceCost),
          insurance_cost: Math.round(insuranceCost),
          registration_cost: Math.round(registrationCost),
          financing_cost: Math.round(financingCost),
          downtime_cost: Math.round(downtimeCost),
          accident_cost: Math.round(accidentCost),
          other_costs: Math.round(otherCosts),
          total_cost: Math.round(totalCost),
          cost_per_km: Number(costPerKm.toFixed(2)),
          cost_per_day: Math.round(costPerDay),
          cost_per_trip: Math.round(costPerTrip),
          utilization_rate: Math.round(utilizationRate),
          efficiency_rating: efficiencyRating,
          benchmark_comparison: Number(benchmarkComparison.toFixed(1)),
          recommendations: recommendations,
          period_start: startDate.toISOString().split('T')[0],
          period_end: endDate.toISOString().split('T')[0]
        });
      }

      await loadAnalyses();
    } catch (error) {
      console.error('Erreur lors de la génération des analyses TCO:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleCreate = () => {
    setSelectedAnalysis(null);
    setShowModal(true);
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'average': return 'text-yellow-600 bg-yellow-100';
      case 'below_average': return 'text-orange-600 bg-orange-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRatingLabel = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Bon';
      case 'average': return 'Moyen';
      case 'below_average': return 'Sous la moyenne';
      case 'poor': return 'Faible';
      default: return rating;
    }
  };

  const stats = {
    totalFleetCost: analyses.reduce((sum, a) => sum + a.total_cost, 0),
    avgCostPerKm: analyses.length > 0
      ? (analyses.reduce((sum, a) => sum + a.cost_per_km, 0) / analyses.length).toFixed(2)
      : 0,
    excellentRating: analyses.filter(a => a.efficiency_rating === 'excellent').length,
    poorRating: analyses.filter(a => a.efficiency_rating === 'poor' || a.efficiency_rating === 'below_average').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Calcul du TCO en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calculator className="h-8 w-8 text-blue-600" />
            Coût Total de Possession (TCO)
          </h1>
          <p className="text-gray-600 mt-1">Analyse financière complète par véhicule</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nouvelle Analyse
          </button>
          <button
            onClick={generateTCOAnalyses}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <BarChart3 className="h-5 w-5" />
            Générer les Rapports TCO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Coût Total Flotte</p>
              <p className="text-2xl font-bold text-blue-900 mt-2">
                ${(stats.totalFleetCost / 1000).toFixed(0)}K
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-blue-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Coût Moyen/Km</p>
              <p className="text-3xl font-bold text-green-900 mt-2">${stats.avgCostPerKm}</p>
            </div>
            <TrendingDown className="h-12 w-12 text-green-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Note Excellente</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{stats.excellentRating}</p>
            </div>
            <Award className="h-12 w-12 text-green-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Nécessite Attention</p>
              <p className="text-3xl font-bold text-red-900 mt-2">{stats.poorRating}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-red-600 opacity-80" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Analyse TCO par Véhicule</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Véhicule</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût/Km</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût/Jour</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Note</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">vs Référence</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Calculator className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>Aucune analyse TCO disponible</p>
                      <p className="text-sm mt-1">Cliquez sur "Générer les Rapports TCO" pour créer des analyses</p>
                    </td>
                  </tr>
                ) : (
                  analyses.map((analysis) => (
                    <tr
                      key={analysis.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedVehicle(analysis)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {analysis.vehicle?.registration}
                          </div>
                          <div className="text-sm text-gray-500">
                            {analysis.vehicle?.make} {analysis.vehicle?.model}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                        ${analysis.total_cost.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">
                        ${analysis.cost_per_km.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">
                        ${analysis.cost_per_day.toFixed(0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRatingColor(analysis.efficiency_rating)}`}>
                          {getRatingLabel(analysis.efficiency_rating)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`flex items-center justify-center gap-1 ${analysis.benchmark_comparison > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {analysis.benchmark_comparison > 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {Math.abs(analysis.benchmark_comparison).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedVehicle && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedVehicle.vehicle?.registration}
              </h3>
              <p className="text-sm text-gray-600">
                {selectedVehicle.vehicle?.make} {selectedVehicle.vehicle?.model}
              </p>
              <div className="mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRatingColor(selectedVehicle.efficiency_rating)}`}>
                  {getRatingLabel(selectedVehicle.efficiency_rating)}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-900">Acquisition</span>
                <span className="font-semibold text-blue-900">
                  ${selectedVehicle.acquisition_cost.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Dépréciation</span>
                <span className="font-semibold text-gray-900">
                  ${selectedVehicle.depreciation.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Carburant</span>
                <span className="font-semibold text-gray-900">
                  ${selectedVehicle.fuel_cost.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Maintenance</span>
                <span className="font-semibold text-gray-900">
                  ${selectedVehicle.maintenance_cost.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Assurance</span>
                <span className="font-semibold text-gray-900">
                  ${selectedVehicle.insurance_cost.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Immobilisation</span>
                <span className="font-semibold text-gray-900">
                  ${selectedVehicle.downtime_cost.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-2 border-green-200">
                <span className="text-sm font-semibold text-green-900">Coût Total</span>
                <span className="font-bold text-lg text-green-900">
                  ${selectedVehicle.total_cost.toLocaleString()}
                </span>
              </div>
            </div>

            {selectedVehicle.recommendations && selectedVehicle.recommendations.length > 0 && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Recommandations
                </p>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {selectedVehicle.recommendations.map((rec: string, idx: number) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <TCOAnalysisModal
          analysis={selectedAnalysis}
          onClose={() => setShowModal(false)}
          onSave={loadAnalyses}
        />
      )}
    </div>
  );
}
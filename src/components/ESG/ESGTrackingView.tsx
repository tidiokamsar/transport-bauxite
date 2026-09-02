import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Leaf, TrendingDown, Droplet, Wind, Recycle, AlertTriangle,
  BarChart3, Award, Target, RefreshCw
} from 'lucide-react';

export const ESGTrackingView = () => {
  const [stats, setStats] = useState({
    totalCO2: 0,
    co2PerTonneKm: 0,
    fuelEfficiency: 0,
    ecoScore: 0,
    incidents: 0,
    wasteRecycled: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchESGStats();
  }, []);

  const fetchESGStats = async () => {
    try {
      setLoading(true);

      const [emissionsRes, kpisRes, incidentsRes, wasteRes] = await Promise.all([
        supabase.from('carbon_emissions').select('*'),
        supabase.from('sustainability_kpis').select('*').order('kpi_date', { ascending: false }).limit(1),
        supabase.from('environmental_incidents').select('*').eq('status', 'open'),
        supabase.from('waste_management').select('*'),
      ]);

      const emissions = emissionsRes.data || [];
      const latestKPI = kpisRes.data?.[0];
      const incidents = incidentsRes.data || [];
      const waste = wasteRes.data || [];

      setStats({
        totalCO2: emissions.reduce((sum, e) => sum + (e.co2_emissions_kg || 0), 0),
        co2PerTonneKm: latestKPI?.co2_per_tonne_km || 0,
        fuelEfficiency: latestKPI?.fuel_efficiency_l_per_100km || 0,
        ecoScore: latestKPI?.eco_driving_avg_score || 0,
        incidents: incidents.length,
        wasteRecycled: waste.filter(w => w.disposal_method === 'recycling').length,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">ESG & Durabilité</h1>
          <p className="text-slate-600 mt-1">Environnement, Social et Gouvernance</p>
        </div>
        <button
          onClick={fetchESGStats}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-green-100">Émissions CO₂</p>
            <Wind className="w-8 h-8 text-green-300" />
          </div>
          <p className="text-3xl font-bold">{(stats.totalCO2 / 1000).toFixed(1)}</p>
          <p className="text-xs text-green-200 mt-1">tonnes ce mois</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-blue-100">CO₂/tonne-km</p>
            <TrendingDown className="w-8 h-8 text-blue-300" />
          </div>
          <p className="text-3xl font-bold">{stats.co2PerTonneKm.toFixed(4)}</p>
          <p className="text-xs text-blue-200 mt-1">kg CO₂</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-amber-100">Éco-conduite</p>
            <Award className="w-8 h-8 text-amber-300" />
          </div>
          <p className="text-3xl font-bold">{(stats.ecoScore * 100).toFixed(0)}%</p>
          <p className="text-xs text-amber-200 mt-1">score moyen</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-teal-100">Recyclage</p>
            <Recycle className="w-8 h-8 text-teal-300" />
          </div>
          <p className="text-3xl font-bold">{stats.wasteRecycled}</p>
          <p className="text-xs text-teal-200 mt-1">lots recyclés</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-600" />
            Impact Environnemental
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Efficacité carburant</p>
                <p className="text-xs text-slate-500 mt-1">Consommation moyenne</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{stats.fuelEfficiency.toFixed(1)}</p>
                <p className="text-xs text-slate-600">L/100km</p>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Empreinte carbone</p>
                <p className="text-xs text-slate-500 mt-1">Total mensuel</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">{(stats.totalCO2 / 1000).toFixed(2)}</p>
                <p className="text-xs text-slate-600">tonnes CO₂</p>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div>
                <p className="text-sm font-medium text-slate-900">Objectif mensuel</p>
                <p className="text-xs text-slate-600 mt-1">Réduction 15%</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '65%' }}></div>
                </div>
                <span className="text-sm font-semibold text-green-600">65%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Objectifs RSE
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-900">Réduction émissions</p>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                  En cours
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '72%' }}></div>
                </div>
                <span className="text-sm font-semibold text-blue-600">72%</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">Objectif 2025: -20%</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-900">Formation éco-conduite</p>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  Atteint
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '100%' }}></div>
                </div>
                <span className="text-sm font-semibold text-green-600">100%</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">45/45 chauffeurs formés</p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-900">Recyclage déchets</p>
                <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  Progrès
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: '58%' }}></div>
                </div>
                <span className="text-sm font-semibold text-amber-600">58%</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">Objectif: 80% recyclé</p>
            </div>
          </div>
        </div>
      </div>

      {stats.incidents > 0 && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Incidents environnementaux ouverts
              </h3>
              <p className="text-sm text-slate-700 mb-4">
                {stats.incidents} incident{stats.incidents > 1 ? 's' : ''} nécessite{stats.incidents > 1 ? 'nt' : ''} votre attention
              </p>
              <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                Voir les incidents
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-6 hover:border-slate-900 hover:shadow-lg transition-all text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Rapport ESG mensuel</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Générer le rapport complet environnemental
          </p>
          <span className="text-sm font-medium text-green-600">Générer PDF →</span>
        </button>

        <button className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-6 hover:border-slate-900 hover:shadow-lg transition-all text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Droplet className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Bilan carbone</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Analyse détaillée des émissions par véhicule
          </p>
          <span className="text-sm font-medium text-blue-600">Consulter →</span>
        </button>

        <button className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-6 hover:border-slate-900 hover:shadow-lg transition-all text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-teal-50 rounded-lg">
              <Recycle className="w-6 h-6 text-teal-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Gestion déchets</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Suivi recyclage pneus et huiles usagées
          </p>
          <span className="text-sm font-medium text-teal-600">Gérer →</span>
        </button>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Package, Truck, FileText, DollarSign, MessageSquare, BarChart3,
  Clock, MapPin, CheckCircle, AlertCircle, Download, Eye
} from 'lucide-react';

export const ClientPortalView = () => {
  const [stats, setStats] = useState({
    activeShipments: 0,
    completedShipments: 0,
    pendingInvoices: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientStats();
  }, []);

  const fetchClientStats = async () => {
    try {
      setLoading(true);

      const [tripsRes, invoicesRes] = await Promise.all([
        supabase.from('trips').select('*'),
        supabase.from('invoices').select('*'),
      ]);

      const trips = tripsRes.data || [];
      const invoices = invoicesRes.data || [];

      setStats({
        activeShipments: trips.filter(t => t.status === 'in_progress').length,
        completedShipments: trips.filter(t => t.status === 'completed').length,
        pendingInvoices: invoices.filter(i => i.status !== 'paid').length,
        totalSpent: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Portail Client</h1>
        <p className="text-slate-600 mt-1">Suivi de vos expéditions et services en temps réel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-blue-100">Expéditions actives</p>
            <Truck className="w-8 h-8 text-blue-300" />
          </div>
          <p className="text-3xl font-bold">{stats.activeShipments}</p>
          <p className="text-xs text-blue-200 mt-1">en cours de livraison</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-green-100">Livrées</p>
            <CheckCircle className="w-8 h-8 text-green-300" />
          </div>
          <p className="text-3xl font-bold">{stats.completedShipments}</p>
          <p className="text-xs text-green-200 mt-1">ce mois</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-orange-100">Factures en attente</p>
            <FileText className="w-8 h-8 text-orange-300" />
          </div>
          <p className="text-3xl font-bold">{stats.pendingInvoices}</p>
          <p className="text-xs text-orange-200 mt-1">à régler</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-purple-100">Total dépensé</p>
            <DollarSign className="w-8 h-8 text-purple-300" />
          </div>
          <p className="text-3xl font-bold">{(stats.totalSpent / 1000000).toFixed(1)}M</p>
          <p className="text-xs text-purple-200 mt-1">GNF</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Expéditions en cours</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Voir tout
            </button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-900">Expédition #{1000 + i}</p>
                      <p className="text-sm text-slate-600 mt-1">Bauxite - 35 tonnes</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      En transit
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span>Mine Sangarédi → Port Kamsar</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                    <Clock className="w-4 h-4" />
                    <span>Arrivée estimée: 14:30</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Factures récentes</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Voir tout
            </button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Facture #{2000 + i}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {new Date(2025, 0, 20 - i).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{(5.5 + i * 0.5).toFixed(1)}M GNF</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                    i === 1 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {i === 1 ? 'Payée' : 'En attente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-6 hover:border-slate-900 hover:shadow-lg transition-all text-left group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Suivi GPS en direct</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Localisez vos expéditions en temps réel sur la carte
          </p>
          <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
            Ouvrir la carte →
          </span>
        </button>

        <button className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-6 hover:border-slate-900 hover:shadow-lg transition-all text-left group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Rapport ESG</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Consultez l'impact environnemental de vos transports
          </p>
          <span className="text-sm font-medium text-green-600 group-hover:text-green-700">
            Voir le rapport →
          </span>
        </button>

        <button className="bg-white rounded-xl shadow-sm border-2 border-slate-200 p-6 hover:border-slate-900 hover:shadow-lg transition-all text-left group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Support client</h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Contactez notre équipe pour toute question
          </p>
          <span className="text-sm font-medium text-purple-600 group-hover:text-purple-700">
            Contacter →
          </span>
        </button>
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Download className="w-6 h-6 text-slate-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Documents disponibles</h3>
            <p className="text-sm text-slate-600 mb-4">
              Téléchargez vos factures, bons de livraison et certificats
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
                Factures (3)
              </button>
              <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
                Bons de livraison (5)
              </button>
              <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors">
                Certificats (2)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

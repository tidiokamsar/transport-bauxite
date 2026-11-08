import React, { useState } from 'react';
import { Zap, Plus, FileText, Calendar, AlertTriangle, DollarSign, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/*
 * Actions rapides (Vague D, decision D-004).
 * Les anciennes actions ecrivaient des donnees inventees (depense de 100 sur
 * le premier vehicule, voyage et maintenance affectes d'office au premier
 * vehicule et chauffeur, rapport et rafraichissement simules, temps
 * d'execution aleatoire). Elles sont remplacees par des raccourcis vers le
 * module concerne, ou la saisie reste faite par l'utilisateur (CDC 11.5).
 * Seule la consultation des chauffeurs actifs s'execute ici ; sa duree
 * journalisee est mesuree.
 */

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  action: () => void | Promise<void>;
}

interface QuickActionsPanelProps {
  onNavigate?: (view: string) => void;
}

export default function QuickActionsPanel({ onNavigate }: QuickActionsPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const logAction = async (
    actionType: string,
    actionName: string,
    status: 'success' | 'failed',
    executionTimeMs: number,
    error?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('quick_actions_log').insert({
      user_id: user.id,
      action_type: actionType,
      action_name: actionName,
      execution_time_ms: executionTimeMs,
      status,
      error_message: error
    });
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const raccourci = (
    id: string,
    icon: React.ReactNode,
    label: string,
    description: string,
    color: string,
    view: string
  ): QuickAction => ({ id, icon, label, description, color, action: () => onNavigate?.(view) });

  const quickActions: QuickAction[] = [
    raccourci('add-trip', <Plus className="h-6 w-6" />, 'Nouveau voyage',
      'Ouvrir le module Voyages', 'bg-blue-500 hover:bg-blue-600', 'trips'),
    raccourci('reports', <FileText className="h-6 w-6" />, 'Rapports',
      'Ouvrir le module Rapports', 'bg-green-500 hover:bg-green-600', 'reports'),
    raccourci('schedule-maintenance', <Calendar className="h-6 w-6" />, 'Planifier une maintenance',
      'Ouvrir le module Maintenance', 'bg-yellow-500 hover:bg-yellow-600', 'maintenance'),
    raccourci('alerts', <AlertTriangle className="h-6 w-6" />, 'Alertes',
      'Ouvrir le module Alertes', 'bg-red-500 hover:bg-red-600', 'alerts'),
    raccourci('add-expense', <DollarSign className="h-6 w-6" />, 'Saisir un coût',
      'Ouvrir le module Coûts', 'bg-purple-500 hover:bg-purple-600', 'costs'),
    {
      id: 'driver-status',
      icon: <Users className="h-6 w-6" />,
      label: 'Chauffeurs actifs',
      description: 'Compter les chauffeurs au statut actif',
      color: 'bg-indigo-500 hover:bg-indigo-600',
      action: async () => {
        setLoading('driver-status');
        const debut = performance.now();
        const { count, error } = await supabase
          .from('drivers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active');
        const duree = Math.round(performance.now() - debut);

        if (error) {
          await logAction('check', 'Driver Status', 'failed', duree, error.message);
          showMessage('error', 'Impossible de lire le statut des chauffeurs');
        } else {
          await logAction('check', 'Driver Status', 'success', duree);
          showMessage('success', `${count ?? 0} chauffeur(s) au statut actif`);
        }
        setLoading(null);
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Zap className="h-7 w-7 text-yellow-500" />
          Actions rapides
        </h2>
        <p className="text-gray-600 mt-1">Raccourcis vers les modules les plus utilisés</p>
      </div>

      {message && (
        <div
          role="status"
          className={`p-4 rounded-lg border-2 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={action.action}
            disabled={loading === action.id}
            className={`${action.color} text-white p-6 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-3">
                {loading === action.id ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                ) : (
                  action.icon
                )}
              </div>
              <div className="font-bold text-lg mb-1">{action.label}</div>
              <div className="text-sm opacity-90">{action.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

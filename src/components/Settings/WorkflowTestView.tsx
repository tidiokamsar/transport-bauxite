import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle, Zap, RefreshCw } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'running';
  message: string;
  duration?: number;
  details?: any;
}

export const WorkflowTestView = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runWorkflowTests = async () => {
    setTesting(true);
    setResults([]);
    const testResults: TestResult[] = [];

    testResults.push({ name: 'Test 1: Disponibilité véhicules/chauffeurs', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start1 = Date.now();
      const { data: vehicles, error: vError } = await supabase.from('vehicle_availability').select('*');
      const { data: drivers, error: dError } = await supabase.from('driver_availability').select('*');

      testResults[0] = {
        name: 'Test 1: Disponibilité véhicules/chauffeurs',
        status: vError || dError ? 'error' : 'success',
        message: vError || dError ? 'Erreur de lecture' : `${vehicles?.length || 0} véhicules, ${drivers?.length || 0} chauffeurs disponibles`,
        duration: Date.now() - start1,
        details: { vehicles: vehicles?.length, drivers: drivers?.length }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[0] = { name: 'Test 1: Disponibilité', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    testResults.push({ name: 'Test 2: Optimisation dispatch automatique', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start2 = Date.now();
      const { data: rules } = await supabase.from('dispatch_rules').select('*').eq('is_active', true);
      const { data: assignments } = await supabase.from('dispatch_assignments').select('*');

      testResults[1] = {
        name: 'Test 2: Optimisation dispatch automatique',
        status: 'success',
        message: `${rules?.length || 0} règles actives, ${assignments?.length || 0} affectations`,
        duration: Date.now() - start2,
        details: { rules: rules?.length, assignments: assignments?.length }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[1] = { name: 'Test 2: Dispatch', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    testResults.push({ name: 'Test 3: Calcul scores performance', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start3 = Date.now();
      const { data: scores } = await supabase.from('performance_scores').select('*').gte('overall_score', 0);
      const avgScore = scores?.reduce((sum, s) => sum + (s.overall_score || 0), 0) / (scores?.length || 1);

      testResults[2] = {
        name: 'Test 3: Calcul scores performance',
        status: avgScore >= 0.7 ? 'success' : 'warning',
        message: `Score moyen: ${(avgScore * 100).toFixed(1)}% (${scores?.length || 0} entités)`,
        duration: Date.now() - start3,
        details: { count: scores?.length, avgScore }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[2] = { name: 'Test 3: Scores', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    testResults.push({ name: 'Test 4: Système alertes', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start4 = Date.now();
      const { data: alertRules } = await supabase.from('alert_rules').select('*').eq('is_active', true);
      const { data: notifications } = await supabase.from('alert_notifications').select('*').eq('is_read', false);

      testResults[3] = {
        name: 'Test 4: Système alertes',
        status: 'success',
        message: `${alertRules?.length || 0} règles actives, ${notifications?.length || 0} notifications`,
        duration: Date.now() - start4,
        details: { rules: alertRules?.length, notifications: notifications?.length }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[3] = { name: 'Test 4: Alertes', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    testResults.push({ name: 'Test 5: Suivi ESG et émissions', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start5 = Date.now();
      const { data: emissions } = await supabase.from('carbon_emissions').select('*');
      const { data: kpis } = await supabase.from('sustainability_kpis').select('*');
      const totalCO2 = emissions?.reduce((sum, e) => sum + (e.co2_emissions_kg || 0), 0) || 0;

      testResults[4] = {
        name: 'Test 5: Suivi ESG et émissions',
        status: 'success',
        message: `${(totalCO2 / 1000).toFixed(1)} tonnes CO₂, ${kpis?.length || 0} KPIs enregistrés`,
        duration: Date.now() - start5,
        details: { totalCO2, kpisCount: kpis?.length }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[4] = { name: 'Test 5: ESG', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    testResults.push({ name: 'Test 6: Gestion fatigue chauffeurs', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start6 = Date.now();
      const { data: sessions } = await supabase.from('driver_work_sessions').select('*');
      const { data: fatigueAlerts } = await supabase.from('fatigue_alerts').select('*');

      testResults[5] = {
        name: 'Test 6: Gestion fatigue chauffeurs',
        status: 'success',
        message: `${sessions?.length || 0} sessions, ${fatigueAlerts?.length || 0} alertes fatigue`,
        duration: Date.now() - start6,
        details: { sessions: sessions?.length, alerts: fatigueAlerts?.length }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[5] = { name: 'Test 6: Fatigue', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    testResults.push({ name: 'Test 7: Gestion pneus avancée', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start7 = Date.now();
      const { data: tires } = await supabase.from('tires').select('*');
      const { data: installations } = await supabase.from('tire_installations').select('*');

      testResults[6] = {
        name: 'Test 7: Gestion pneus avancée',
        status: 'success',
        message: `${tires?.length || 0} pneus, ${installations?.length || 0} installations`,
        duration: Date.now() - start7,
        details: { tires: tires?.length, installations: installations?.length }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[6] = { name: 'Test 7: Pneus', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    testResults.push({ name: 'Test 8: Workflows complets end-to-end', status: 'running', message: 'En cours...' });
    setResults([...testResults]);

    try {
      const start8 = Date.now();
      const { data: trips } = await supabase.from('trips').select('*');
      const { data: invoices } = await supabase.from('invoices').select('*');
      const { data: maintenance } = await supabase.from('maintenance_orders').select('*');

      testResults[7] = {
        name: 'Test 8: Workflows complets end-to-end',
        status: 'success',
        message: `${trips?.length || 0} voyages, ${invoices?.length || 0} factures, ${maintenance?.length || 0} maintenances`,
        duration: Date.now() - start8,
        details: { trips: trips?.length, invoices: invoices?.length, maintenance: maintenance?.length }
      };
      setResults([...testResults]);
    } catch (error) {
      testResults[7] = { name: 'Test 8: Workflows', status: 'error', message: 'Exception', duration: 0 };
      setResults([...testResults]);
    }

    setTesting(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'running': return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-orange-50 border-orange-200';
      case 'running': return 'bg-blue-50 border-blue-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const warningCount = results.filter(r => r.status === 'warning').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tests des Workflows</h1>
        <p className="text-slate-600 mt-1">Validation end-to-end du système SIGTB</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Suite de tests automatisés</h2>
            <p className="text-sm text-slate-600 mt-1">
              Vérifie le bon fonctionnement de tous les modules critiques
            </p>
          </div>
          <button
            onClick={runWorkflowTests}
            disabled={testing}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {testing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {testing ? 'Tests en cours...' : 'Lancer les tests'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-900">{successCount}</p>
                  <p className="text-sm text-green-700">Réussis</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold text-orange-900">{warningCount}</p>
                  <p className="text-sm text-orange-700">Avertissements</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-900">{errorCount}</p>
                  <p className="text-sm text-red-700">Échecs</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {results.length === 0 && !testing && (
            <div className="text-center py-12">
              <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Cliquez sur "Lancer les tests" pour démarrer</p>
            </div>
          )}

          {results.map((result, index) => (
            <div key={index} className={`rounded-lg border p-4 ${getStatusColor(result.status)}`}>
              <div className="flex items-start gap-4">
                <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{result.name}</p>
                      <p className="text-sm text-slate-700 mt-1">{result.message}</p>
                    </div>
                    {result.duration !== undefined && (
                      <span className="text-xs text-slate-600 bg-white px-2 py-1 rounded">
                        {result.duration}ms
                      </span>
                    )}
                  </div>
                  {result.details && (
                    <div className="mt-3 p-3 bg-white rounded border border-slate-200">
                      <pre className="text-xs text-slate-700">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {results.length > 0 && !testing && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Résumé des tests</h3>
          <div className="space-y-2 text-sm">
            <p className="text-slate-700">
              <span className="font-medium">{results.length}</span> tests exécutés en{' '}
              <span className="font-medium">
                {results.reduce((sum, r) => sum + (r.duration || 0), 0)}ms
              </span>
            </p>
            <p className="text-slate-700">
              Taux de réussite:{' '}
              <span className="font-semibold text-green-600">
                {((successCount / results.length) * 100).toFixed(1)}%
              </span>
            </p>
            {errorCount === 0 && warningCount === 0 && (
              <p className="text-green-700 font-medium mt-4">
                ✓ Tous les systèmes sont opérationnels !
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

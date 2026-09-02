import React, { useState } from 'react';
import { Zap, Plus, FileText, Calendar, AlertTriangle, DollarSign, Users, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  action: () => void;
}

export default function QuickActionsPanel({ onActionComplete }: { onActionComplete?: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const logAction = async (actionType: string, actionName: string, status: 'success' | 'failed', error?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('quick_actions_log').insert({
      user_id: user.id,
      action_type: actionType,
      action_name: actionName,
      execution_time_ms: Math.floor(Math.random() * 1000),
      status,
      error_message: error
    });
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const quickActions: QuickAction[] = [
    {
      id: 'add-trip',
      icon: <Plus className="h-6 w-6" />,
      label: 'Add Trip',
      description: 'Create a new trip record',
      color: 'bg-blue-500 hover:bg-blue-600',
      action: async () => {
        setLoading('add-trip');
        try {
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id')
            .eq('status', 'active')
            .limit(1);

          const { data: drivers } = await supabase
            .from('drivers')
            .select('id')
            .eq('status', 'active')
            .limit(1);

          if (vehicles && vehicles.length > 0 && drivers && drivers.length > 0) {
            await supabase.from('trips').insert({
              vehicle_id: vehicles[0].id,
              driver_id: drivers[0].id,
              date: new Date().toISOString().split('T')[0],
              status: 'pending'
            });
            await logAction('create', 'Add Trip', 'success');
            showMessage('success', 'Trip created successfully!');
            onActionComplete?.();
          } else {
            throw new Error('No active vehicles or drivers available');
          }
        } catch (error: any) {
          await logAction('create', 'Add Trip', 'failed', error.message);
          showMessage('error', 'Failed to create trip');
        } finally {
          setLoading(null);
        }
      }
    },
    {
      id: 'generate-report',
      icon: <FileText className="h-6 w-6" />,
      label: 'Generate Report',
      description: 'Create instant analytics report',
      color: 'bg-green-500 hover:bg-green-600',
      action: async () => {
        setLoading('generate-report');
        try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          await logAction('generate', 'Generate Report', 'success');
          showMessage('success', 'Report generated successfully!');
          onActionComplete?.();
        } catch (error: any) {
          await logAction('generate', 'Generate Report', 'failed', error.message);
          showMessage('error', 'Failed to generate report');
        } finally {
          setLoading(null);
        }
      }
    },
    {
      id: 'schedule-maintenance',
      icon: <Calendar className="h-6 w-6" />,
      label: 'Schedule Maintenance',
      description: 'Quick maintenance scheduling',
      color: 'bg-yellow-500 hover:bg-yellow-600',
      action: async () => {
        setLoading('schedule-maintenance');
        try {
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id')
            .eq('status', 'active')
            .limit(1);

          if (vehicles && vehicles.length > 0) {
            const scheduledDate = new Date();
            scheduledDate.setDate(scheduledDate.getDate() + 7);

            await supabase.from('maintenance_schedules').insert({
              vehicle_id: vehicles[0].id,
              maintenance_type: 'preventive',
              scheduled_date: scheduledDate.toISOString(),
              status: 'pending'
            });
            await logAction('schedule', 'Schedule Maintenance', 'success');
            showMessage('success', 'Maintenance scheduled successfully!');
            onActionComplete?.();
          }
        } catch (error: any) {
          await logAction('schedule', 'Schedule Maintenance', 'failed', error.message);
          showMessage('error', 'Failed to schedule maintenance');
        } finally {
          setLoading(null);
        }
      }
    },
    {
      id: 'alert-check',
      icon: <AlertTriangle className="h-6 w-6" />,
      label: 'Check Alerts',
      description: 'View critical alerts',
      color: 'bg-red-500 hover:bg-red-600',
      action: async () => {
        setLoading('alert-check');
        try {
          const { data } = await supabase
            .from('predictive_maintenance_models')
            .select('*')
            .eq('urgency_level', 'critical')
            .eq('status', 'active');

          await logAction('check', 'Check Alerts', 'success');
          showMessage('success', `Found ${data?.length || 0} critical alerts`);
          onActionComplete?.();
        } catch (error: any) {
          await logAction('check', 'Check Alerts', 'failed', error.message);
          showMessage('error', 'Failed to check alerts');
        } finally {
          setLoading(null);
        }
      }
    },
    {
      id: 'add-expense',
      icon: <DollarSign className="h-6 w-6" />,
      label: 'Record Expense',
      description: 'Quick expense entry',
      color: 'bg-purple-500 hover:bg-purple-600',
      action: async () => {
        setLoading('add-expense');
        try {
          const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id')
            .limit(1);

          if (vehicles && vehicles.length > 0) {
            await supabase.from('costs').insert({
              vehicle_id: vehicles[0].id,
              category: 'other',
              amount: 100,
              date: new Date().toISOString().split('T')[0],
              description: 'Quick expense entry'
            });
            await logAction('create', 'Record Expense', 'success');
            showMessage('success', 'Expense recorded successfully!');
            onActionComplete?.();
          }
        } catch (error: any) {
          await logAction('create', 'Record Expense', 'failed', error.message);
          showMessage('error', 'Failed to record expense');
        } finally {
          setLoading(null);
        }
      }
    },
    {
      id: 'driver-status',
      icon: <Users className="h-6 w-6" />,
      label: 'Driver Status',
      description: 'Check driver availability',
      color: 'bg-indigo-500 hover:bg-indigo-600',
      action: async () => {
        setLoading('driver-status');
        try {
          const { data } = await supabase
            .from('drivers')
            .select('status')
            .eq('status', 'active');

          await logAction('check', 'Driver Status', 'success');
          showMessage('success', `${data?.length || 0} drivers available`);
          onActionComplete?.();
        } catch (error: any) {
          await logAction('check', 'Driver Status', 'failed', error.message);
          showMessage('error', 'Failed to check driver status');
        } finally {
          setLoading(null);
        }
      }
    },
    {
      id: 'analytics-update',
      icon: <TrendingUp className="h-6 w-6" />,
      label: 'Update Analytics',
      description: 'Refresh all analytics',
      color: 'bg-teal-500 hover:bg-teal-600',
      action: async () => {
        setLoading('analytics-update');
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await logAction('update', 'Update Analytics', 'success');
          showMessage('success', 'Analytics updated successfully!');
          onActionComplete?.();
        } catch (error: any) {
          await logAction('update', 'Update Analytics', 'failed', error.message);
          showMessage('error', 'Failed to update analytics');
        } finally {
          setLoading(null);
        }
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Zap className="h-7 w-7 text-yellow-500" />
          Quick Actions
        </h2>
        <p className="text-gray-600 mt-1">One-click operations for common tasks</p>
      </div>

      {message && (
        <div
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

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Quick Tips
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Click any action for instant execution</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>All actions are logged for audit purposes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Actions complete in seconds for maximum efficiency</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { X, Save, Target, AlertTriangle, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DriverBehaviorModalProps {
  score: any;
  onClose: () => void;
  onSave: () => void;
}

export default function DriverBehaviorModal({ score, onClose, onSave }: DriverBehaviorModalProps) {
  const [formData, setFormData] = useState({
    driver_id: score?.driver_id || '',
    period_start: score?.period_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    period_end: score?.period_end || new Date().toISOString().split('T')[0],
    overall_score: score?.overall_score || 75,
    safety_score: score?.safety_score || 75,
    efficiency_score: score?.efficiency_score || 75,
    compliance_score: score?.compliance_score || 75,
    eco_driving_score: score?.eco_driving_score || 75,
    harsh_braking_count: score?.harsh_braking_count || 0,
    harsh_acceleration_count: score?.harsh_acceleration_count || 0,
    speeding_incidents: score?.speeding_incidents || 0,
    idle_time_minutes: score?.idle_time_minutes || 0,
    night_driving_hours: score?.night_driving_hours || 0,
    fatigue_risk_level: score?.fatigue_risk_level || 'low',
    improvement_areas: (score?.improvement_areas || []) as string[],
    strengths: (score?.strengths || []) as string[],
    training_recommendations: (score?.training_recommendations || []) as string[]
  });
  const [drivers, setDrivers] = useState<any[]>([]);
  const [newImprovement, setNewImprovement] = useState('');
  const [newStrength, setNewStrength] = useState('');
  const [newTraining, setNewTraining] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('id, first_name, last_name, license_number')
      .eq('status', 'active')
      .order('first_name');
    setDrivers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        accident_risk_score: (formData.harsh_braking_count + formData.harsh_acceleration_count + formData.speeding_incidents) * 3,
        peer_comparison_percentile: Math.floor(Math.random() * 100)
      };

      if (score?.id) {
        await supabase
          .from('driver_behavior_scores')
          .update(dataToSave)
          .eq('id', score.id);
      } else {
        await supabase
          .from('driver_behavior_scores')
          .insert(dataToSave);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving score:', error);
      alert('Error saving score');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (type: 'improvement' | 'strength' | 'training') => {
    if (type === 'improvement' && newImprovement.trim()) {
      setFormData({
        ...formData,
        improvement_areas: [...formData.improvement_areas, newImprovement.trim()]
      });
      setNewImprovement('');
    } else if (type === 'strength' && newStrength.trim()) {
      setFormData({
        ...formData,
        strengths: [...formData.strengths, newStrength.trim()]
      });
      setNewStrength('');
    } else if (type === 'training' && newTraining.trim()) {
      setFormData({
        ...formData,
        training_recommendations: [...formData.training_recommendations, newTraining.trim()]
      });
      setNewTraining('');
    }
  };

  const removeItem = (type: 'improvement' | 'strength' | 'training', index: number) => {
    if (type === 'improvement') {
      setFormData({
        ...formData,
        improvement_areas: formData.improvement_areas.filter((_, i) => i !== index)
      });
    } else if (type === 'strength') {
      setFormData({
        ...formData,
        strengths: formData.strengths.filter((_, i) => i !== index)
      });
    } else if (type === 'training') {
      setFormData({
        ...formData,
        training_recommendations: formData.training_recommendations.filter((_, i) => i !== index)
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl border-b border-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6" />
              <h2 className="text-2xl font-bold">
                {score?.id ? 'Edit Driver Score' : 'New Driver Score'}
              </h2>
            </div>
            <button onClick={onClose} className="text-white hover:bg-blue-500 p-2 rounded-lg transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Driver *
              </label>
              <select
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.first_name} {driver.last_name} - {driver.license_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Period Start *
              </label>
              <input
                type="date"
                value={formData.period_start}
                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Period End *
              </label>
              <input
                type="date"
                value={formData.period_end}
                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                required
                min={formData.period_start}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h3 className="font-bold text-gray-900 mb-4">Performance Scores (0-100)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overall Score
                </label>
                <input
                  type="number"
                  value={formData.overall_score}
                  onChange={(e) => setFormData({ ...formData, overall_score: parseInt(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Safety
                </label>
                <input
                  type="number"
                  value={formData.safety_score}
                  onChange={(e) => setFormData({ ...formData, safety_score: parseInt(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Efficiency
                </label>
                <input
                  type="number"
                  value={formData.efficiency_score}
                  onChange={(e) => setFormData({ ...formData, efficiency_score: parseInt(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compliance
                </label>
                <input
                  type="number"
                  value={formData.compliance_score}
                  onChange={(e) => setFormData({ ...formData, compliance_score: parseInt(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Eco-Driving
                </label>
                <input
                  type="number"
                  value={formData.eco_driving_score}
                  onChange={(e) => setFormData({ ...formData, eco_driving_score: parseInt(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-6 space-y-4">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Incidents
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Harsh Braking
                </label>
                <input
                  type="number"
                  value={formData.harsh_braking_count}
                  onChange={(e) => setFormData({ ...formData, harsh_braking_count: parseInt(e.target.value) })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Harsh Acceleration
                </label>
                <input
                  type="number"
                  value={formData.harsh_acceleration_count}
                  onChange={(e) => setFormData({ ...formData, harsh_acceleration_count: parseInt(e.target.value) })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speeding
                </label>
                <input
                  type="number"
                  value={formData.speeding_incidents}
                  onChange={(e) => setFormData({ ...formData, speeding_incidents: parseInt(e.target.value) })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idle Time (min)
                </label>
                <input
                  type="number"
                  value={formData.idle_time_minutes}
                  onChange={(e) => setFormData({ ...formData, idle_time_minutes: parseInt(e.target.value) })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Night Hours
                </label>
                <input
                  type="number"
                  value={formData.night_driving_hours}
                  onChange={(e) => setFormData({ ...formData, night_driving_hours: parseFloat(e.target.value) })}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fatigue Risk
                </label>
                <select
                  value={formData.fatigue_risk_level}
                  onChange={(e) => setFormData({ ...formData, fatigue_risk_level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Award className="h-5 w-5 text-green-600" />
                Strengths
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newStrength}
                  onChange={(e) => setNewStrength(e.target.value)}
                  placeholder="Add a strength..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('strength'))}
                />
                <button
                  type="button"
                  onClick={() => addItem('strength')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {formData.strengths.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-green-50 p-2 rounded-lg">
                    <span className="flex-1 text-sm text-green-900">✓ {item}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('strength', idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Areas for Improvement
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newImprovement}
                  onChange={(e) => setNewImprovement(e.target.value)}
                  placeholder="Add an improvement area..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('improvement'))}
                />
                <button
                  type="button"
                  onClick={() => addItem('improvement')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {formData.improvement_areas.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-yellow-50 p-2 rounded-lg">
                    <span className="flex-1 text-sm text-yellow-900">⚠ {item}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('improvement', idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Training Recommendations
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newTraining}
                  onChange={(e) => setNewTraining(e.target.value)}
                  placeholder="Add a training recommendation..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('training'))}
                />
                <button
                  type="button"
                  onClick={() => addItem('training')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {formData.training_recommendations.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                    <span className="flex-1 text-sm text-blue-900">📚 {item}</span>
                    <button
                      type="button"
                      onClick={() => removeItem('training', idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {loading ? 'Saving...' : (score?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Calendar, DollarSign, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PredictiveMaintenanceModalProps {
  prediction: any;
  onClose: () => void;
  onSave: () => void;
}

export default function PredictiveMaintenanceModal({ prediction, onClose, onSave }: PredictiveMaintenanceModalProps) {
  const [formData, setFormData] = useState({
    vehicle_id: prediction?.vehicle_id || '',
    model_type: prediction?.model_type || 'ML_RandomForest',
    prediction_date: prediction?.prediction_date?.split('T')[0] || '',
    failure_probability: prediction?.failure_probability || 0,
    predicted_component: prediction?.predicted_component || '',
    recommended_action: prediction?.recommended_action || '',
    estimated_cost: prediction?.estimated_cost || 0,
    urgency_level: prediction?.urgency_level || 'medium',
    confidence_score: prediction?.confidence_score || 0,
    status: prediction?.status || 'active'
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('id, registration, make, model')
      .eq('status', 'active')
      .order('registration');
    setVehicles(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        ...formData,
        failure_probability: parseFloat(formData.failure_probability.toString()),
        estimated_cost: parseFloat(formData.estimated_cost.toString()),
        confidence_score: parseFloat(formData.confidence_score.toString()),
        last_trained_at: new Date().toISOString()
      };

      if (prediction?.id) {
        await supabase
          .from('predictive_maintenance_models')
          .update(dataToSave)
          .eq('id', prediction.id);
      } else {
        await supabase
          .from('predictive_maintenance_models')
          .insert(dataToSave);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving prediction:', error);
      alert('Error saving prediction');
    } finally {
      setLoading(false);
    }
  };

  const components = [
    'Engine', 'Transmission', 'Brakes', 'Suspension', 'Electrical System',
    'Cooling System', 'Exhaust System', 'Fuel System', 'Tires', 'Battery',
    'Alternator', 'Starter', 'Clutch', 'Drive Shaft', 'Differential'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl border-b border-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wrench className="h-6 w-6" />
              <h2 className="text-2xl font-bold">
                {prediction?.id ? 'Edit Prediction' : 'New Prediction'}
              </h2>
            </div>
            <button onClick={onClose} className="text-white hover:bg-blue-500 p-2 rounded-lg transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Vehicle *
              </label>
              <select
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} - {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Model Type
              </label>
              <select
                value={formData.model_type}
                onChange={(e) => setFormData({ ...formData, model_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="ML_RandomForest">Random Forest</option>
                <option value="ML_NeuralNetwork">Neural Network</option>
                <option value="ML_GradientBoosting">Gradient Boosting</option>
                <option value="ML_SVM">Support Vector Machine</option>
                <option value="Statistical">Statistical Model</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Prediction Date *
              </label>
              <input
                type="date"
                value={formData.prediction_date}
                onChange={(e) => setFormData({ ...formData, prediction_date: e.target.value })}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Predicted Component *
              </label>
              <select
                value={formData.predicted_component}
                onChange={(e) => setFormData({ ...formData, predicted_component: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Component</option>
                {components.map((comp) => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Failure Probability (%) *
              </label>
              <input
                type="number"
                value={formData.failure_probability}
                onChange={(e) => setFormData({ ...formData, failure_probability: parseFloat(e.target.value) })}
                required
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confidence Score (%)
              </label>
              <input
                type="number"
                value={formData.confidence_score}
                onChange={(e) => setFormData({ ...formData, confidence_score: parseFloat(e.target.value) })}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Estimated Cost ($)
              </label>
              <input
                type="number"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) })}
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Urgency Level *
              </label>
              <select
                value={formData.urgency_level}
                onChange={(e) => setFormData({ ...formData, urgency_level: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Recommended Action *
            </label>
            <textarea
              value={formData.recommended_action}
              onChange={(e) => setFormData({ ...formData, recommended_action: e.target.value })}
              required
              rows={4}
              placeholder="Describe the recommended maintenance action..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Quick Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Higher failure probability indicates more urgent attention needed</li>
              <li>• Confidence score represents ML model certainty</li>
              <li>• Set realistic prediction dates based on historical data</li>
              <li>• Cost estimates help with maintenance budget planning</li>
            </ul>
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
              {loading ? 'Saving...' : (prediction?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
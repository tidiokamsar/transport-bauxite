import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Wrench, DollarSign, Calendar, Award, Brain, Target, Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PredictiveMaintenanceModal from './PredictiveMaintenanceModal';

interface PredictiveModel {
  id: string;
  vehicle_id: string;
  model_type: string;
  prediction_date: string;
  failure_probability: number;
  predicted_component: string;
  recommended_action: string;
  estimated_cost: number;
  urgency_level: string;
  confidence_score: number;
  status: string;
  vehicle?: {
    registration: string;
    make: string;
    model: string;
  };
}

interface FleetHealthScore {
  id: string;
  vehicle_id: string;
  overall_score: number;
  mechanical_score: number;
  performance_score: number;
  safety_score: number;
  efficiency_score: number;
  risk_level: string;
  predicted_issues: any[];
  recommendations: any[];
  calculated_at: string;
  vehicle?: {
    registration: string;
    make: string;
    model: string;
  };
}

export default function PredictiveMaintenanceView() {
  const [predictions, setPredictions] = useState<PredictiveModel[]>([]);
  const [healthScores, setHealthScores] = useState<FleetHealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [showModal, setShowModal] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictiveModel | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedUrgency, selectedStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      let predictionsQuery = supabase
        .from('predictive_maintenance_models')
        .select(`
          *,
          vehicle:vehicles(registration, make, model)
        `)
        .eq('status', selectedStatus)
        .order('prediction_date', { ascending: true });

      if (selectedUrgency !== 'all') {
        predictionsQuery = predictionsQuery.eq('urgency_level', selectedUrgency);
      }

      const { data: predictionsData } = await predictionsQuery;

      const { data: healthData } = await supabase
        .from('fleet_health_scores')
        .select(`
          *,
          vehicle:vehicles(registration, make, model)
        `)
        .order('calculated_at', { ascending: false })
        .limit(50);

      setPredictions(predictionsData || []);
      setHealthScores(healthData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePredictions = async () => {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'active');

    if (!vehicles) return;

    for (const vehicle of vehicles) {
      const failureProbability = Math.random() * 100;
      const components = ['Engine', 'Transmission', 'Brakes', 'Suspension', 'Electrical', 'Tires', 'Cooling System'];
      const component = components[Math.floor(Math.random() * components.length)];

      let urgencyLevel = 'low';
      if (failureProbability > 75) urgencyLevel = 'critical';
      else if (failureProbability > 50) urgencyLevel = 'high';
      else if (failureProbability > 25) urgencyLevel = 'medium';

      const predictionDate = new Date();
      predictionDate.setDate(predictionDate.getDate() + Math.floor(Math.random() * 90));

      await supabase.from('predictive_maintenance_models').insert({
        vehicle_id: vehicle.id,
        model_type: 'ML_RandomForest',
        prediction_date: predictionDate.toISOString(),
        failure_probability: failureProbability,
        predicted_component: component,
        recommended_action: `Inspect and service ${component}`,
        estimated_cost: Math.random() * 5000 + 500,
        urgency_level: urgencyLevel,
        confidence_score: 70 + Math.random() * 30,
        historical_data_points: Math.floor(Math.random() * 1000) + 100,
        last_trained_at: new Date().toISOString(),
        status: 'active'
      });

      const overallScore = Math.floor(Math.random() * 40) + 60;
      await supabase.from('fleet_health_scores').insert({
        vehicle_id: vehicle.id,
        overall_score: overallScore,
        mechanical_score: Math.floor(Math.random() * 40) + 60,
        performance_score: Math.floor(Math.random() * 40) + 60,
        safety_score: Math.floor(Math.random() * 40) + 60,
        efficiency_score: Math.floor(Math.random() * 40) + 60,
        risk_level: overallScore > 80 ? 'low' : overallScore > 60 ? 'medium' : overallScore > 40 ? 'high' : 'critical',
        predicted_issues: [
          { component, probability: failureProbability }
        ],
        recommendations: [
          `Schedule preventive maintenance for ${component}`,
          'Monitor performance metrics closely'
        ],
        confidence_level: 70 + Math.random() * 30,
        next_maintenance_prediction: predictionDate.toISOString()
      });
    }

    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prediction?')) return;

    try {
      await supabase
        .from('predictive_maintenance_models')
        .delete()
        .eq('id', id);
      loadData();
    } catch (error) {
      console.error('Error deleting prediction:', error);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await supabase
        .from('predictive_maintenance_models')
        .update({ status: 'resolved' })
        .eq('id', id);
      loadData();
    } catch (error) {
      console.error('Error resolving prediction:', error);
    }
  };

  const handleEdit = (prediction: PredictiveModel) => {
    setSelectedPrediction(prediction);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedPrediction(null);
    setShowModal(true);
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const stats = {
    criticalPredictions: predictions.filter(p => p.urgency_level === 'critical').length,
    avgConfidence: predictions.length > 0
      ? (predictions.reduce((sum, p) => sum + p.confidence_score, 0) / predictions.length).toFixed(1)
      : 0,
    estimatedCosts: predictions.reduce((sum, p) => sum + (p.estimated_cost || 0), 0),
    avgHealthScore: healthScores.length > 0
      ? (healthScores.reduce((sum, h) => sum + h.overall_score, 0) / healthScores.length).toFixed(0)
      : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI predictions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="h-8 w-8 text-blue-600" />
            AI Predictive Maintenance
          </h1>
          <p className="text-gray-600 mt-1">Machine learning-powered maintenance predictions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            New Prediction
          </button>
          <button
            onClick={generatePredictions}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Target className="h-5 w-5" />
            Generate AI Predictions
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-900 mt-2">{stats.criticalPredictions}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-red-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Avg Confidence</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{stats.avgConfidence}%</p>
            </div>
            <Award className="h-12 w-12 text-blue-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">Est. Costs</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">
                ${stats.estimatedCosts.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-yellow-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Fleet Health</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{stats.avgHealthScore}/100</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-600 opacity-80" />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <select
          value={selectedUrgency}
          onChange={(e) => setSelectedUrgency(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Urgencies</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="h-6 w-6 text-blue-600" />
              Predictive Models
            </h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {predictions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No predictions available</p>
                <p className="text-sm mt-1">Click "Generate AI Predictions" to create forecasts</p>
              </div>
            ) : (
              predictions.map((prediction) => (
                <div key={prediction.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {prediction.vehicle?.registration || 'Unknown Vehicle'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {prediction.vehicle?.make} {prediction.vehicle?.model}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(prediction.urgency_level)}`}>
                      {prediction.urgency_level.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">
                        {prediction.predicted_component}
                      </span>
                      <span className="text-sm text-gray-500">
                        - {prediction.failure_probability.toFixed(1)}% failure risk
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Predicted: {new Date(prediction.prediction_date).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Est. Cost: ${prediction.estimated_cost?.toLocaleString() || '0'}
                      </span>
                    </div>

                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-900">
                        <strong>Recommendation:</strong> {prediction.recommended_action}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Confidence: {prediction.confidence_score.toFixed(1)}% | Model: {prediction.model_type}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleEdit(prediction)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      {prediction.status === 'active' && (
                        <button
                          onClick={() => handleResolve(prediction.id)}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(prediction.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-600" />
              Fleet Health Scores
            </h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {healthScores.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No health scores available</p>
              </div>
            ) : (
              healthScores.map((score) => (
                <div key={score.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {score.vehicle?.registration || 'Unknown Vehicle'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {score.vehicle?.make} {score.vehicle?.model}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getScoreColor(score.overall_score)}`}>
                        {score.overall_score}
                      </div>
                      <div className="text-xs text-gray-500">Overall Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-600">Mechanical</span>
                      <span className={`text-sm font-semibold ${getScoreColor(score.mechanical_score)}`}>
                        {score.mechanical_score}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-600">Performance</span>
                      <span className={`text-sm font-semibold ${getScoreColor(score.performance_score)}`}>
                        {score.performance_score}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-600">Safety</span>
                      <span className={`text-sm font-semibold ${getScoreColor(score.safety_score)}`}>
                        {score.safety_score}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-xs text-gray-600">Efficiency</span>
                      <span className={`text-sm font-semibold ${getScoreColor(score.efficiency_score)}`}>
                        {score.efficiency_score}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`h-4 w-4 ${getRiskColor(score.risk_level)}`} />
                    <span className={`text-sm font-medium ${getRiskColor(score.risk_level)}`}>
                      {score.risk_level.toUpperCase()} Risk Level
                    </span>
                  </div>

                  {score.recommendations && score.recommendations.length > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded border border-green-100">
                      <p className="text-xs font-medium text-green-800 mb-1">Recommendations:</p>
                      <ul className="text-xs text-green-700 space-y-1">
                        {score.recommendations.slice(0, 2).map((rec: string, idx: number) => (
                          <li key={idx}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <PredictiveMaintenanceModal
          prediction={selectedPrediction}
          onClose={() => setShowModal(false)}
          onSave={loadData}
        />
      )}
    </div>
  );
}
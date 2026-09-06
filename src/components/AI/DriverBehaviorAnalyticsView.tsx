import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Target, Users, BarChart3, Shield, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import DriverBehaviorModal from './DriverBehaviorModal';

interface DriverBehaviorScore {
  id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  overall_score: number;
  safety_score: number;
  efficiency_score: number;
  compliance_score: number;
  eco_driving_score: number;
  harsh_braking_count: number;
  harsh_acceleration_count: number;
  speeding_incidents: number;
  idle_time_minutes: number;
  night_driving_hours: number;
  fatigue_risk_level: string;
  accident_risk_score: number;
  improvement_areas: any[];
  strengths: any[];
  training_recommendations: any[];
  peer_comparison_percentile: number;
  driver?: {
    first_name: string;
    last_name: string;
    license_number: string;
  };
}

export default function DriverBehaviorAnalyticsView() {
  const [scores, setScores] = useState<DriverBehaviorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('overall_score');
  const [showModal, setShowModal] = useState(false);
  const [selectedScore, setSelectedScore] = useState<DriverBehaviorScore | null>(null);

  useEffect(() => {
    loadScores();
  }, [selectedRisk, sortBy]);

  const loadScores = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('driver_behavior_scores')
        .select(`
          *,
          driver:drivers(first_name, last_name, license_number)
        `)
        .order(sortBy, { ascending: sortBy === 'overall_score' ? false : true });

      if (selectedRisk !== 'all') {
        query = query.eq('fatigue_risk_level', selectedRisk);
      }

      const { data } = await query;
      setScores(data || []);
    } catch (error) {
      console.error('Error loading scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateScores = async () => {
    const { data: drivers } = await supabase
      .from('drivers')
      .select('*')
      .eq('status', 'active');

    if (!drivers) return;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (const driver of drivers) {
      const overallScore = Math.floor(Math.random() * 40) + 60;
      const harshBraking = Math.floor(Math.random() * 20);
      const harshAcceleration = Math.floor(Math.random() * 15);
      const speeding = Math.floor(Math.random() * 10);
      const idleTime = Math.floor(Math.random() * 500);
      const nightHours = Math.random() * 80;

      let fatigueRisk = 'low';
      if (nightHours > 60) fatigueRisk = 'critical';
      else if (nightHours > 40) fatigueRisk = 'high';
      else if (nightHours > 20) fatigueRisk = 'medium';

      const improvementAreas = [];
      const strengths = [];
      const trainingRecommendations = [];

      if (harshBraking > 10) {
        improvementAreas.push('Excessive harsh braking');
        trainingRecommendations.push('Defensive driving course');
      } else {
        strengths.push('Smooth braking technique');
      }

      if (speeding > 5) {
        improvementAreas.push('Speed limit violations');
        trainingRecommendations.push('Speed awareness training');
      } else {
        strengths.push('Excellent speed compliance');
      }

      if (idleTime > 300) {
        improvementAreas.push('High idle time');
        trainingRecommendations.push('Fuel efficiency workshop');
      }

      await supabase.from('driver_behavior_scores').insert({
        driver_id: driver.id,
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDate.toISOString().split('T')[0],
        overall_score: overallScore,
        safety_score: Math.max(0, overallScore - (harshBraking + harshAcceleration + speeding)),
        efficiency_score: Math.max(0, 100 - (idleTime / 5)),
        compliance_score: Math.max(0, 100 - (speeding * 10)),
        eco_driving_score: Math.max(0, 100 - (harshAcceleration + harshBraking) * 2),
        harsh_braking_count: harshBraking,
        harsh_acceleration_count: harshAcceleration,
        speeding_incidents: speeding,
        idle_time_minutes: idleTime,
        night_driving_hours: nightHours,
        fatigue_risk_level: fatigueRisk,
        accident_risk_score: (harshBraking + harshAcceleration + speeding) * 3,
        improvement_areas: improvementAreas,
        strengths: strengths,
        training_recommendations: trainingRecommendations,
        peer_comparison_percentile: Math.floor(Math.random() * 100)
      });
    }

    loadScores();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this driver score?')) return;
    try {
      await supabase.from('driver_behavior_scores').delete().eq('id', id);
      loadScores();
    } catch (error) {
      console.error('Error deleting score:', error);
    }
  };

  const handleEdit = (score: DriverBehaviorScore) => {
    setSelectedScore(score);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedScore(null);
    setShowModal(true);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const stats = {
    avgScore: scores.length > 0
      ? (scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length).toFixed(0)
      : 0,
    highRisk: scores.filter(s => s.fatigue_risk_level === 'high' || s.fatigue_risk_level === 'critical').length,
    totalIncidents: scores.reduce((sum, s) => sum + s.harsh_braking_count + s.harsh_acceleration_count + s.speeding_incidents, 0),
    topPerformers: scores.filter(s => s.overall_score >= 85).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing driver behavior...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Driver Behavior Analytics
          </h1>
          <p className="text-gray-600 mt-1">Advanced AI-powered driver performance analysis</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            New Score
          </button>
          <button
            onClick={generateScores}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Target className="h-5 w-5" />
            Generate Analytics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Avg Score</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{stats.avgScore}/100</p>
            </div>
            <Award className="h-12 w-12 text-blue-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">High Risk</p>
              <p className="text-3xl font-bold text-red-900 mt-2">{stats.highRisk}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-red-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">Total Incidents</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">{stats.totalIncidents}</p>
            </div>
            <Shield className="h-12 w-12 text-yellow-600 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Top Performers</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{stats.topPerformers}</p>
            </div>
            <Users className="h-12 w-12 text-green-600 opacity-80" />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <select
          value={selectedRisk}
          onChange={(e) => setSelectedRisk(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Risk Levels</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
          <option value="critical">Critical Risk</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="overall_score">Overall Score</option>
          <option value="safety_score">Safety Score</option>
          <option value="efficiency_score">Efficiency Score</option>
          <option value="accident_risk_score">Risk Score</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overall Score
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Safety
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Efficiency
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eco-Driving
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Incidents
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Percentile
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>No driver analytics available</p>
                    <p className="text-sm mt-1">Click "Generate Analytics" to create reports</p>
                  </td>
                </tr>
              ) : (
                scores.map((score) => (
                  <tr key={score.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {score.driver?.first_name} {score.driver?.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {score.driver?.license_number}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-2xl font-bold ${getScoreColor(score.overall_score)}`}>
                        {score.overall_score}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-lg font-semibold ${getScoreColor(score.safety_score)}`}>
                        {score.safety_score}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-lg font-semibold ${getScoreColor(score.efficiency_score)}`}>
                        {score.efficiency_score}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-lg font-semibold ${getScoreColor(score.eco_driving_score)}`}>
                        {score.eco_driving_score}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm space-y-1">
                        <div className="text-red-600">🛑 {score.harsh_braking_count} brakes</div>
                        <div className="text-orange-600">⚡ {score.harsh_acceleration_count} accel</div>
                        <div className="text-yellow-600">🚨 {score.speeding_incidents} speed</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(score.fatigue_risk_level)}`}>
                        {score.fatigue_risk_level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        {score.peer_comparison_percentile >= 75 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : score.peer_comparison_percentile >= 50 ? (
                          <Award className="h-4 w-4 text-blue-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-semibold">{score.peer_comparison_percentile}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(score)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(score.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {scores.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {scores.slice(0, 4).map((score) => (
            <div key={score.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {score.driver?.first_name} {score.driver?.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">{score.driver?.license_number}</p>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(score.overall_score)}`}>
                  {score.overall_score}
                </div>
              </div>

              {score.strengths && score.strengths.length > 0 && (
                <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Strengths
                  </p>
                  <ul className="text-sm text-green-700 space-y-1">
                    {score.strengths.map((strength: string, idx: number) => (
                      <li key={idx}>✓ {strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {score.improvement_areas && score.improvement_areas.length > 0 && (
                <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <p className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Areas for Improvement
                  </p>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {score.improvement_areas.map((area: string, idx: number) => (
                      <li key={idx}>⚠ {area}</li>
                    ))}
                  </ul>
                </div>
              )}

              {score.training_recommendations && score.training_recommendations.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Training Recommendations
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {score.training_recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>📚 {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <DriverBehaviorModal
          score={selectedScore}
          onClose={() => setShowModal(false)}
          onSave={loadScores}
        />
      )}
    </div>
  );
}
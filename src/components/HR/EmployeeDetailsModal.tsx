import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, User, Phone, DollarSign,
  Truck, Clock, Award, FileText, Activity, BarChart3, CheckCircle
} from 'lucide-react';

interface EmployeeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
}

export const EmployeeDetailsModal = ({ isOpen, onClose, employeeId }: EmployeeDetailsModalProps) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'trips' | 'payroll' | 'attendance'>('overview');
  const [employee, setEmployee] = useState<any>(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalKm: 0,
    totalTonnage: 0,
    totalMissionBonus: 0,
    totalPayroll: 0,
    avgMonthlyPay: 0,
    attendanceRate: 0,
    presentDays: 0,
    absentDays: 0,
    lastPayrollDate: '',
  });
  const [trips, setTrips] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchEmployeeData();
    }
  }, [isOpen, employeeId]);

  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      // Récupérer les infos de l'employé
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (empData) {
        setEmployee(empData);

        // Récupérer les trajets (si c'est un chauffeur)
        const { data: tripsData } = await supabase
          .from('trips')
          .select('*, vehicle:vehicles(registration), departure:sites!trips_departure_site_id_fkey(name), arrival:sites!trips_arrival_site_id_fkey(name)')
          .eq('driver_id', employeeId)
          .order('planned_date', { ascending: false })
          .limit(50);

        if (tripsData) {
          setTrips(tripsData);
          const totalKm = tripsData.reduce((sum, t) => sum + ((t.km_end || 0) - (t.km_start || 0)), 0);
          const totalTonnage = tripsData.reduce((sum, t) => sum + (t.net_weight || 0), 0);

          // Calculer primes de mission (50,000 GNF par trajet)
          const missionBonus = tripsData.length * 50000;

          stats.totalTrips = tripsData.length;
          stats.totalKm = totalKm;
          stats.totalTonnage = totalTonnage;
          stats.totalMissionBonus = missionBonus;
        }

        // Récupérer l'historique de paie
        const { data: payrollData } = await supabase
          .from('payroll_records')
          .select('*')
          .eq('employee_id', employeeId)
          .order('period_start', { ascending: false });

        if (payrollData && payrollData.length > 0) {
          setPayrolls(payrollData);
          const totalPay = payrollData.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
          const avgPay = totalPay / payrollData.length;
          const lastPayroll = payrollData[0];

          stats.totalPayroll = totalPay;
          stats.avgMonthlyPay = avgPay;
          stats.lastPayrollDate = lastPayroll.period_start;
        }

        // Récupérer les présences
        const { data: attendanceData } = await supabase
          .from('employee_attendance')
          .select('*')
          .eq('employee_id', employeeId)
          .order('date', { ascending: false })
          .limit(90);

        if (attendanceData) {
          setAttendance(attendanceData);
          const presentCount = attendanceData.filter(a => a.status === 'present').length;
          const absentCount = attendanceData.filter(a => a.status === 'absent').length;
          const rate = attendanceData.length > 0 ? (presentCount / attendanceData.length) * 100 : 0;

          stats.presentDays = presentCount;
          stats.absentDays = absentCount;
          stats.attendanceRate = rate;
        }

        setStats({ ...stats });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header avec photo et infos principales */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {employee?.first_name} {employee?.last_name}
                </h2>
                <p className="text-blue-100 flex items-center gap-2 mt-1">
                  <span className="font-semibold">{employee?.employee_number}</span>
                  <span>•</span>
                  <span>{employee?.position || 'N/A'}</span>
                </p>
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <span className={`px-3 py-1 rounded-full font-semibold ${
                    employee?.status === 'active'
                      ? 'bg-green-400 text-green-900'
                      : 'bg-red-400 text-red-900'
                  }`}>
                    {employee?.status === 'active' ? 'Actif' : 'Inactif'}
                  </span>
                  <span className="text-blue-100">
                    Embauché le {new Date(employee?.hire_date).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* KPIs Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs text-blue-100">Salaire de base</span>
              </div>
              <p className="text-xl font-bold">{(employee?.base_salary / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-blue-100">GNF/mois</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4" />
                <span className="text-xs text-blue-100">Missions</span>
              </div>
              <p className="text-xl font-bold">{stats.totalTrips}</p>
              <p className="text-xs text-blue-100">trajets</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs text-blue-100">Présence</span>
              </div>
              <p className="text-xl font-bold">{stats.attendanceRate.toFixed(0)}%</p>
              <p className="text-xs text-blue-100">{stats.presentDays}j présent</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4" />
                <span className="text-xs text-blue-100">Primes totales</span>
              </div>
              <p className="text-xl font-bold">{(stats.totalMissionBonus / 1000).toFixed(0)}k</p>
              <p className="text-xs text-blue-100">GNF</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-6">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Vue d'ensemble
              </span>
            </button>
            <button
              onClick={() => setActiveTab('trips')}
              className={`px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'trips'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Missions ({stats.totalTrips})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'payroll'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Historique Paie ({payrolls.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'attendance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Présences ({stats.presentDays}j)
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informations personnelles */}
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Informations personnelles
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-slate-600">Matricule</p>
                        <p className="font-semibold">{employee?.employee_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Poste</p>
                        <p className="font-semibold">{employee?.position || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Téléphone</p>
                        <p className="font-semibold">{employee?.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Email</p>
                        <p className="font-semibold text-sm">{employee?.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Adresse</p>
                        <p className="font-semibold text-sm">{employee?.address || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-green-600" />
                      Contact d'urgence
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-slate-600">Nom</p>
                        <p className="font-semibold">{employee?.emergency_contact_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Téléphone</p>
                        <p className="font-semibold">{employee?.emergency_contact_phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Relation</p>
                        <p className="font-semibold">{employee?.emergency_contact_relationship || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Statistiques Financières */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-900">
                      <BarChart3 className="w-5 h-5" />
                      Rémunération
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Salaire de base</span>
                        <span className="font-bold text-green-700">
                          {(employee?.base_salary / 1000000).toFixed(2)}M GNF
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Total primes missions</span>
                        <span className="font-bold text-green-700">
                          {(stats.totalMissionBonus / 1000).toFixed(0)}k GNF
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-green-300">
                        <span className="text-slate-700">Paie moyenne/mois</span>
                        <span className="font-bold text-green-800 text-lg">
                          {(stats.avgMonthlyPay / 1000000).toFixed(2)}M GNF
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Total cumulé</span>
                        <span className="font-bold text-green-800 text-lg">
                          {(stats.totalPayroll / 1000000).toFixed(1)}M GNF
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statistiques Activité */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-900">
                      <Activity className="w-5 h-5" />
                      Activité
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Total trajets</span>
                        <span className="font-bold text-blue-700">{stats.totalTrips}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Kilomètres parcourus</span>
                        <span className="font-bold text-blue-700">
                          {stats.totalKm.toLocaleString()} km
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Tonnage transporté</span>
                        <span className="font-bold text-blue-700">
                          {stats.totalTonnage.toLocaleString()} T
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-blue-300">
                        <span className="text-slate-700">Taux de présence</span>
                        <span className="font-bold text-blue-800 text-lg">
                          {stats.attendanceRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'trips' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    Historique des Missions - {stats.totalTrips} trajets
                  </h3>
                  {trips.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Truck className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>Aucune mission enregistrée</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trips.map((trip) => (
                        <div key={trip.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-slate-900">
                                {trip.departure?.name || 'N/A'} → {trip.arrival?.name || 'N/A'}
                              </p>
                              <p className="text-sm text-slate-600">
                                {trip.vehicle?.registration || 'N/A'} • {new Date(trip.planned_date).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              trip.status === 'completed' ? 'bg-green-100 text-green-700' :
                              trip.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {trip.status === 'completed' ? 'Terminé' :
                               trip.status === 'in_progress' ? 'En cours' : 'Planifié'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-slate-500">Distance</p>
                              <p className="font-semibold">
                                {((trip.km_end || 0) - (trip.km_start || 0)).toFixed(0)} km
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Tonnage</p>
                              <p className="font-semibold">
                                {(trip.net_weight || 0).toFixed(1)} T
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Prime</p>
                              <p className="font-semibold text-green-600">
                                50,000 GNF
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payroll' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Historique de Paie - {payrolls.length} mois
                  </h3>
                  {payrolls.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>Aucune fiche de paie enregistrée</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {payrolls.map((payroll) => (
                        <div key={payroll.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-bold text-slate-900">
                                {new Date(payroll.period_start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                              </p>
                              <p className="text-sm text-slate-600">
                                Du {new Date(payroll.period_start).toLocaleDateString('fr-FR')} au {new Date(payroll.period_end).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              payroll.status === 'paid' ? 'bg-green-100 text-green-700' :
                              payroll.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {payroll.status === 'paid' ? 'Payé' :
                               payroll.status === 'pending' ? 'En attente' : 'Brouillon'}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-3 text-sm bg-slate-50 p-3 rounded">
                            <div>
                              <p className="text-slate-500 text-xs">Base</p>
                              <p className="font-semibold">
                                {(parseFloat(payroll.base_salary) / 1000000).toFixed(2)}M
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Primes</p>
                              <p className="font-semibold text-green-600">
                                +{(parseFloat(payroll.bonuses) / 1000).toFixed(0)}k
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Déductions</p>
                              <p className="font-semibold text-red-600">
                                -{(parseFloat(payroll.deductions) / 1000).toFixed(0)}k
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">Net</p>
                              <p className="font-bold text-green-700 text-base">
                                {(parseFloat(payroll.net_salary) / 1000000).toFixed(2)}M
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'attendance' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    Présences - {stats.presentDays} jours présent sur {attendance.length}
                  </h3>
                  {attendance.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Clock className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>Aucune donnée de présence</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-2">
                      {attendance.slice(0, 90).map((att) => (
                        <div
                          key={att.id}
                          className={`p-2 rounded text-center text-xs ${
                            att.status === 'present' ? 'bg-green-100 text-green-700' :
                            att.status === 'absent' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }`}
                          title={`${new Date(att.date).toLocaleDateString('fr-FR')} - ${att.status}`}
                        >
                          <p className="font-semibold">{new Date(att.date).getDate()}</p>
                          <p className="text-xs opacity-75">
                            {new Date(att.date).toLocaleDateString('fr-FR', { month: 'short' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

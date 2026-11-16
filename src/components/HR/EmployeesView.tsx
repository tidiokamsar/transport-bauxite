import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { EmployeeDetailsModal } from './EmployeeDetailsModal';
import {
  Plus, Search, Users, UserCheck, Briefcase, RefreshCw,
  Edit, Eye, Phone, Mail, Calendar, DollarSign, Download
} from 'lucide-react';

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  position: string;
  department?: string;
  hire_date: string;
  phone: string;
  email: string;
  base_salary: number;
  status: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
}

export const EmployeesView = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployeeId(employee.id);
    setShowDetailModal(true);
  };

  const filteredEmployees = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`;
    const matchesSearch =
      fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDepartment = departmentFilter === 'all' || employee.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const onLeave = employees.filter(e => e.status === 'on_leave').length;
  const totalPayroll = employees
    .filter(e => e.status === 'active')
    .reduce((sum, e) => sum + (e.base_salary || 0), 0);

  const departments = [...new Set(employees.map(e => e.department))].filter(Boolean);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      on_leave: 'bg-blue-100 text-blue-800',
      suspended: 'bg-orange-100 text-orange-800',
      terminated: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      active: 'Actif',
      on_leave: 'En congé',
      suspended: 'Suspendu',
      terminated: 'Terminé',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const exportToCSV = () => {
    const filename = `employes_${new Date().toISOString().split('T')[0]}.csv`;
    const headers = ['Numéro', 'Nom', 'Prénom', 'Poste', 'Département', 'Date d\'embauche', 'Email', 'Téléphone', 'Salaire de base', 'Statut'];

    const data = filteredEmployees.map(emp => [
      emp.employee_number,
      emp.last_name,
      emp.first_name,
      emp.position,
      emp.department || 'N/A',
      new Date(emp.hire_date).toLocaleDateString('fr-FR'),
      emp.email || 'N/A',
      emp.phone || 'N/A',
      emp.base_salary.toFixed(0),
      emp.status === 'active' ? 'Actif' : emp.status === 'on_leave' ? 'En congé' : 'Inactif'
    ]);

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestion des Employés</h1>
          <p className="text-slate-600 mt-1">Ressources humaines et personnel</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Exporter
          </button>
          <button
            onClick={fetchEmployees}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            <Plus className="w-5 h-5" />
            Nouvel employé
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total employés</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{employees.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Actifs</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeEmployees}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">En congé</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{onLeave}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Masse salariale</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {(totalPayroll / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-slate-500">GNF/mois</p>
            </div>
            <DollarSign className="w-8 h-8 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, matricule ou poste..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="all">Tous les départements</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="on_leave">En congé</option>
              <option value="suspended">Suspendus</option>
              <option value="terminated">Terminés</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Matricule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom complet</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Poste</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Département</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date d'embauche</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salaire base</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    Aucun employé trouvé
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetails(employee)}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {employee.employee_number}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetails(employee)}
                        className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {employee.first_name} {employee.last_name}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">{employee.position}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                      {employee.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                      {new Date(employee.hire_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {((employee.base_salary || 0) / 1000000).toFixed(2)}M
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {employee.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            <span>{employee.phone}</span>
                          </div>
                        )}
                        {employee.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{employee.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(employee.status)}`}>
                        {getStatusLabel(employee.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(employee)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Voir détails"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          className="p-1 text-slate-600 hover:bg-slate-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-5 h-5" />
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

      {/* Employee Details Modal - Advanced Version */}
      <EmployeeDetailsModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        employeeId={selectedEmployeeId}
      />

    </div>
  );
};

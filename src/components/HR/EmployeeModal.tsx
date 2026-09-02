import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee?: any;
}

export const EmployeeModal = ({ isOpen, onClose, onSuccess, employee }: EmployeeModalProps) => {
  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    department_id: '',
    position: '',
    hire_date: '',
    base_salary: '',
    phone: '',
    email: '',
    address: '',
    status: 'active',
    notes: '',
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
      if (employee) {
        setFormData({
          employee_number: employee.employee_number || '',
          first_name: employee.first_name || '',
          last_name: employee.last_name || '',
          department_id: employee.department_id || '',
          position: employee.position || '',
          hire_date: employee.hire_date || '',
          base_salary: employee.base_salary?.toString() || '',
          phone: employee.phone || '',
          email: employee.email || '',
          address: employee.address || '',
          status: employee.status || 'active',
          notes: employee.notes || '',
        });
      } else {
        setFormData({
          employee_number: `EMP-${Date.now()}`,
          first_name: '',
          last_name: '',
          department_id: '',
          position: '',
          hire_date: new Date().toISOString().split('T')[0],
          base_salary: '',
          phone: '',
          email: '',
          address: '',
          status: 'active',
          notes: '',
        });
      }
    }
  }, [isOpen, employee]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        employee_number: formData.employee_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        department_id: formData.department_id || null,
        position: formData.position,
        hire_date: formData.hire_date,
        base_salary: parseFloat(formData.base_salary) || 0,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        status: formData.status,
        notes: formData.notes || null,
      };

      if (employee) {
        await supabase.from('employees').update(dataToSave).eq('id', employee.id);
      } else {
        await supabase.from('employees').insert([dataToSave]);
      }

      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{employee ? 'Modifier' : 'Nouvel'} employé</h2>
            <button onClick={onClose}><X className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Matricule *</label>
                <input type="text" required value={formData.employee_number} onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prénom *</label>
                <input type="text" required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nom *</label>
                <input type="text" required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Département</label>
                <select value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Sélectionner</option>
                  {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Poste *</label>
                <input type="text" required value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date d'embauche *</label>
                <input type="date" required value={formData.hire_date} onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Salaire base (GNF)</label>
                <input type="number" value={formData.base_salary} onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Statut</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="active">Actif</option>
                  <option value="on_leave">En congé</option>
                  <option value="terminated">Terminé</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Téléphone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Adresse</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg">Annuler</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg">{loading ? 'Enregistrement...' : employee ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Download, Mail, Edit, Trash2, CheckCircle, DollarSign, Calendar,
  User, Briefcase, TrendingUp, TrendingDown, FileText, Printer
} from 'lucide-react';

interface PayrollDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollId: string;
  onSuccess: () => void;
}

export const PayrollDetailsModal = ({ isOpen, onClose, payrollId, onSuccess }: PayrollDetailsModalProps) => {
  const [loading, setLoading] = useState(true);
  const [payroll, setPayroll] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any>(null);

  useEffect(() => {
    if (isOpen && payrollId) {
      fetchPayrollData();
    }
  }, [isOpen, payrollId]);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      // Récupérer la paie
      const { data: payrollData } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('id', payrollId)
        .single();

      if (payrollData) {
        setPayroll(payrollData);

        // Récupérer l'employé
        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('id', payrollData.employee_id)
          .single();

        setEmployee(empData);

        // Récupérer les trajets de la période
        const { data: tripsData } = await supabase
          .from('trips')
          .select('*, vehicle:vehicles(registration), departure:sites!trips_departure_site_id_fkey(name), arrival:sites!trips_arrival_site_id_fkey(name)')
          .eq('driver_id', payrollData.employee_id)
          .gte('planned_date', payrollData.period_start)
          .lte('planned_date', payrollData.period_end)
          .eq('status', 'completed');

        setTrips(tripsData || []);

        // Récupérer les présences de la période
        const { data: attendanceData } = await supabase
          .from('employee_attendance')
          .select('*')
          .eq('employee_id', payrollData.employee_id)
          .gte('date', payrollData.period_start)
          .lte('date', payrollData.period_end);

        if (attendanceData) {
          const present = attendanceData.filter(a => a.status === 'present').length;
          const absent = attendanceData.filter(a => a.status === 'absent').length;
          const total = attendanceData.length;
          setAttendance({ present, absent, total });
        }
      }
    } catch (error) {
      console.error('Error fetching payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const content = generateBulletinHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSendEmail = async () => {
    if (!employee?.email) {
      alert('Aucun email configuré pour cet employé');
      return;
    }
    alert(`Email envoyé à ${employee.email} (Fonctionnalité à implémenter avec service email)`);
  };

  const handleApprove = async () => {
    if (!confirm('Approuver cette fiche de paie?')) return;
    const { error } = await supabase
      .from('payroll_records')
      .update({ status: 'approved', approval_date: new Date().toISOString() })
      .eq('id', payrollId);

    if (!error) {
      alert('Fiche de paie approuvée');
      fetchPayrollData();
      onSuccess();
    }
  };

  const handlePay = async () => {
    if (!confirm('Marquer cette paie comme payée?')) return;
    const { error } = await supabase
      .from('payroll_records')
      .update({ status: 'paid', payment_date: new Date().toISOString() })
      .eq('id', payrollId);

    if (!error) {
      alert('Paie marquée comme payée');
      fetchPayrollData();
      onSuccess();
    }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement cette fiche de paie?')) return;
    const { error } = await supabase
      .from('payroll_records')
      .delete()
      .eq('id', payrollId);

    if (!error) {
      alert('Fiche de paie supprimée');
      onClose();
      onSuccess();
    }
  };

  const generateBulletinHTML = () => {
    const baseSalary = parseFloat(payroll?.base_salary || 0);
    const bonuses = parseFloat(payroll?.bonuses || 0);
    const overtimePay = parseFloat(payroll?.overtime_pay || 0);
    const socialSecurity = parseFloat(payroll?.social_security || 0);
    const taxAmount = parseFloat(payroll?.tax_amount || 0);
    const otherDeductions = parseFloat(payroll?.deductions || 0) - socialSecurity - taxAmount;
    const grossSalary = baseSalary + bonuses + overtimePay;
    const totalDeductions = socialSecurity + taxAmount + otherDeductions;
    const netSalary = parseFloat(payroll?.net_salary || 0);

    const missionBonus = trips.length * 50000;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bulletin de Paie - ${employee?.first_name} ${employee?.last_name}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
    }
    .bulletin {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      background: white;
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .company-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .company-name {
      font-size: 18pt;
      font-weight: bold;
      color: #1e40af;
    }
    .bulletin-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin: 20px 0;
      color: #1e3a8a;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .info-box {
      width: 48%;
      border: 1px solid #cbd5e1;
      padding: 12px;
      border-radius: 4px;
      background: #f8fafc;
    }
    .info-box h3 {
      font-size: 11pt;
      margin-bottom: 8px;
      color: #1e40af;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .info-line {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 10pt;
    }
    .info-label {
      color: #64748b;
    }
    .info-value {
      font-weight: 600;
      color: #000;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 10pt;
    }
    th {
      background: #1e40af;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:hover {
      background: #f8fafc;
    }
    .amount {
      text-align: right;
      font-weight: 600;
    }
    .section-title {
      background: #f1f5f9;
      padding: 8px 10px;
      font-weight: bold;
      margin-top: 15px;
      border-left: 4px solid #2563eb;
    }
    .total-row {
      background: #dbeafe;
      font-weight: bold;
      font-size: 11pt;
    }
    .net-salary-row {
      background: #10b981;
      color: white;
      font-size: 13pt;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #000;
      margin-top: 60px;
      padding-top: 5px;
      font-size: 10pt;
    }
    .missions-detail {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .note {
      background: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 10px;
      margin: 15px 0;
      font-size: 9pt;
      color: #1e3a8a;
    }
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="bulletin">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <div>
          <div class="company-name">ENTREPRISE TRANSPORT</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">
            Mine de Sangaredi - Guinée Conakry<br>
            Tél: +224 XXX XXX XXX<br>
            Email: rh@entreprise.gn
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10pt; color: #64748b;">
            Bulletin N°: <strong>${payroll?.id.slice(0, 8)}</strong><br>
            Date d'émission: <strong>${new Date().toLocaleDateString('fr-FR')}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="bulletin-title">BULLETIN DE PAIE</div>

    <!-- Informations Employé et Période -->
    <div class="info-section">
      <div class="info-box">
        <h3>👤 Informations Employé</h3>
        <div class="info-line">
          <span class="info-label">Nom complet:</span>
          <span class="info-value">${employee?.first_name} ${employee?.last_name}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Matricule:</span>
          <span class="info-value">${employee?.employee_number}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Poste:</span>
          <span class="info-value">${employee?.position || 'Chauffeur'}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Date d'embauche:</span>
          <span class="info-value">${new Date(employee?.hire_date).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>

      <div class="info-box">
        <h3>📅 Période de Paie</h3>
        <div class="info-line">
          <span class="info-label">Du:</span>
          <span class="info-value">${new Date(payroll?.period_start).toLocaleDateString('fr-FR')}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Au:</span>
          <span class="info-value">${new Date(payroll?.period_end).toLocaleDateString('fr-FR')}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Jours présents:</span>
          <span class="info-value">${attendance?.present || 0} jours</span>
        </div>
        <div class="info-line">
          <span class="info-label">Jours absents:</span>
          <span class="info-value">${attendance?.absent || 0} jours</span>
        </div>
      </div>
    </div>

    <!-- Détail Missions -->
    ${trips.length > 0 ? `
    <div class="missions-detail">
      <strong>🚛 Missions effectuées ce mois:</strong> ${trips.length} trajets<br>
      <div style="font-size: 9pt; margin-top: 5px;">
        Prime par trajet: 50,000 GNF × ${trips.length} = <strong>${missionBonus.toLocaleString()} GNF</strong>
      </div>
    </div>
    ` : ''}

    <!-- Rémunération -->
    <div class="section-title">💰 RÉMUNÉRATION</div>
    <table>
      <thead>
        <tr>
          <th style="width: 60%;">Libellé</th>
          <th style="width: 20%; text-align: center;">Base</th>
          <th style="width: 20%; text-align: right;">Montant (GNF)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Salaire de base</td>
          <td class="amount">${(baseSalary / 1000000).toFixed(1)}M</td>
          <td class="amount">${baseSalary.toLocaleString()}</td>
        </tr>
        ${overtimePay > 0 ? `
        <tr>
          <td>Heures supplémentaires</td>
          <td class="amount">-</td>
          <td class="amount" style="color: #10b981;">+${overtimePay.toLocaleString()}</td>
        </tr>
        ` : ''}
        ${missionBonus > 0 ? `
        <tr style="background: #fef3c7;">
          <td><strong>Prime de mission (${trips.length} trajets × 50k)</strong></td>
          <td class="amount">${trips.length}</td>
          <td class="amount" style="color: #10b981;"><strong>+${missionBonus.toLocaleString()}</strong></td>
        </tr>
        ` : ''}
        ${bonuses > missionBonus ? `
        <tr>
          <td>Autres primes</td>
          <td class="amount">-</td>
          <td class="amount" style="color: #10b981;">+${(bonuses - missionBonus).toLocaleString()}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td colspan="2"><strong>SALAIRE BRUT</strong></td>
          <td class="amount">${grossSalary.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <!-- Déductions -->
    <div class="section-title">➖ DÉDUCTIONS</div>
    <table>
      <thead>
        <tr>
          <th style="width: 60%;">Libellé</th>
          <th style="width: 20%; text-align: center;">Taux</th>
          <th style="width: 20%; text-align: right;">Montant (GNF)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Sécurité sociale (CNSS)</td>
          <td class="amount">5%</td>
          <td class="amount" style="color: #dc2626;">-${socialSecurity.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Impôts sur le revenu (IR)</td>
          <td class="amount">5%</td>
          <td class="amount" style="color: #dc2626;">-${taxAmount.toLocaleString()}</td>
        </tr>
        ${otherDeductions > 0 ? `
        <tr>
          <td>Autres déductions</td>
          <td class="amount">-</td>
          <td class="amount" style="color: #dc2626;">-${otherDeductions.toLocaleString()}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td colspan="2"><strong>TOTAL DÉDUCTIONS</strong></td>
          <td class="amount" style="color: #dc2626;">-${totalDeductions.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <!-- Salaire Net -->
    <table style="margin-top: 20px;">
      <tr class="net-salary-row">
        <td style="padding: 15px;"><strong>SALAIRE NET À PAYER</strong></td>
        <td class="amount" style="padding: 15px; font-size: 16pt;">${netSalary.toLocaleString()} GNF</td>
      </tr>
    </table>

    <div class="note">
      <strong>💡 Note importante:</strong> Ce bulletin de paie est conforme à la législation guinéenne en vigueur.
      Les cotisations sociales et impôts sont prélevés à la source conformément au Code du Travail de Guinée.
    </div>

    <!-- Footer avec signatures -->
    <div class="footer">
      <div class="signature-box">
        <div style="font-weight: bold; margin-bottom: 10px;">L'Employeur</div>
        <div class="signature-line">Signature et Cachet</div>
      </div>
      <div class="signature-box">
        <div style="font-weight: bold; margin-bottom: 10px;">L'Employé</div>
        <div class="signature-line">${employee?.first_name} ${employee?.last_name}</div>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; font-size: 8pt; color: #94a3b8;">
      Document généré le ${new Date().toLocaleString('fr-FR')} • Confidentiel
    </div>
  </div>
</body>
</html>
    `;
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const baseSalary = parseFloat(payroll?.base_salary || 0);
  const bonuses = parseFloat(payroll?.bonuses || 0);
  const overtimePay = parseFloat(payroll?.overtime_pay || 0);
  const socialSecurity = parseFloat(payroll?.social_security || 0);
  const taxAmount = parseFloat(payroll?.tax_amount || 0);
  const netSalary = parseFloat(payroll?.net_salary || 0);
  const missionBonus = trips.length * 50000;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Bulletin de Paie</h2>
              <p className="text-blue-100 mt-1">
                {employee?.first_name} {employee?.last_name} • {employee?.employee_number}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Informations principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Employé
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Matricule:</span>
                  <span className="font-semibold">{employee?.employee_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Poste:</span>
                  <span className="font-semibold">{employee?.position || 'Chauffeur'}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Période
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Du:</span>
                  <span className="font-semibold">
                    {new Date(payroll?.period_start).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Au:</span>
                  <span className="font-semibold">
                    {new Date(payroll?.period_end).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Missions effectuées */}
          {trips.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold mb-2 flex items-center gap-2 text-yellow-900">
                <Briefcase className="w-4 h-4" />
                Missions effectuées: {trips.length} trajets
              </h3>
              <p className="text-sm text-yellow-800">
                Prime de mission: 50,000 GNF × {trips.length} = <strong>{missionBonus.toLocaleString()} GNF</strong>
              </p>
            </div>
          )}

          {/* Rémunération */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-3">Rémunération</h3>
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-slate-50 rounded">
                <span>Salaire de base</span>
                <span className="font-bold">{(baseSalary / 1000000).toFixed(2)}M GNF</span>
              </div>
              {overtimePay > 0 && (
                <div className="flex justify-between p-3 bg-green-50 rounded">
                  <span>Heures supplémentaires</span>
                  <span className="font-bold text-green-600">+{overtimePay.toLocaleString()} GNF</span>
                </div>
              )}
              {missionBonus > 0 && (
                <div className="flex justify-between p-3 bg-green-50 rounded">
                  <span className="font-semibold">Prime de mission ({trips.length} trajets)</span>
                  <span className="font-bold text-green-600">+{missionBonus.toLocaleString()} GNF</span>
                </div>
              )}
            </div>
          </div>

          {/* Déductions */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-3">Déductions</h3>
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-red-50 rounded">
                <span>Sécurité sociale (5%)</span>
                <span className="font-bold text-red-600">-{socialSecurity.toLocaleString()} GNF</span>
              </div>
              <div className="flex justify-between p-3 bg-red-50 rounded">
                <span>Impôts (5%)</span>
                <span className="font-bold text-red-600">-{taxAmount.toLocaleString()} GNF</span>
              </div>
            </div>
          </div>

          {/* Salaire Net */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-green-100 mb-1">Salaire Net à Payer</p>
                <p className="text-3xl font-bold">{(netSalary / 1000000).toFixed(2)}M GNF</p>
              </div>
              <CheckCircle className="w-12 h-12" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <div className="flex flex-wrap gap-3 justify-between">
            <div className="flex gap-3">
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Télécharger PDF
              </button>
              <button
                onClick={handleSendEmail}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Envoyer par email
              </button>
            </div>
            <div className="flex gap-3">
              {payroll?.status === 'draft' && (
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approuver
                </button>
              )}
              {payroll?.status === 'pending' && (
                <button
                  onClick={handlePay}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Marquer payé
                </button>
              )}
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

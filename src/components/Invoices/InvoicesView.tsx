import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, FileText, Users, DollarSign, AlertCircle, Eye, Download,
  Send, Edit, Copy, Trash2, CheckSquare, Filter, Calendar, MoreVertical,
  Mail, Printer, ArrowUpDown, TrendingUp, Clock, RefreshCw
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal';
import { CustomerModal } from './CustomerModal';
import { InvoiceDetailsModal } from './InvoiceDetailsModal';
import { PaymentModal } from './PaymentModal';
import { BulkActionsModal } from './BulkActionsModal';
import { SendInvoiceModal } from './SendInvoiceModal';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  customer_id: string;
  customer: { company_name: string; contact_name: string; email: string } | null;
}

interface Customer {
  id: string;
  customer_number: string;
  customer_type: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  active: boolean;
}

interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  invoice: { invoice_number: string } | null;
  customer: { company_name: string } | null;
}

export const InvoicesView = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers' | 'payments' | 'analytics'>('invoices');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, customersRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(`
            *,
            customer:customers(company_name, contact_name, email)
          `)
          .order('invoice_date', { ascending: false }),
        supabase
          .from('customers')
          .select('*')
          .order('company_name', { ascending: true }),
        supabase
          .from('payments')
          .select(`
            *,
            invoice:invoices(invoice_number),
            customer:customers(company_name)
          `)
          .order('payment_date', { ascending: false })
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      setInvoices(invoicesRes.data || []);
      setCustomers(customersRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (error) {
      console.error('Error fetching invoicing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = (saved: boolean) => {
    setIsInvoiceModalOpen(false);
    setIsCustomerModalOpen(false);
    setIsDetailsModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsBulkActionsModalOpen(false);
    setIsSendModalOpen(false);
    setSelectedItem(null);
    if (saved) {
      fetchData();
    }
  };

  const handleDuplicateInvoice = async (invoice: Invoice) => {
    const newInvoiceNumber = 'INV-' + new Date().toISOString().split('T')[0].replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000);
    const duplicateData = {
      invoice_number: newInvoiceNumber,
      customer_id: invoice.customer_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      subtotal: invoice.total_amount,
      total_amount: invoice.total_amount,
      balance_due: invoice.total_amount,
      amount_paid: 0,
    };

    try {
      const { error } = await supabase.from('invoices').insert([duplicateData]);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error duplicating invoice:', error);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la facture ${invoice.invoice_number} ?`)) return;

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', invoice.id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const handleMarkAsSent = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoice.id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const handleSelectInvoice = (id: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInvoices(newSelected);
  };

  const applyFiltersAndSort = (invs: Invoice[]) => {
    let filtered = [...invs];

    if (searchTerm) {
      filtered = filtered.filter((inv) =>
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((inv) => {
        const invDate = new Date(inv.invoice_date);
        if (dateFilter === 'today') {
          return invDate >= today;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return invDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return invDate >= monthAgo;
        }
        return true;
      });
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
      } else if (sortBy === 'amount') {
        comparison = a.total_amount - b.total_amount;
      } else if (sortBy === 'customer') {
        comparison = (a.customer?.company_name || '').localeCompare(b.customer?.company_name || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredInvoices = applyFiltersAndSort(invoices);
  const filteredCustomers = customers.filter((c) =>
    c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);
  const overdueInvoices = invoices.filter(inv => {
    if (inv.status === 'paid') return false;
    const dueDate = new Date(inv.due_date);
    return dueDate < new Date();
  }).length;

  const avgInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;
  const avgPaymentTime = invoices.filter(inv => inv.status === 'paid').length;

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-slate-100 text-slate-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      draft: 'Brouillon',
      sent: 'Envoyée',
      paid: 'Payée',
      overdue: 'En retard',
      cancelled: 'Annulée',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Espèces',
      bank_transfer: 'Virement bancaire',
      check: 'Chèque',
      mobile_money: 'Mobile Money',
      credit: 'Crédit',
    };
    return labels[method as keyof typeof labels] || method;
  };

  const exportToCSV = () => {
    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    if (activeTab === 'invoices') {
      filename = `factures_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Numéro', 'Date', 'Échéance', 'Client', 'Montant total', 'Montant payé', 'Solde dû', 'Statut'];
      data = filteredInvoices.map(inv => [
        inv.invoice_number,
        new Date(inv.invoice_date).toLocaleDateString('fr-FR'),
        new Date(inv.due_date).toLocaleDateString('fr-FR'),
        inv.customer?.company_name || 'N/A',
        inv.total_amount.toFixed(0),
        inv.amount_paid.toFixed(0),
        inv.balance_due.toFixed(0),
        getStatusLabel(inv.status)
      ]);
    } else if (activeTab === 'customers') {
      filename = `clients_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Numéro client', 'Type', 'Entreprise', 'Contact', 'Email', 'Téléphone', 'Actif'];
      data = filteredCustomers.map(cust => [
        cust.customer_number,
        cust.customer_type,
        cust.company_name,
        cust.contact_name,
        cust.email || 'N/A',
        cust.phone || 'N/A',
        cust.active ? 'Oui' : 'Non'
      ]);
    } else if (activeTab === 'payments') {
      filename = `paiements_${new Date().toISOString().split('T')[0]}.csv`;
      headers = ['Numéro', 'Date', 'Montant', 'Méthode', 'Facture', 'Client'];
      data = payments.map(pay => [
        pay.payment_number,
        new Date(pay.payment_date).toLocaleDateString('fr-FR'),
        pay.amount.toFixed(0),
        getPaymentMethodLabel(pay.payment_method),
        pay.invoice?.invoice_number || 'N/A',
        pay.customer?.company_name || 'N/A'
      ]);
    }

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
          <h1 className="text-3xl font-bold text-slate-900">Facturation</h1>
          <p className="text-slate-600 mt-1">Gestion complète des clients et facturation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            title="Exporter CSV"
          >
            <Download className="w-5 h-5" />
            Exporter
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            title="Actualiser"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {activeTab === 'invoices' && (
            <>
              {selectedInvoices.size > 0 && (
                <button
                  onClick={() => setIsBulkActionsModalOpen(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CheckSquare className="w-5 h-5" />
                  Actions groupées ({selectedInvoices.size})
                </button>
              )}
              <button
                onClick={() => { setSelectedItem(null); setIsInvoiceModalOpen(true); }}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Nouvelle facture
              </button>
            </>
          )}
          {activeTab === 'customers' && (
            <button
              onClick={() => { setSelectedItem(null); setIsCustomerModalOpen(true); }}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouveau client
            </button>
          )}
          {activeTab === 'payments' && (
            <button
              onClick={() => { setSelectedItem(null); setIsPaymentModalOpen(true); }}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouveau paiement
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Revenu total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{(totalRevenue / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-slate-500 mt-0.5">GNF</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Payé</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{(totalPaid / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-slate-500 mt-0.5">GNF</p>
            </div>
            <FileText className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">En attente</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{(totalOutstanding / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-slate-500 mt-0.5">GNF</p>
            </div>
            <Clock className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">En retard</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{overdueInvoices}</p>
              <p className="text-xs text-slate-500 mt-0.5">factures</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'invoices'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Factures
              </div>
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'customers'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Clients
              </div>
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'payments'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Paiements
              </div>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Analyses
              </div>
            </button>
          </div>
        </div>

        {activeTab === 'invoices' && (
          <>
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par numéro ou client..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="draft">Brouillons</option>
                  <option value="sent">Envoyées</option>
                  <option value="paid">Payées</option>
                  <option value="overdue">En retard</option>
                </select>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="all">Toutes les dates</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="date">Trier par date</option>
                  <option value="amount">Trier par montant</option>
                  <option value="customer">Trier par client</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title={sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}
                >
                  <ArrowUpDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">N° Facture</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Échéance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Montant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Payé</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Solde</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                        Aucune facture trouvée
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.has(invoice.id)}
                            onChange={() => handleSelectInvoice(invoice.id)}
                            className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => { setSelectedItem(invoice); setIsDetailsModalOpen(true); }}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            title="Voir les détails"
                          >
                            {invoice.invoice_number}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{invoice.customer?.company_name || '-'}</div>
                          {invoice.customer?.contact_name && (
                            <div className="text-sm text-slate-500">{invoice.customer.contact_name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                          {new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                          {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {((invoice.total_amount || 0) / 1000000).toFixed(2)}M
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-green-600">
                            {((invoice.amount_paid || 0) / 1000000).toFixed(2)}M
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`font-semibold ${(invoice.balance_due || 0) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                            {((invoice.balance_due || 0) / 1000000).toFixed(2)}M
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                            {getStatusLabel(invoice.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setSelectedItem(invoice); setIsDetailsModalOpen(true); }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Voir détails"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => { setSelectedItem(invoice); setIsInvoiceModalOpen(true); }}
                              className="p-1 text-slate-600 hover:bg-slate-50 rounded transition-colors"
                              title="Modifier"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            {invoice.status !== 'paid' && (
                              <button
                                onClick={() => { setSelectedItem(invoice); setIsPaymentModalOpen(true); }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Paiement"
                              >
                                <DollarSign className="w-5 h-5" />
                              </button>
                            )}
                            <div className="relative">
                              <button
                                onClick={() => setActionMenuOpen(actionMenuOpen === invoice.id ? null : invoice.id)}
                                className="p-1 text-slate-600 hover:bg-slate-50 rounded transition-colors"
                                title="Plus d'actions"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              {actionMenuOpen === invoice.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                                  <button
                                    onClick={() => { setSelectedItem(invoice); setIsSendModalOpen(true); setActionMenuOpen(null); }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Send className="w-4 h-4" />
                                    Envoyer par email
                                  </button>
                                  <button
                                    onClick={() => { handleDuplicateInvoice(invoice); setActionMenuOpen(null); }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Copy className="w-4 h-4" />
                                    Dupliquer
                                  </button>
                                  {invoice.status === 'draft' && (
                                    <button
                                      onClick={() => { handleMarkAsSent(invoice); setActionMenuOpen(null); }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Send className="w-4 h-4" />
                                      Marquer comme envoyée
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { handleDeleteInvoice(invoice); setActionMenuOpen(null); }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'customers' && (
          <>
            <div className="p-6 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, numéro ou contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => { setSelectedItem(customer); setIsCustomerModalOpen(true); }}
                    className="bg-slate-50 rounded-lg p-6 border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900">{customer.company_name || customer.contact_name}</h3>
                        <p className="text-sm text-slate-600 mt-1">{customer.customer_number}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${customer.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {customer.active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-4 h-4" />
                        <span>{customer.contact_name}</span>
                      </div>
                      {customer.email && (
                        <div className="text-slate-600">{customer.email}</div>
                      )}
                      {customer.phone && (
                        <div className="text-slate-600">{customer.phone}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'payments' && (
          <div className="p-6">
            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  Aucun paiement enregistré
                </div>
              ) : (
                payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-slate-50 rounded-lg p-6 border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">{payment.payment_number}</h3>
                          <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                            {getPaymentMethodLabel(payment.payment_method)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Client</p>
                            <p className="font-medium text-slate-900">{payment.customer?.company_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Facture</p>
                            <p className="font-medium text-slate-900">{payment.invoice?.invoice_number || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Date</p>
                            <p className="font-medium text-slate-900">
                              {new Date(payment.payment_date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Montant</p>
                            <p className="font-bold text-green-600 text-lg">
                              {((payment.amount || 0) / 1000000).toFixed(2)}M GNF
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5" />
                    <h3 className="font-semibold">Total des factures</h3>
                  </div>
                  <p className="text-3xl font-bold">{invoices.length}</p>
                  <p className="text-sm opacity-90 mt-2">Factures créées</p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <h3 className="font-semibold">Valeur moyenne</h3>
                  </div>
                  <p className="text-3xl font-bold">{(avgInvoiceValue / 1000000).toFixed(1)}M</p>
                  <p className="text-sm opacity-90 mt-2">GNF par facture</p>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5" />
                    <h3 className="font-semibold">Clients actifs</h3>
                  </div>
                  <p className="text-3xl font-bold">{customers.filter(c => c.active).length}</p>
                  <p className="text-sm opacity-90 mt-2">Sur {customers.length} total</p>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Répartition par statut</h3>
                <div className="space-y-3">
                  {['draft', 'sent', 'paid', 'overdue'].map(status => {
                    const count = invoices.filter(inv => inv.status === status).length;
                    const percentage = invoices.length > 0 ? (count / invoices.length) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600">{getStatusLabel(status)}</span>
                          <span className="font-semibold">{count} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              status === 'paid' ? 'bg-green-500' :
                              status === 'sent' ? 'bg-blue-500' :
                              status === 'overdue' ? 'bg-red-500' :
                              'bg-slate-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isInvoiceModalOpen && (
        <InvoiceModal invoice={selectedItem} onClose={handleModalClose} />
      )}

      {isCustomerModalOpen && (
        <CustomerModal customer={selectedItem} onClose={handleModalClose} />
      )}

      {isDetailsModalOpen && (
        <InvoiceDetailsModal invoice={selectedItem} onClose={handleModalClose} />
      )}

      {isPaymentModalOpen && (
        <PaymentModal invoice={selectedItem} onClose={handleModalClose} />
      )}

      {isBulkActionsModalOpen && (
        <BulkActionsModal
          selectedInvoiceIds={Array.from(selectedInvoices)}
          onClose={handleModalClose}
          onComplete={() => {
            setSelectedInvoices(new Set());
            handleModalClose(true);
          }}
        />
      )}

      {isSendModalOpen && (
        <SendInvoiceModal invoice={selectedItem} onClose={handleModalClose} />
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Search, X, Loader2, Truck, User, Fuel, Wrench, FileText, MapPin, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SearchResult {
  type: 'vehicle' | 'driver' | 'trip' | 'fuel' | 'maintenance' | 'invoice' | 'site';
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  link: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal = ({ isOpen, onClose }: GlobalSearchModalProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    const allResults: SearchResult[] = [];

    try {

      const [vehicles, drivers, trips, maintenance, invoices, sites] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, vehicle_number, make, model, vehicle_type, status')
          .or(`vehicle_number.ilike.%${searchQuery}%,make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`)
          .limit(5),
        supabase
          .from('drivers')
          .select('id, first_name, last_name, phone, license_number, status')
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,license_number.ilike.%${searchQuery}%`)
          .limit(5),
        supabase
          .from('trips')
          .select('id, trip_number, status, start_date')
          .ilike('trip_number', `%${searchQuery}%`)
          .limit(5),
        supabase
          .from('fuel_transactions')
          .select('id, transaction_date, quantity_liters, fuel_type')
          .limit(5),
        supabase
          .from('maintenance_orders')
          .select('id, order_number, maintenance_type, status')
          .ilike('order_number', `%${searchQuery}%`)
          .limit(5),
        supabase
          .from('invoices')
          .select('id, invoice_number, status, total_amount')
          .ilike('invoice_number', `%${searchQuery}%`)
          .limit(5),
        supabase
          .from('sites')
          .select('id, name, type, location')
          .ilike('name', `%${searchQuery}%`)
          .limit(5)
      ]);

      if (vehicles.data) {
        vehicles.data.forEach(v => {
          allResults.push({
            type: 'vehicle',
            id: v.id,
            title: v.vehicle_number,
            subtitle: `${v.make} ${v.model} - ${v.vehicle_type}`,
            meta: v.status,
            link: '/vehicles'
          });
        });
      }

      if (drivers.data) {
        drivers.data.forEach(d => {
          allResults.push({
            type: 'driver',
            id: d.id,
            title: `${d.first_name} ${d.last_name}`,
            subtitle: d.license_number || d.phone,
            meta: d.status,
            link: '/drivers'
          });
        });
      }

      if (trips.data) {
        trips.data.forEach(t => {
          allResults.push({
            type: 'trip',
            id: t.id,
            title: t.trip_number,
            subtitle: new Date(t.start_date).toLocaleDateString('fr-FR'),
            meta: t.status,
            link: '/trips'
          });
        });
      }

      if (maintenance.data) {
        maintenance.data.forEach(m => {
          allResults.push({
            type: 'maintenance',
            id: m.id,
            title: m.order_number,
            subtitle: m.maintenance_type,
            meta: m.status,
            link: '/maintenance'
          });
        });
      }

      if (invoices.data) {
        invoices.data.forEach(i => {
          allResults.push({
            type: 'invoice',
            id: i.id,
            title: i.invoice_number,
            subtitle: `${i.total_amount?.toLocaleString()} GNF`,
            meta: i.status,
            link: '/invoices'
          });
        });
      }

      if (sites.data) {
        sites.data.forEach(s => {
          allResults.push({
            type: 'site',
            id: s.id,
            title: s.name,
            subtitle: `${s.type} - ${s.location}`,
            link: '/sites'
          });
        });
      }

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleResultClick(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    window.location.hash = result.link;
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'vehicle': return <Truck className="w-5 h-5" />;
      case 'driver': return <User className="w-5 h-5" />;
      case 'trip': return <MapPin className="w-5 h-5" />;
      case 'fuel': return <Fuel className="w-5 h-5" />;
      case 'maintenance': return <Wrench className="w-5 h-5" />;
      case 'invoice': return <FileText className="w-5 h-5" />;
      case 'site': return <MapPin className="w-5 h-5" />;
      default: return <Search className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vehicle: 'Véhicule',
      driver: 'Chauffeur',
      trip: 'Mission',
      fuel: 'Carburant',
      maintenance: 'Maintenance',
      invoice: 'Facture',
      site: 'Site'
    };
    return labels[type] || type;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20 px-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher véhicules, chauffeurs, missions, factures..."
              className="flex-1 outline-none text-lg"
              autoFocus
            />
            {loading && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {query.length < 2 && (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Tapez au moins 2 caractères pour rechercher</p>
              <div className="mt-4 text-sm">
                <p className="font-medium text-gray-700 mb-2">Recherche dans:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Véhicules', 'Chauffeurs', 'Missions', 'Carburant', 'Maintenance', 'Factures', 'Sites'].map(item => (
                    <span key={item} className="px-2 py-1 bg-gray-100 rounded text-xs">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucun résultat trouvé pour "{query}"</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    result.type === 'vehicle' ? 'bg-blue-100 text-blue-600' :
                    result.type === 'driver' ? 'bg-green-100 text-green-600' :
                    result.type === 'trip' ? 'bg-purple-100 text-purple-600' :
                    result.type === 'fuel' ? 'bg-orange-100 text-orange-600' :
                    result.type === 'maintenance' ? 'bg-red-100 text-red-600' :
                    result.type === 'invoice' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{result.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <span>{result.subtitle}</span>
                      {result.meta && (
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs">
                          {result.meta}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">↑</kbd>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">↓</kbd>
              pour naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Enter</kbd>
              pour sélectionner
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Esc</kbd>
            pour fermer
          </span>
        </div>
      </div>
    </div>
  );
};

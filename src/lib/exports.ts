/**
 * Construit le contenu CSV (sans BOM) a partir de lignes homogenes.
 * Les en-tetes sont les cles de la premiere ligne. Fonction pure, testee
 * dans exports.test.ts.
 */
export const buildCSV = (data: Record<string, unknown>[]): string => {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  return [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');
};

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  const csvContent = buildCSV(data);

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data: any[], filename: string) => {
  exportToCSV(data, filename);
};

export const exportToPDF = (title: string, data: any[], _filename: string) => {
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          color: #2563eb;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 10px;
        }
        .info {
          margin: 20px 0;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 12px 8px;
          text-align: left;
          font-size: 12px;
        }
        th {
          background-color: #2563eb;
          color: white;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
        tr:hover {
          background-color: #eff6ff;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #666;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="info">
        <strong>Date d'export:</strong> ${new Date().toLocaleString('fr-FR')}<br>
        <strong>Nombre d'enregistrements:</strong> ${data.length}
      </div>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(h => `<td>${row[h] !== null && row[h] !== undefined ? row[h] : '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        <strong>DARI HOLDING - SIGTB</strong><br>
        Système d'Information de Gestion du Transport et du Carburant<br>
        © ${new Date().getFullYear()} - Tous droits réservés
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

export const formatDataForExport = (data: any[], type: 'vehicles' | 'drivers' | 'trips' | 'fuel' | 'maintenance' | 'invoices' | 'generic') => {
  switch (type) {
    case 'vehicles':
      return data.map(v => ({
        'Numéro': v.vehicle_number,
        'Type': v.vehicle_type,
        'Marque': v.make,
        'Modèle': v.model,
        'Année': v.year,
        'Statut': v.status,
        'Kilométrage': v.mileage,
        'Capacité': v.capacity_tonnes,
        'Immatriculation': v.registration_number
      }));

    case 'drivers':
      return data.map(d => ({
        'Prénom': d.first_name,
        'Nom': d.last_name,
        'Téléphone': d.phone,
        'Email': d.email,
        'Licence': d.license_number,
        'Type': d.license_type,
        'Expérience': d.years_experience,
        'Statut': d.status
      }));

    case 'trips':
      return data.map(t => ({
        'Numéro': t.trip_number,
        'Véhicule': t.vehicle_id,
        'Chauffeur': t.driver_id,
        'Origine': t.origin_site_id,
        'Destination': t.destination_site_id,
        'Date': t.start_date,
        'Distance': t.distance_km,
        'Carburant': t.fuel_consumed,
        'Statut': t.status
      }));

    case 'fuel':
      return data.map(f => ({
        'Date': f.transaction_date,
        'Véhicule': f.vehicle_id,
        'Station': f.fuel_station_id,
        'Quantité': f.quantity_liters,
        'Prix': f.unit_price_gnf,
        'Total': f.total_cost_gnf,
        'Type': f.fuel_type,
        'Méthode': f.entry_method
      }));

    case 'maintenance':
      return data.map(m => ({
        'Ordre': m.order_number,
        'Véhicule': m.vehicle_id,
        'Type': m.maintenance_type,
        'Description': m.description,
        'Date': m.scheduled_date,
        'Coût': m.total_cost,
        'Statut': m.status
      }));

    case 'invoices':
      return data.map(i => ({
        'Numéro': i.invoice_number,
        'Client': i.customer_id,
        'Date': i.invoice_date,
        'Échéance': i.due_date,
        'Montant HT': i.subtotal,
        'TVA': i.tax_amount,
        'Total TTC': i.total_amount,
        'Statut': i.status
      }));

    default:
      return data;
  }
};

export const printDocument = (elementId: string, title: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Élément à imprimer non trouvé');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #2563eb; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${element.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

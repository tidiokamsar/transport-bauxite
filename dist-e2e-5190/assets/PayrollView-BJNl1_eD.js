import{c as Q,r as d,s as h,j as e,X as Y,Y as W,al as Z,C as _,T as ee,N as z,A as te,ak as se,M as ae,y as I,E as le}from"./index-CFPQLUeU.js";import{C as O}from"./calendar-Dj8E0GXr.js";import{D as B}from"./dollar-sign-hnyRBVBU.js";import{T as ne}from"./trending-down-CLuHKS2i.js";import{D as K}from"./download-Dbr4Wvqr.js";import{P as ie}from"./plus-Dv-Zxbt7.js";import{S as re}from"./square-pen-DE-ICIbw.js";/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=Q("CircleUser",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}],["path",{d:"M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662",key:"154egf"}]]),de=({isOpen:g,onClose:C,payrollId:m,onSuccess:L})=>{const[E,y]=d.useState(!1),[t,w]=d.useState(!1),[l,A]=d.useState([]),[i,S]=d.useState(null),[n,f]=d.useState({employee_id:"",period_start:"",period_end:"",base_salary:0,overtime_pay:0,bonuses:0,deductions:0,tax_amount:0,social_security:0,net_salary:0,status:"draft",payment_method:"Virement bancaire",notes:""});d.useEffect(()=>{if(g)if(v(),m)q();else{const s=new Date,c=new Date(s.getFullYear(),s.getMonth(),1),N=new Date(s.getFullYear(),s.getMonth()+1,0);f({...n,period_start:c.toISOString().split("T")[0],period_end:N.toISOString().split("T")[0]})}},[g,m]);const v=async()=>{const{data:s}=await h.from("employees").select("id, first_name, last_name, employee_number, base_salary, position").eq("status","active").order("first_name");A(s||[])},q=async()=>{if(!m)return;const{data:s}=await h.from("payroll_records").select("*").eq("id",m).maybeSingle();s&&f({employee_id:s.employee_id,period_start:s.period_start,period_end:s.period_end,base_salary:parseFloat(s.base_salary),overtime_pay:parseFloat(s.overtime_pay),bonuses:parseFloat(s.bonuses),deductions:parseFloat(s.deductions),tax_amount:parseFloat(s.tax_amount),social_security:parseFloat(s.social_security),net_salary:parseFloat(s.net_salary),status:s.status,payment_method:s.payment_method||"Virement bancaire",notes:s.notes||""})},G=async()=>{if(!n.employee_id||!n.period_start||!n.period_end){alert("Veuillez sélectionner un employé et une période");return}w(!0);try{const{data:s,error:c}=await h.rpc("calculate_employee_payroll",{p_employee_id:n.employee_id,p_period_start:n.period_start,p_period_end:n.period_end});if(c)throw c;S(s),f({...n,base_salary:parseFloat(s.salary.base_salary),overtime_pay:parseFloat(s.salary.overtime_pay),bonuses:parseFloat(s.salary.mission_bonus),deductions:parseFloat(s.deductions.total_deductions),tax_amount:parseFloat(s.deductions.tax_amount),social_security:parseFloat(s.deductions.social_security),net_salary:parseFloat(s.final.net_salary),notes:s.details.calculation_notes})}catch(s){console.error("Erreur calcul automatique:",s),alert("Erreur lors du calcul automatique: "+s.message)}finally{w(!1)}},$=async s=>{s.preventDefault(),y(!0);try{if(m){const{error:c}=await h.from("payroll_records").update({...n,updated_at:new Date().toISOString()}).eq("id",m);if(c)throw c}else{const{data:c}=await h.from("payroll_records").select("id").eq("employee_id",n.employee_id).eq("period_start",n.period_start).eq("period_end",n.period_end).maybeSingle();if(c)if(confirm("Une fiche de paie existe déjà pour cet employé et cette période. Voulez-vous la mettre à jour?")){const{error:N}=await h.from("payroll_records").update({...n,updated_at:new Date().toISOString()}).eq("id",c.id);if(N)throw N}else{y(!1);return}else{const{error:N}=await h.from("payroll_records").insert({...n});if(N)throw N}}L(),C()}catch(c){alert(c.message||"Erreur")}finally{y(!1)}};return g?e.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:e.jsxs("div",{className:"bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto",children:[e.jsxs("div",{className:"sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl font-bold",children:m?"Modifier Paie":"Générer Paie Automatique"}),e.jsx("p",{className:"text-sm text-slate-600",children:"Toutes les données sont chargées automatiquement depuis les autres modules"})]}),e.jsx("button",{onClick:C,className:"p-2 hover:bg-slate-100 rounded-lg",children:e.jsx(Y,{className:"w-6 h-6"})})]}),e.jsxs("form",{onSubmit:$,className:"p-6 space-y-6",children:[e.jsxs("div",{className:"bg-blue-50 border-2 border-blue-200 rounded-lg p-4",children:[e.jsxs("h3",{className:"font-bold text-blue-900 mb-3 flex items-center gap-2",children:[e.jsx(W,{className:"w-5 h-5"}),"Étape 1: Sélectionner l'employé et la période"]}),e.jsxs("div",{className:"grid grid-cols-3 gap-4",children:[e.jsxs("div",{className:"col-span-3",children:[e.jsx("label",{className:"block text-sm font-medium mb-2",children:"Employé *"}),e.jsxs("select",{required:!0,value:n.employee_id,onChange:s=>{f({...n,employee_id:s.target.value}),S(null)},className:"w-full px-4 py-2 border rounded-lg",children:[e.jsx("option",{value:"",children:"Sélectionner un employé"}),l.map(s=>e.jsxs("option",{value:s.id,children:[s.employee_number," - ",s.first_name," ",s.last_name," (",s.position,")"]},s.id))]})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm font-medium mb-2",children:[e.jsx(O,{className:"w-4 h-4 inline mr-2"}),"Début *"]}),e.jsx("input",{type:"date",required:!0,value:n.period_start,onChange:s=>{f({...n,period_start:s.target.value}),S(null)},className:"w-full px-4 py-2 border rounded-lg"})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm font-medium mb-2",children:[e.jsx(O,{className:"w-4 h-4 inline mr-2"}),"Fin *"]}),e.jsx("input",{type:"date",required:!0,value:n.period_end,onChange:s=>{f({...n,period_end:s.target.value}),S(null)},className:"w-full px-4 py-2 border rounded-lg"})]}),e.jsx("div",{className:"flex items-end",children:e.jsxs("button",{type:"button",onClick:G,disabled:t||!n.employee_id||!n.period_start||!n.period_end,className:"w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center gap-2 font-semibold",children:[e.jsx(Z,{className:"w-5 h-5"}),t?"Calcul en cours...":"Calculer Automatiquement"]})})]})]}),i&&e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"bg-slate-50 rounded-lg p-4",children:[e.jsxs("h3",{className:"font-bold text-slate-900 mb-3 flex items-center gap-2",children:[e.jsx(_,{className:"w-5 h-5 text-green-600"}),"Présences & Heures (depuis module Attendance)"]}),e.jsxs("div",{className:"grid grid-cols-4 gap-4",children:[e.jsxs("div",{className:"bg-white rounded-lg p-3 border",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Jours présents"}),e.jsx("div",{className:"text-2xl font-bold text-green-600",children:i.attendance.days_present})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Jours travaillés"}),e.jsx("div",{className:"text-2xl font-bold text-slate-900",children:i.period.working_days})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Heures régulières"}),e.jsxs("div",{className:"text-2xl font-bold text-blue-600",children:[i.attendance.regular_hours,"h"]})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Heures supplémentaires"}),e.jsxs("div",{className:"text-2xl font-bold text-orange-600",children:[i.attendance.overtime_hours,"h"]})]})]})]}),i.missions.completed_trips>0&&e.jsxs("div",{className:"bg-green-50 rounded-lg p-4 border-2 border-green-200",children:[e.jsxs("h3",{className:"font-bold text-green-900 mb-3 flex items-center gap-2",children:[e.jsx(ee,{className:"w-5 h-5"}),"Missions Complétées (depuis module Trips)"]}),e.jsxs("div",{className:"grid grid-cols-3 gap-4",children:[e.jsxs("div",{className:"bg-white rounded-lg p-3",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Nombre de missions"}),e.jsx("div",{className:"text-3xl font-bold text-green-600",children:i.missions.completed_trips})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Prime par mission"}),e.jsxs("div",{className:"text-xl font-bold text-slate-900",children:[i.missions.bonus_per_trip.toLocaleString()," GNF"]})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Total primes missions"}),e.jsxs("div",{className:"text-xl font-bold text-green-600",children:[i.missions.total_mission_bonus.toLocaleString()," GNF"]})]})]})]}),e.jsxs("div",{className:"bg-white rounded-lg p-4 border-2",children:[e.jsxs("h3",{className:"font-bold text-slate-900 mb-3 flex items-center gap-2",children:[e.jsx(B,{className:"w-5 h-5 text-blue-600"}),"Calcul du Salaire"]}),e.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium mb-2 text-slate-700",children:"Salaire de base (GNF)"}),e.jsx("input",{type:"number",readOnly:!0,value:n.base_salary,className:"w-full px-4 py-2 border rounded-lg bg-slate-50 font-bold text-lg"})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm font-medium mb-2 text-orange-700",children:[e.jsx(z,{className:"w-4 h-4 inline mr-2"}),"Heures supplémentaires (GNF)"]}),e.jsx("input",{type:"number",readOnly:!0,value:n.overtime_pay,className:"w-full px-4 py-2 border rounded-lg bg-orange-50 font-bold text-lg text-orange-700"}),e.jsxs("div",{className:"text-xs text-slate-600 mt-1",children:[i.attendance.overtime_hours,"h × ",(i.details.hourly_rate*1.5).toFixed(0)," GNF/h"]})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm font-medium mb-2 text-green-700",children:[e.jsx(z,{className:"w-4 h-4 inline mr-2"}),"Primes missions (GNF)"]}),e.jsx("input",{type:"number",readOnly:!0,value:n.bonuses,className:"w-full px-4 py-2 border rounded-lg bg-green-50 font-bold text-lg text-green-700"})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm font-medium mb-2 text-red-700",children:[e.jsx(ne,{className:"w-4 h-4 inline mr-2"}),"Déductions totales (GNF)"]}),e.jsx("input",{type:"number",readOnly:!0,value:n.deductions,className:"w-full px-4 py-2 border rounded-lg bg-red-50 font-bold text-lg text-red-700"})]})]})]}),e.jsxs("div",{className:"bg-slate-50 rounded-lg p-4",children:[e.jsx("h3",{className:"font-bold text-slate-900 mb-3",children:"Détails des Déductions"}),e.jsxs("div",{className:"grid grid-cols-4 gap-3",children:[e.jsxs("div",{className:"bg-white rounded p-3 border",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Sécurité sociale (8%)"}),e.jsxs("div",{className:"text-lg font-bold text-slate-900",children:[i.deductions.social_security.toLocaleString()," GNF"]})]}),e.jsxs("div",{className:"bg-white rounded p-3 border",children:[e.jsx("div",{className:"text-xs text-slate-600",children:"Impôts (5%)"}),e.jsxs("div",{className:"text-lg font-bold text-slate-900",children:[i.deductions.tax_amount.toLocaleString()," GNF"]})]}),i.deductions.late_penalties>0&&e.jsxs("div",{className:"bg-white rounded p-3 border",children:[e.jsx("div",{className:"text-xs text-red-600",children:"Pénalités retards"}),e.jsxs("div",{className:"text-lg font-bold text-red-600",children:[i.deductions.late_penalties.toLocaleString()," GNF"]})]}),i.deductions.absence_deduction>0&&e.jsxs("div",{className:"bg-white rounded p-3 border",children:[e.jsxs("div",{className:"text-xs text-red-600",children:["Absences (",i.attendance.days_absent,"j)"]}),e.jsxs("div",{className:"text-lg font-bold text-red-600",children:[i.deductions.absence_deduction.toLocaleString()," GNF"]})]})]})]}),e.jsx("div",{className:"bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white",children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-sm opacity-90",children:"Salaire Net à Payer"}),e.jsxs("div",{className:"text-4xl font-bold mt-1",children:[n.net_salary.toLocaleString()," GNF"]})]}),e.jsx(_,{className:"w-16 h-16 opacity-50"})]})}),i.details.calculation_notes&&e.jsxs("div",{className:"bg-blue-50 rounded-lg p-4 border border-blue-200",children:[e.jsxs("h3",{className:"font-bold text-blue-900 mb-2 flex items-center gap-2",children:[e.jsx(te,{className:"w-5 h-5"}),"Notes de Calcul Automatique"]}),e.jsx("p",{className:"text-sm text-blue-900",children:i.details.calculation_notes})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-4 pt-4 border-t",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium mb-2",children:"Statut"}),e.jsxs("select",{value:n.status,onChange:s=>f({...n,status:s.target.value}),className:"w-full px-4 py-2 border rounded-lg",children:[e.jsx("option",{value:"draft",children:"Brouillon"}),e.jsx("option",{value:"pending",children:"En attente"}),e.jsx("option",{value:"approved",children:"Approuvé"}),e.jsx("option",{value:"paid",children:"Payé"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium mb-2",children:"Méthode de paiement"}),e.jsxs("select",{value:n.payment_method,onChange:s=>f({...n,payment_method:s.target.value}),className:"w-full px-4 py-2 border rounded-lg",children:[e.jsx("option",{children:"Virement bancaire"}),e.jsx("option",{children:"Chèque"}),e.jsx("option",{children:"Espèces"}),e.jsx("option",{children:"Mobile Money"})]})]})]}),e.jsxs("div",{className:"flex gap-3 pt-4 border-t",children:[e.jsx("button",{type:"button",onClick:C,className:"flex-1 px-6 py-3 border rounded-lg hover:bg-slate-50",children:"Annuler"}),e.jsx("button",{type:"submit",disabled:E||!i,className:"flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-semibold",children:E?"Enregistrement...":m?"Modifier":"Créer Fiche de Paie"})]})]})]})}):null},ce=({isOpen:g,onClose:C,payrollId:m,onSuccess:L})=>{const[E,y]=d.useState(!0),[t,w]=d.useState(null),[l,A]=d.useState(null),[i,S]=d.useState([]),[n,f]=d.useState(null);d.useEffect(()=>{g&&m&&v()},[g,m]);const v=async()=>{y(!0);try{const{data:o}=await h.from("payroll_records").select("*").eq("id",m).single();if(o){w(o);const{data:p}=await h.from("employees").select("*").eq("id",o.employee_id).single();A(p);const{data:r}=await h.from("trips").select("*, vehicle:vehicles(registration), departure:sites!trips_departure_site_id_fkey(name), arrival:sites!trips_arrival_site_id_fkey(name)").eq("driver_id",o.employee_id).gte("planned_date",o.period_start).lte("planned_date",o.period_end).eq("status","completed");S(r||[]);const{data:j}=await h.from("employee_attendance").select("*").eq("employee_id",o.employee_id).gte("date",o.period_start).lte("date",o.period_end);if(j){const F=j.filter(k=>k.status==="present").length,D=j.filter(k=>k.status==="absent").length,M=j.length;f({present:F,absent:D,total:M})}}}catch(o){console.error("Error fetching payroll data:",o)}finally{y(!1)}},q=()=>{const o=c(),p=window.open("","_blank");p&&(p.document.write(o),p.document.close(),p.print())},G=async()=>{if(!(l!=null&&l.email)){alert("Aucun email configuré pour cet employé");return}alert(`Email envoyé à ${l.email} (Fonctionnalité à implémenter avec service email)`)},$=async()=>{if(!confirm("Approuver cette fiche de paie?"))return;const{error:o}=await h.from("payroll_records").update({status:"approved",approval_date:new Date().toISOString()}).eq("id",m);o||(alert("Fiche de paie approuvée"),v(),L())},s=async()=>{if(!confirm("Marquer cette paie comme payée?"))return;const{error:o}=await h.from("payroll_records").update({status:"paid",payment_date:new Date().toISOString()}).eq("id",m);o||(alert("Paie marquée comme payée"),v(),L())},c=()=>{const o=parseFloat((t==null?void 0:t.base_salary)||0),p=parseFloat((t==null?void 0:t.bonuses)||0),r=parseFloat((t==null?void 0:t.overtime_pay)||0),j=parseFloat((t==null?void 0:t.social_security)||0),F=parseFloat((t==null?void 0:t.tax_amount)||0),D=parseFloat((t==null?void 0:t.deductions)||0)-j-F,M=o+p+r,k=j+F+D,R=parseFloat((t==null?void 0:t.net_salary)||0),P=i.length*5e4;return`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bulletin de Paie - ${l==null?void 0:l.first_name} ${l==null?void 0:l.last_name}</title>
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
            Bulletin N°: <strong>${t==null?void 0:t.id.slice(0,8)}</strong><br>
            Date d'émission: <strong>${new Date().toLocaleDateString("fr-FR")}</strong>
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
          <span class="info-value">${l==null?void 0:l.first_name} ${l==null?void 0:l.last_name}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Matricule:</span>
          <span class="info-value">${l==null?void 0:l.employee_number}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Poste:</span>
          <span class="info-value">${(l==null?void 0:l.position)||"Chauffeur"}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Date d'embauche:</span>
          <span class="info-value">${new Date(l==null?void 0:l.hire_date).toLocaleDateString("fr-FR")}</span>
        </div>
      </div>

      <div class="info-box">
        <h3>📅 Période de Paie</h3>
        <div class="info-line">
          <span class="info-label">Du:</span>
          <span class="info-value">${new Date(t==null?void 0:t.period_start).toLocaleDateString("fr-FR")}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Au:</span>
          <span class="info-value">${new Date(t==null?void 0:t.period_end).toLocaleDateString("fr-FR")}</span>
        </div>
        <div class="info-line">
          <span class="info-label">Jours présents:</span>
          <span class="info-value">${(n==null?void 0:n.present)||0} jours</span>
        </div>
        <div class="info-line">
          <span class="info-label">Jours absents:</span>
          <span class="info-value">${(n==null?void 0:n.absent)||0} jours</span>
        </div>
      </div>
    </div>

    <!-- Détail Missions -->
    ${i.length>0?`
    <div class="missions-detail">
      <strong>🚛 Missions effectuées ce mois:</strong> ${i.length} trajets<br>
      <div style="font-size: 9pt; margin-top: 5px;">
        Prime par trajet: 50,000 GNF × ${i.length} = <strong>${P.toLocaleString()} GNF</strong>
      </div>
    </div>
    `:""}

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
          <td class="amount">${(o/1e6).toFixed(1)}M</td>
          <td class="amount">${o.toLocaleString()}</td>
        </tr>
        ${r>0?`
        <tr>
          <td>Heures supplémentaires</td>
          <td class="amount">-</td>
          <td class="amount" style="color: #10b981;">+${r.toLocaleString()}</td>
        </tr>
        `:""}
        ${P>0?`
        <tr style="background: #fef3c7;">
          <td><strong>Prime de mission (${i.length} trajets × 50k)</strong></td>
          <td class="amount">${i.length}</td>
          <td class="amount" style="color: #10b981;"><strong>+${P.toLocaleString()}</strong></td>
        </tr>
        `:""}
        ${p>P?`
        <tr>
          <td>Autres primes</td>
          <td class="amount">-</td>
          <td class="amount" style="color: #10b981;">+${(p-P).toLocaleString()}</td>
        </tr>
        `:""}
        <tr class="total-row">
          <td colspan="2"><strong>SALAIRE BRUT</strong></td>
          <td class="amount">${M.toLocaleString()}</td>
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
          <td class="amount" style="color: #dc2626;">-${j.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Impôts sur le revenu (IR)</td>
          <td class="amount">5%</td>
          <td class="amount" style="color: #dc2626;">-${F.toLocaleString()}</td>
        </tr>
        ${D>0?`
        <tr>
          <td>Autres déductions</td>
          <td class="amount">-</td>
          <td class="amount" style="color: #dc2626;">-${D.toLocaleString()}</td>
        </tr>
        `:""}
        <tr class="total-row">
          <td colspan="2"><strong>TOTAL DÉDUCTIONS</strong></td>
          <td class="amount" style="color: #dc2626;">-${k.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <!-- Salaire Net -->
    <table style="margin-top: 20px;">
      <tr class="net-salary-row">
        <td style="padding: 15px;"><strong>SALAIRE NET À PAYER</strong></td>
        <td class="amount" style="padding: 15px; font-size: 16pt;">${R.toLocaleString()} GNF</td>
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
        <div class="signature-line">${l==null?void 0:l.first_name} ${l==null?void 0:l.last_name}</div>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; font-size: 8pt; color: #94a3b8;">
      Document généré le ${new Date().toLocaleString("fr-FR")} • Confidentiel
    </div>
  </div>
</body>
</html>
    `};if(!g)return null;if(E)return e.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",children:e.jsxs("div",{className:"bg-white rounded-lg p-8",children:[e.jsx("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"}),e.jsx("p",{className:"mt-4 text-slate-600",children:"Chargement..."})]})});const N=parseFloat((t==null?void 0:t.base_salary)||0),T=parseFloat((t==null?void 0:t.overtime_pay)||0),a=parseFloat((t==null?void 0:t.social_security)||0),b=parseFloat((t==null?void 0:t.tax_amount)||0),x=parseFloat((t==null?void 0:t.net_salary)||0),u=i.length*5e4;return e.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:e.jsxs("div",{className:"bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col",children:[e.jsx("div",{className:"bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6",children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl font-bold",children:"Bulletin de Paie"}),e.jsxs("p",{className:"text-blue-100 mt-1",children:[l==null?void 0:l.first_name," ",l==null?void 0:l.last_name," • ",l==null?void 0:l.employee_number]})]}),e.jsx("button",{onClick:C,className:"p-2 hover:bg-blue-700 rounded-lg transition-colors",children:e.jsx(Y,{className:"w-6 h-6"})})]})}),e.jsxs("div",{className:"flex-1 overflow-y-auto p-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4 mb-6",children:[e.jsxs("div",{className:"bg-slate-50 rounded-lg p-4",children:[e.jsxs("h3",{className:"font-bold mb-3 flex items-center gap-2",children:[e.jsx(W,{className:"w-4 h-4 text-blue-600"}),"Employé"]}),e.jsxs("div",{className:"space-y-2 text-sm",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-slate-600",children:"Matricule:"}),e.jsx("span",{className:"font-semibold",children:l==null?void 0:l.employee_number})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-slate-600",children:"Poste:"}),e.jsx("span",{className:"font-semibold",children:(l==null?void 0:l.position)||"Chauffeur"})]})]})]}),e.jsxs("div",{className:"bg-slate-50 rounded-lg p-4",children:[e.jsxs("h3",{className:"font-bold mb-3 flex items-center gap-2",children:[e.jsx(O,{className:"w-4 h-4 text-blue-600"}),"Période"]}),e.jsxs("div",{className:"space-y-2 text-sm",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-slate-600",children:"Du:"}),e.jsx("span",{className:"font-semibold",children:new Date(t==null?void 0:t.period_start).toLocaleDateString("fr-FR")})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-slate-600",children:"Au:"}),e.jsx("span",{className:"font-semibold",children:new Date(t==null?void 0:t.period_end).toLocaleDateString("fr-FR")})]})]})]})]}),i.length>0&&e.jsxs("div",{className:"bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6",children:[e.jsxs("h3",{className:"font-bold mb-2 flex items-center gap-2 text-yellow-900",children:[e.jsx(se,{className:"w-4 h-4"}),"Missions effectuées: ",i.length," trajets"]}),e.jsxs("p",{className:"text-sm text-yellow-800",children:["Prime de mission: 50,000 GNF × ",i.length," = ",e.jsxs("strong",{children:[u.toLocaleString()," GNF"]})]})]}),e.jsxs("div",{className:"mb-6",children:[e.jsx("h3",{className:"font-bold text-lg mb-3",children:"Rémunération"}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex justify-between p-3 bg-slate-50 rounded",children:[e.jsx("span",{children:"Salaire de base"}),e.jsxs("span",{className:"font-bold",children:[(N/1e6).toFixed(2),"M GNF"]})]}),T>0&&e.jsxs("div",{className:"flex justify-between p-3 bg-green-50 rounded",children:[e.jsx("span",{children:"Heures supplémentaires"}),e.jsxs("span",{className:"font-bold text-green-600",children:["+",T.toLocaleString()," GNF"]})]}),u>0&&e.jsxs("div",{className:"flex justify-between p-3 bg-green-50 rounded",children:[e.jsxs("span",{className:"font-semibold",children:["Prime de mission (",i.length," trajets)"]}),e.jsxs("span",{className:"font-bold text-green-600",children:["+",u.toLocaleString()," GNF"]})]})]})]}),e.jsxs("div",{className:"mb-6",children:[e.jsx("h3",{className:"font-bold text-lg mb-3",children:"Déductions"}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex justify-between p-3 bg-red-50 rounded",children:[e.jsx("span",{children:"Sécurité sociale (5%)"}),e.jsxs("span",{className:"font-bold text-red-600",children:["-",a.toLocaleString()," GNF"]})]}),e.jsxs("div",{className:"flex justify-between p-3 bg-red-50 rounded",children:[e.jsx("span",{children:"Impôts (5%)"}),e.jsxs("span",{className:"font-bold text-red-600",children:["-",b.toLocaleString()," GNF"]})]})]})]}),e.jsx("div",{className:"bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6 mb-6",children:e.jsxs("div",{className:"flex justify-between items-center",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-green-100 mb-1",children:"Salaire Net à Payer"}),e.jsxs("p",{className:"text-3xl font-bold",children:[(x/1e6).toFixed(2),"M GNF"]})]}),e.jsx(_,{className:"w-12 h-12"})]})})]}),e.jsx("div",{className:"border-t border-slate-200 p-6 bg-slate-50",children:e.jsxs("div",{className:"flex flex-wrap gap-3 justify-between",children:[e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{onClick:q,className:"px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2",children:[e.jsx(K,{className:"w-4 h-4"}),"Télécharger PDF"]}),e.jsxs("button",{onClick:G,className:"px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2",children:[e.jsx(ae,{className:"w-4 h-4"}),"Envoyer par email"]})]}),e.jsxs("div",{className:"flex gap-3",children:[(t==null?void 0:t.status)==="draft"&&e.jsxs("button",{onClick:$,className:"px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2",children:[e.jsx(_,{className:"w-4 h-4"}),"Approuver"]}),(t==null?void 0:t.status)==="pending"&&e.jsxs("button",{onClick:s,className:"px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2",children:[e.jsx(_,{className:"w-4 h-4"}),"Marquer payé"]})]})]})})]})})},fe=()=>{const[g,C]=d.useState([]),[m,L]=d.useState(!0),[E,y]=d.useState(!1),[t,w]=d.useState();d.useState(null);const[l,A]=d.useState(!1),[i,S]=d.useState(""),[n,f]=d.useState({status:"all",month:new Date().toISOString().slice(0,7)});d.useEffect(()=>{v()},[n]);const v=async()=>{L(!0);let a=h.from("payroll_records").select("*, employee:employees(first_name, last_name, employee_number)").order("period_start",{ascending:!1});if(n.status!=="all"&&(a=a.eq("status",n.status)),n.month){const[x,u]=n.month.split("-"),o=`${x}-${u}-01`,p=new Date(parseInt(x),parseInt(u),0).getDate(),r=`${x}-${u}-${p}`;a=a.gte("period_start",o).lte("period_start",r)}const{data:b}=await a.limit(50);C(b||[]),L(!1)},q=async a=>{await h.from("payroll_records").update({status:"approved",approval_date:new Date().toISOString()}).eq("id",a),v()},G=async a=>{await h.from("payroll_records").update({status:"paid",payment_date:new Date().toISOString()}).eq("id",a),v()},$=a=>{S(a),A(!0)},s=()=>{w(void 0),y(!0)},c={total:g.reduce((a,b)=>a+parseFloat(b.net_salary),0),pending:g.filter(a=>a.status==="pending").length,paid:g.filter(a=>a.status==="paid").length,records:g.length},N=a=>{const b={draft:{label:"Brouillon",color:"bg-slate-100 text-slate-700",icon:I},pending:{label:"En attente",color:"bg-orange-100 text-orange-700",icon:I},approved:{label:"Approuvé",color:"bg-blue-100 text-blue-700",icon:_},paid:{label:"Payé",color:"bg-green-100 text-green-700",icon:_}},x=b[a]||b.draft,u=x.icon;return e.jsxs("span",{className:`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${x.color}`,children:[e.jsx(u,{className:"w-3 h-3"}),x.label]})},T=()=>{const a=`paie_${n.month||"all"}_${new Date().toISOString().split("T")[0]}.csv`,b=["Numéro employé","Nom","Prénom","Période début","Période fin","Jours travaillés","Salaire de base","Primes missions","Primes performances","Bonus","Autres primes","Total primes","Déductions","Salaire brut","Salaire net","Statut","Date paiement"],x=g.map(r=>{var j,F,D,M,k,R,P,U,V,X,H,J;return[((j=r.employee)==null?void 0:j.employee_number)||"N/A",((F=r.employee)==null?void 0:F.last_name)||"N/A",((D=r.employee)==null?void 0:D.first_name)||"N/A",new Date(r.period_start).toLocaleDateString("fr-FR"),new Date(r.period_end).toLocaleDateString("fr-FR"),r.days_worked||0,((M=r.base_salary)==null?void 0:M.toFixed(0))||"0",((k=r.mission_bonuses)==null?void 0:k.toFixed(0))||"0",((R=r.performance_bonuses)==null?void 0:R.toFixed(0))||"0",((P=r.other_bonuses)==null?void 0:P.toFixed(0))||"0",((U=r.additional_allowances)==null?void 0:U.toFixed(0))||"0",((V=r.total_bonuses)==null?void 0:V.toFixed(0))||"0",((X=r.deductions)==null?void 0:X.toFixed(0))||"0",((H=r.gross_salary)==null?void 0:H.toFixed(0))||"0",((J=r.net_salary)==null?void 0:J.toFixed(0))||"0",r.status==="paid"?"Payé":r.status==="approved"?"Approuvé":r.status==="pending"?"En attente":"Brouillon",r.payment_date?new Date(r.payment_date).toLocaleDateString("fr-FR"):"N/A"]}),u=[b.join(","),...x.map(r=>r.map(j=>`"${j}"`).join(","))].join(`
`),o=new Blob(["\uFEFF"+u],{type:"text/csv;charset=utf-8;"}),p=document.createElement("a");p.href=URL.createObjectURL(o),p.download=a,p.click()};return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-3xl font-bold",children:"Gestion de la Paie"}),e.jsx("p",{className:"text-slate-600 mt-1",children:"Calcul automatique des salaires et bulletin de paie"})]}),e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{onClick:T,className:"px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2",title:"Exporter CSV",children:[e.jsx(K,{className:"w-5 h-5"}),"Exporter"]}),e.jsxs("button",{onClick:s,className:"px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2",children:[e.jsx(ie,{className:"w-5 h-5"}),"Générer Paie"]})]})]}),e.jsx("div",{className:"grid grid-cols-4 gap-6",children:[{label:"Total Salaires",value:`${(c.total/1e6).toFixed(1)}M GNF`,color:"blue",icon:B},{label:"Enregistrements",value:c.records,color:"green",icon:z},{label:"En attente",value:c.pending,color:"orange",icon:I},{label:"Payés",value:c.paid,color:"green",icon:_}].map(({label:a,value:b,color:x,icon:u})=>e.jsx("div",{className:`bg-${x}-600 text-white p-6 rounded-lg`,children:e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx(u,{className:"w-8 h-8 opacity-80"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm opacity-90",children:a}),e.jsx("p",{className:"text-3xl font-bold",children:b})]})]})},a))}),e.jsxs("div",{className:"bg-white rounded-xl border p-6",children:[e.jsxs("div",{className:"grid grid-cols-2 gap-4 mb-6",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium mb-2",children:"Statut"}),e.jsxs("select",{value:n.status,onChange:a=>f({...n,status:a.target.value}),className:"w-full px-4 py-2 border rounded-lg",children:[e.jsx("option",{value:"all",children:"Tous"}),e.jsx("option",{value:"draft",children:"Brouillon"}),e.jsx("option",{value:"pending",children:"En attente"}),e.jsx("option",{value:"approved",children:"Approuvé"}),e.jsx("option",{value:"paid",children:"Payé"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium mb-2",children:"Période"}),e.jsx("input",{type:"month",value:n.month,onChange:a=>f({...n,month:a.target.value}),className:"w-full px-4 py-2 border rounded-lg"})]})]}),m?e.jsx("div",{className:"flex justify-center py-12",children:e.jsx("div",{className:"animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"})}):e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:"bg-slate-50",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Employé"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Période"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Salaire Base"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"H. Supp."}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Primes"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Déductions"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Salaire Net"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Statut"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase",children:"Actions"})]})}),e.jsx("tbody",{className:"divide-y",children:g.map(a=>{var b,x,u;return e.jsxs("tr",{className:"hover:bg-slate-50",children:[e.jsx("td",{className:"px-6 py-4",children:e.jsxs("button",{onClick:()=>$(a.id),className:"text-left hover:text-blue-600 transition-colors",children:[e.jsxs("div",{className:"font-medium flex items-center gap-2",children:[e.jsx(oe,{className:"w-4 h-4"}),(b=a.employee)==null?void 0:b.first_name," ",(x=a.employee)==null?void 0:x.last_name]}),e.jsx("div",{className:"text-sm text-slate-600",children:(u=a.employee)==null?void 0:u.employee_number})]})}),e.jsx("td",{className:"px-6 py-4 text-sm",children:new Date(a.period_start).toLocaleDateString("fr-FR",{month:"short",year:"numeric"})}),e.jsxs("td",{className:"px-6 py-4 text-sm font-medium",children:[(parseFloat(a.base_salary)/1e3).toFixed(0),"k GNF"]}),e.jsxs("td",{className:"px-6 py-4 text-sm",children:[(parseFloat(a.overtime_pay)/1e3).toFixed(0),"k"]}),e.jsxs("td",{className:"px-6 py-4",children:[e.jsxs("button",{onClick:()=>$(a.id),className:"text-sm text-blue-600 hover:text-blue-800 font-medium",children:[(parseFloat(a.bonuses)/1e3).toFixed(0),"k GNF"]}),a.notes&&e.jsx("div",{className:"text-xs text-slate-500 mt-0.5",children:a.notes})]}),e.jsxs("td",{className:"px-6 py-4 text-sm text-red-600",children:["-",(parseFloat(a.deductions)+parseFloat(a.tax_amount)+parseFloat(a.social_security))/1e3,"k"]}),e.jsx("td",{className:"px-6 py-4",children:e.jsxs("div",{className:"font-bold text-green-600",children:[(parseFloat(a.net_salary)/1e3).toFixed(0),"k GNF"]})}),e.jsx("td",{className:"px-6 py-4",children:N(a.status)}),e.jsx("td",{className:"px-6 py-4",children:e.jsxs("div",{className:"flex gap-1",children:[e.jsx("button",{onClick:()=>$(a.id),className:"p-1 text-slate-600 hover:bg-slate-100 rounded",title:"Voir détails",children:e.jsx(le,{className:"w-4 h-4"})}),e.jsx("button",{onClick:()=>{w(a.id),y(!0)},className:"p-1 text-blue-600 hover:bg-blue-50 rounded",title:"Modifier",children:e.jsx(re,{className:"w-4 h-4"})}),a.status==="pending"&&e.jsx("button",{onClick:()=>q(a.id),className:"p-1 text-green-600 hover:bg-green-50 rounded",title:"Approuver",children:e.jsx(_,{className:"w-4 h-4"})}),a.status==="approved"&&e.jsx("button",{onClick:()=>G(a.id),className:"p-1 text-green-600 hover:bg-green-50 rounded",title:"Marquer comme payé",children:e.jsx(B,{className:"w-4 h-4"})})]})})]},a.id)})})]})})]}),e.jsx(de,{isOpen:E,onClose:()=>{y(!1),w(void 0)},payrollId:t,onSuccess:v}),e.jsx(ce,{isOpen:l,onClose:()=>A(!1),payrollId:i,onSuccess:v}),!1]})};export{fe as PayrollView};

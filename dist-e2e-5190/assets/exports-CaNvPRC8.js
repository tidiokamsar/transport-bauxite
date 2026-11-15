const d=o=>{if(o.length===0)return"";const n=Object.keys(o[0]);return[n.join(","),...o.map(l=>n.map(r=>{const t=l[r];if(t==null)return"";const e=String(t);return e.includes(",")||e.includes('"')||e.includes(`
`)?`"${e.replace(/"/g,'""')}"`:e}).join(","))].join(`
`)},c=(o,n)=>{if(!o||o.length===0){alert("Aucune donnée à exporter");return}const l=d(o),r=new Blob(["\uFEFF"+l],{type:"text/csv;charset=utf-8;"}),t=document.createElement("a"),e=URL.createObjectURL(r);t.setAttribute("href",e),t.setAttribute("download",`${n}_${new Date().toISOString().split("T")[0]}.csv`),t.style.visibility="hidden",document.body.appendChild(t),t.click(),document.body.removeChild(t)},a=(o,n,l)=>{const r=n.length>0?Object.keys(n[0]):[],t=`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${o}</title>
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
      <h1>${o}</h1>
      <div class="info">
        <strong>Date d'export:</strong> ${new Date().toLocaleString("fr-FR")}<br>
        <strong>Nombre d'enregistrements:</strong> ${n.length}
      </div>
      <table>
        <thead>
          <tr>
            ${r.map(i=>`<th>${i}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${n.map(i=>`
            <tr>
              ${r.map(s=>`<td>${i[s]!==null&&i[s]!==void 0?i[s]:"-"}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">
        <strong>SIGTB</strong><br>
        Système d'Information de Gestion du Transport et du Carburant<br>
        © ${new Date().getFullYear()} - Tous droits réservés
      </div>
    </body>
    </html>
  `,e=window.open("","_blank");e&&(e.document.write(t),e.document.close(),setTimeout(()=>{e.print()},250))};export{a,d as b,c as e};

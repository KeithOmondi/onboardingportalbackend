export const generateGuestListHtml = (judgeName: string, guests: any[]) => {
  const tableRows = guests
    .map(
      (g, index) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td style="font-weight: bold;">${g.name || "—"}</td>
      <td><span class="badge">${g.type?.toUpperCase() || "GUEST"}</span></td>
      <td>${g.id_number || g.birth_cert_number || "N/A"}</td>
      <td>${g.phone || "N/A"}</td>
    </tr>
  `,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1a1a1a; }
        .header { border-bottom: 3px solid #1a3a32; margin-bottom: 30px; padding-bottom: 10px; position: relative; }
        .title { font-size: 20pt; color: #1a3a32; font-weight: bold; text-transform: uppercase; }
        .subtitle { font-size: 10pt; color: #c2a336; font-weight: bold; letter-spacing: 2px; }
        
        .meta-container { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .meta-box { display: flex; flex-direction: column; }
        .meta-label { font-size: 8pt; color: #64748b; font-weight: bold; text-transform: uppercase; }
        .meta-value { font-size: 11pt; color: #1e293b; font-weight: bold; }

        table { width: 100%; border-collapse: collapse; }
        th { background: #1a3a32; color: white; padding: 12px 8px; text-align: left; font-size: 9pt; text-transform: uppercase; }
        td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10pt; color: #334155; }
        tr:nth-child(even) { background-color: #fcfcfc; }
        
        .badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: bold; border: 1px solid #e2e8f0; }
        .footer { margin-top: 50px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Official Guest List</div>
        <div class="subtitle">Judiciary of Kenya · Swearing-In Ceremony</div>
      </div>

      <div class="meta-container">
        <div class="meta-box">
          <span class="meta-label">Judicial Officer</span>
          <span class="meta-value">${judgeName}</span>
        </div>
        <div class="meta-box" style="text-align: right;">
          <span class="meta-label">Total Guests</span>
          <span class="meta-value">${guests.length} Registered</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Guest Full Name</th>
            <th>Type</th>
            <th>ID / Birth Cert</th>
            <th>Phone Number</th>
          </tr>
        </thead>
        <tbody>
          ${guests.length > 0 ? tableRows : '<tr><td colspan="5" style="text-align:center; padding: 40px;">No guests registered for this officer.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        Generated on ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}<br>
        Judiciary Onboarding Portal · Secure Document
      </div>
    </body>
    </html>
  `;
};

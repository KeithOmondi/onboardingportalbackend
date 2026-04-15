export const generatePreferencesHtml = (rows: any[]) => {
  const tableRows = rows.map(row => `
    <tr>
      <td>${row.full_name}</td>
      <td>
        <span class="badge ${row.ceremony_choice === 'oath' ? 'badge-oath' : 'badge-affirmation'}">
          ${row.ceremony_choice.toUpperCase()}
        </span>
      </td>
      <td>${row.religious_text || '<em>N/A (Non-religious)</em>'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600&family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Barlow', 'Helvetica', sans-serif;
          color: #1a1c1e;
          background: #fff;
          line-height: 1.5;
        }

        /* ── TOP ACCENT BAR ── */
        .top-bar {
          height: 6px;
          background: linear-gradient(to right, #1a2744, #2b3f6e, #1a2744);
        }

        /* ── LETTERHEAD ── */
        .letterhead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 40px 18px;
          border-bottom: 1px solid #e0e0e0;
        }

        .letterhead-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Coat-of-arms placeholder — swap src for real logos */
        .logo-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-img {
          height: 64px;
          width: auto;
          object-fit: contain;
        }

        .logo-divider {
          width: 1px;
          height: 50px;
          background: #ccc;
        }

        .letterhead-center {
          text-align: center;
          flex: 1;
          padding: 0 24px;
        }

        .org-name {
          font-family: 'Barlow Condensed', 'Barlow', sans-serif;
          font-size: 15pt;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #1a2744;
          text-transform: uppercase;
          line-height: 1.2;
        }

        .republic-line {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 6px 0 10px;
        }

        .republic-rule {
          flex: 1;
          max-width: 70px;
          height: 1px;
          background: #aaa;
        }

        .republic-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 8pt;
          letter-spacing: 4px;
          color: #666;
          text-transform: uppercase;
        }

        .audit-badge {
          display: inline-block;
          border: 1.5px solid #2a7d6f;
          color: #2a7d6f;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 8.5pt;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 4px 14px;
        }

        .letterhead-right {
          text-align: right;
        }

        .qr-placeholder {
          width: 64px;
          height: 64px;
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 6pt;
          color: #aaa;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          text-align: center;
          line-height: 1.4;
        }

        .verify-label {
          font-size: 6pt;
          letter-spacing: 1.5px;
          color: #aaa;
          text-transform: uppercase;
          margin-top: 4px;
          text-align: center;
        }

        /* ── BOTTOM ACCENT BAR ── */
        .bottom-bar {
          height: 4px;
          background: linear-gradient(to right, #1a2744 60%, #2a7d6f 100%);
          margin-bottom: 36px;
        }

        /* ── BODY CONTENT ── */
        .content {
          padding: 0 40px 40px;
        }

        .report-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14pt;
          font-weight: 700;
          letter-spacing: 1px;
          color: #1a2744;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .report-meta {
          font-size: 9pt;
          color: #888;
          margin-bottom: 24px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }

        th {
          background: #1a2744;
          color: #e8c96a;
          padding: 11px 14px;
          text-align: left;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 9pt;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        td {
          padding: 11px 14px;
          border-bottom: 1px solid #eee;
          font-size: 10.5pt;
          color: #2c2c2c;
        }

        tr:hover td { background: #f9f9f9; }

        .badge {
          padding: 3px 10px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          display: inline-block;
        }

        .badge-oath {
          background: #fdf6e8;
          color: #a07820;
          border: 1px solid #c9a040;
        }

        .badge-affirmation {
          background: #eaf4f1;
          color: #2a7d6f;
          border: 1px solid #2a7d6f;
        }

        /* ── FOOTER ── */
        .footer {
          margin-top: 48px;
          padding: 16px 0 0;
          border-top: 1px solid #e0e0e0;
          font-size: 7.5pt;
          color: #bbb;
          text-align: center;
          letter-spacing: 0.5px;
        }
      </style>
    </head>
    <body>

      <div class="top-bar"></div>

      <div class="letterhead">
        <!-- LEFT: Logos -->
        <div class="letterhead-left">
          <div class="logo-group">
            <!--
              Replace these <img> tags with real logo paths, e.g.:
              <img class="logo-img" src="https://highcourtonboardingportal.vercel.app/assets/JOB_LOGO-BVSN6J2X.jpg" alt="Republic of Kenya">
       
            -->
            <div style="font-size:7pt;color:#aaa;text-align:center;width:60px;line-height:1.4;">REPUBLIC<br>OF KENYA<br>[LOGO]</div>
            <div class="logo-divider"></div>
            <div style="font-size:7pt;color:#aaa;text-align:center;width:60px;line-height:1.4;">JUDICIARY<br>[SEAL]</div>
          </div>
        </div>

        <!-- CENTER: Title block -->
        <div class="letterhead-center">
          <div class="org-name">Office of the Registrar High Court</div>
          <div class="republic-line">
            <div class="republic-rule"></div>
            <span class="republic-text">Republic of Kenya</span>
            <div class="republic-rule"></div>
          </div>
          <span class="audit-badge">SWEARING IN PREFERENCE AUDIT</span>
        </div>

        <!-- RIGHT: QR Code -->
        <div class="letterhead-right">
          <div class="qr-placeholder">QR<br>CODE</div>
          <div class="verify-label">Verify Report</div>
        </div>
      </div>

      <div class="bottom-bar"></div>

      <div class="content">
        <div class="report-title">Swearing-In Preferences Report</div>
        <div class="report-meta">
          Office of the Registrar High Court &nbsp;|&nbsp;
          Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>

        <table>
          <thead>
            <tr>
              <th>Judicial Officer</th>
              <th>Ceremony Choice</th>
              <th>Sacred Text / Reference</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          This is an official document generated by the High Court Judges Onboarding Portal.
        </div>
      </div>

    </body>
    </html>
  `;
};
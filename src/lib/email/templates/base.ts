export function baseLayout(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;}
  .container{max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
  .header{background:linear-gradient(135deg,#7c3aed,#4f46e5,#2563eb);padding:32px 40px;color:white;}
  .header h1{margin:0 0 4px;font-size:22px;font-weight:800;}
  .header p{margin:0;opacity:0.75;font-size:13px;}
  .body{padding:32px 40px;}
  .footer{padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;}
  .badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;}
  .badge-red{background:#fee2e2;color:#dc2626;}
  .badge-yellow{background:#fef9c3;color:#ca8a04;}
  .badge-green{background:#dcfce7;color:#16a34a;}
  .badge-blue{background:#dbeafe;color:#2563eb;}
  .btn{display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;margin:16px 0;}
  .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:16px 0;}
  .info-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;}
  .info-row:last-child{border-bottom:none;}
  .info-label{color:#64748b;font-weight:600;}
  .info-value{color:#1e293b;font-weight:500;}
  h2{font-size:18px;font-weight:800;color:#1e293b;margin-bottom:8px;}
  p{color:#475569;font-size:14px;line-height:1.6;margin:8px 0;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>AssetXAI</h1>
    <p>Asset Management &amp; Ticketing Platform</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} AssetXAI. This is an automated notification — please do not reply directly.<br/>
    <a href="{{unsubscribe}}" style="color:#94a3b8;">Manage Notifications</a>
  </div>
</div>
</body>
</html>`;
}

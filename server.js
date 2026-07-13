// SKINYZ — servidor estático + endpoint de booking con emails HTML (Resend)
// Variables de entorno (Railway → Variables):
//   RESEND_API_KEY  → obligatoria para los correos bonitos (resend.com, gratis 100/día)
//   MANAGER_EMAIL   → correo de David, el manager: recibe las solicitudes
//                     (por defecto david@skinyz.com)
//   FROM_EMAIL      → remitente. Por defecto 'SKINYZ <onboarding@resend.dev>'.
//                     Para producción real: verificar skinyz.com en Resend y usar
//                     'SKINYZ <booking@skinyz.com>'
// Sin RESEND_API_KEY el endpoint devuelve 503 y la web cae sola a FormSubmit.
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const MANAGER = process.env.MANAGER_EMAIL || process.env.ARTIST_EMAIL || 'david@skinyz.com';
const FROM = process.env.FROM_EMAIL || 'SKINYZ <onboarding@resend.dev>';

/* ==================== utilidades ==================== */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

function validar(f) {
  const errors = {};
  if (!f.nombre || String(f.nombre).trim().length < 2) errors.nombre = 'min2';
  if (!isEmail(f.email)) errors.email = 'email';
  if (!f.mensaje || String(f.mensaje).trim().length < 10) errors.mensaje = 'min10';
  return { ok: Object.keys(errors).length === 0, errors };
}

function fechaBonita(iso) {
  try {
    if (!iso) return '—';
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return esc(iso); }
}

/* ==================== plantillas de email (SKINYZ) ==================== */
const FF = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function shell(preheader, titulo, cuerpo, ctaHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SKINYZ</title>
<!--[if mso]><style>table{border-collapse:collapse}.grad{background:#47d6ff !important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;font-family:${FF};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#eef2f6;">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f6;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">

  <!-- cabecera SKINYZ -->
  <tr><td align="center" style="background-color:#04060b;padding:36px 40px 28px;border-radius:16px 16px 0 0;">
    <div style="color:#eaf6ff;font-size:26px;font-weight:800;letter-spacing:10px;font-family:${FF};">SKINYZ</div>
    <div style="color:#47d6ff;font-size:11px;letter-spacing:5px;padding-top:8px;">&#9670; DJ &middot; LIVE SETS &middot; CLUB &amp; FESTIVAL &#9670;</div>
  </td></tr>

  <!-- barra de hielo -->
  <tr><td class="grad" style="height:4px;background:linear-gradient(90deg,#bfeaff,#47d6ff 50%,#2fa8e0);font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- cuerpo -->
  <tr><td style="background-color:#0a1424;padding:36px 40px;">
    <h1 style="margin:0 0 18px;color:#a8e6ff;font-size:19px;font-weight:700;line-height:1.35;font-family:${FF};">${titulo}</h1>
    ${cuerpo}
    ${ctaHtml || ''}
  </td></tr>

  <!-- pie -->
  <tr><td style="background-color:#0a1424;padding:0 40px 32px;border-radius:0 0 16px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-top:1px solid #16283d;padding-top:22px;" align="center">
        <p style="margin:0 0 10px;font-size:12px;">
          <a href="https://www.instagram.com/skinyz/" style="color:#47d6ff;text-decoration:none;">Instagram</a>
          <span style="color:#33465c;">&nbsp;&bull;&nbsp;</span>
          <a href="https://soundcloud.com/isidro-hernandez-gonzalez" style="color:#47d6ff;text-decoration:none;">SoundCloud</a>
          <span style="color:#33465c;">&nbsp;&bull;&nbsp;</span>
          <a href="https://open.spotify.com/artist/6jcPqkBKfky0zK1hkLArlJ" style="color:#47d6ff;text-decoration:none;">Spotify</a>
        </p>
        <p style="margin:0;font-size:11px;color:#5b6f85;">SKINYZ &middot; Booking 2027/28 &middot; coded by Highkey Labs</p>
      </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

function filaDato(label, valorHtml, primera) {
  const bt = primera ? '' : 'border-top:1px solid #16283d;';
  return `<tr>
    <td style="padding:10px 16px 10px 0;color:#7e93a8;font-weight:600;font-size:12px;letter-spacing:.06em;text-transform:uppercase;width:130px;vertical-align:top;${bt}">${label}</td>
    <td style="padding:10px 0;color:#eaf6ff;font-size:14px;line-height:1.55;${bt}">${valorHtml}</td>
  </tr>`;
}

function tablaDatos(d) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;">
    ${filaDato('Nombre', esc(d.nombre), true)}
    ${filaDato('Email', `<a href="mailto:${esc(d.email)}" style="color:#47d6ff;text-decoration:none;">${esc(d.email)}</a>`)}
    ${filaDato('Fecha', fechaBonita(d.fecha))}
    ${filaDato('Ciudad / sala', d.ciudad ? esc(d.ciudad) : '—')}
    ${filaDato('Mensaje', esc(d.mensaje).replace(/\n/g, '<br>'))}
  </table>`;
}

function boton(url, texto) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 4px;">
    <tr><td class="grad" style="background:linear-gradient(115deg,#bfeaff,#47d6ff 55%,#2fa8e0);border-radius:10px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 34px;color:#03151f;font-size:14px;font-weight:700;letter-spacing:.08em;text-decoration:none;font-family:${FF};">${texto}</a>
    </td></tr>
  </table>`;
}

function emailParaDavid(d) {
  const cuerpo = `
    <p style="margin:0 0 18px;font-size:14px;color:#cfdeeb;line-height:1.7;">Ha entrado una nueva solicitud desde la web. Datos:</p>
    ${tablaDatos(d)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
      <tr><td style="background-color:#0d1f33;padding:16px 18px;border-radius:10px;border-left:4px solid #47d6ff;">
        <p style="margin:0;font-size:13px;color:#a8c4dd;line-height:1.6;">Responde a este correo y tu respuesta le llegará directamente al cliente.</p>
      </td></tr>
    </table>`;
  return {
    subject: '◆ Nueva solicitud de contratación — ' + d.nombre,
    html: shell('Nueva solicitud de booking de ' + d.nombre, '&#9670; Nueva solicitud de contratación', cuerpo,
      boton('mailto:' + encodeURIComponent(d.email), 'Responder al cliente'))
  };
}

function emailParaCliente(d) {
  const nombre = String(d.nombre).trim().split(/\s+/)[0];
  const cuerpo = `
    <p style="margin:0 0 16px;font-size:14px;color:#cfdeeb;line-height:1.7;">Hola ${esc(nombre)},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#cfdeeb;line-height:1.7;">
      Tu solicitud de contrataci&oacute;n ha llegado correctamente al equipo de SKINYZ.
      Te respondemos con disponibilidad y condiciones en <strong style="color:#eaf6ff;">24&ndash;48&nbsp;h laborables</strong>.
    </p>
    <p style="margin:0 0 6px;font-size:12px;color:#7e93a8;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">Resumen de tu solicitud</p>
    ${tablaDatos(d)}
    <p style="margin:20px 0 0;font-size:13px;color:#7e93a8;line-height:1.6;">Mientras tanto, dale una escucha a los &uacute;ltimos sets.</p>`;
  return {
    subject: 'Solicitud recibida ◆ SKINYZ te responde en 24–48 h',
    html: shell('Recibida — el equipo te responde en 24–48 h', 'Solicitud recibida &#9670;', cuerpo,
      boton('https://open.spotify.com/artist/6jcPqkBKfky0zK1hkLArlJ', 'Escuchar a SKINYZ'))
  };
}

/* ==================== envío vía Resend ==================== */
function resendSend(msg) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(msg);
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let out = '';
      res.on('data', (c) => { out += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(out);
        else reject(new Error('Resend ' + res.statusCode + ': ' + out.slice(0, 300)));
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

/* ==================== endpoint de booking ==================== */
function handleBooking(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end('{"error":"method"}');
  }
  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 64 * 1024) req.destroy();
  });
  req.on('end', async () => {
    let d;
    try { d = JSON.parse(raw); } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end('{"error":"json"}');
    }
    const v = validar(d);
    if (!v.ok) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'validacion', errors: v.errors }));
    }
    if (!RESEND_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end('{"error":"sin-clave"}'); // la web cae sola a FormSubmit
    }
    try {
      const a = emailParaDavid(d);
      await resendSend({ from: FROM, to: [MANAGER], reply_to: String(d.email).trim(), subject: a.subject, html: a.html });
    } catch (e) {
      console.error('fallo email manager:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end('{"error":"envio-manager"}');
    }
    let clientMail = true;
    try {
      const c = emailParaCliente(d);
      await resendSend({ from: FROM, to: [String(d.email).trim()], reply_to: MANAGER, subject: c.subject, html: c.html });
    } catch (e) {
      console.error('fallo email cliente:', e.message);
      clientMail = false; // la solicitud ya está en manos del manager: éxito igualmente
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clientMail }));
  });
}

/* ==================== estático ==================== */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (e) {
    res.writeHead(400); return res.end('Bad request');
  }

  if (urlPath === '/api/booking') return handleBooking(req, res);

  let file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  if (urlPath === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'index.html');
  }

  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log('SKINYZ sirviendo en el puerto ' + PORT + (RESEND_KEY ? ' · emails Resend ON' : ' · sin RESEND_API_KEY (fallback FormSubmit)'));
});

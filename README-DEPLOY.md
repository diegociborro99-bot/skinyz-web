# SKINYZ — Deploy a Railway

Carpeta lista para desplegar. La web es `index.html` y `server.js` la sirve (Node puro, sin dependencias, build en segundos).

## Antes de desplegar (1 minuto)

1. Abre `index.html` y busca `ARTIST_EMAIL` (línea marcada con ⚠️). Cambia `BOOKING@SKINYZ.COM` por el correo real del artista.
2. Tras el primer envío del formulario, FormSubmit mandará un correo de activación a esa dirección: hay que pulsar el enlace una vez y listo.

## Opción A — Railway CLI (recomendada, ~2 min)

```bash
npm i -g @railway/cli
cd skinyz-deploy
railway login
railway init          # crea el proyecto (dale un nombre: skinyz)
railway up            # sube y despliega
```

Cuando termine: en el dashboard de Railway → tu servicio → **Settings → Networking → Generate Domain**. Te dará una URL tipo `skinyz-production.up.railway.app`.

## Opción B — Desde GitHub

1. Sube esta carpeta a un repositorio de GitHub.
2. En [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** → elige el repo.
3. Railway detecta Node y arranca con `node server.js` automáticamente.
4. **Settings → Networking → Generate Domain** para tener URL pública.

## Dominio propio (opcional)

En **Settings → Networking → Custom Domain** añade `skinyz.com` (o el que compréis) y crea el registro CNAME que te indique Railway en el proveedor del dominio.

## Actualizar la web más adelante

Sustituye `index.html` por la nueva versión y vuelve a ejecutar `railway up` (opción A) o haz push al repo (opción B).

# SKINYZ — Deploy a Railway

La web es `index.html` y `server.js` la sirve (Node puro, sin dependencias) y además envía los correos de booking.

## Correos con plantilla SKINYZ (Resend)

El servidor trae el endpoint `/api/booking` que envía dos correos HTML con la estética de la web: la solicitud a David (con "responder" directo al cliente) y la confirmación al cliente. Variables en Railway → tu servicio → **Variables**:

| Variable | Valor | Obligatoria |
|---|---|---|
| `RESEND_API_KEY` | API key de [resend.com](https://resend.com) (gratis, 100 correos/día) | Sí, para las plantillas |
| `MANAGER_EMAIL` | Correo de David, el manager (por defecto `david@skinyz.com`) | No |
| `FROM_EMAIL` | `SKINYZ <booking@skinyz.com>` una vez verificado el dominio | No |

Pasos: cuenta en resend.com → API Keys → crear clave → pegarla en Railway como `RESEND_API_KEY` → redeploy.

**Importante (Resend):** sin dominio verificado, Resend solo entrega al correo del dueño de la cuenta. Para que la confirmación llegue a cualquier cliente: Resend → Domains → añadir `skinyz.com` → crear los registros DNS que indique → poner `FROM_EMAIL` = `SKINYZ <booking@skinyz.com>`.

**Mientras no haya `RESEND_API_KEY`**, la web usa FormSubmit automáticamente (tabla simple a David + texto plano al cliente). Su activación: el primer envío manda un enlace a david@skinyz.com — un clic, una vez.

## Desplegar / actualizar

Con el repo `diegociborro99-bot/skinyz-web` conectado a Railway, cada push despliega:

```bash
cd ~/Desktop/skinyz-deploy
git add . && git commit -m "emails con plantilla SKINYZ" && git push
```

URL pública: Settings → Networking → Generate Domain. Dominio propio: Custom Domain + CNAME.

## Probar los correos en local (opcional)

```bash
RESEND_API_KEY=re_xxxx node server.js
# y abre http://localhost:3000
```

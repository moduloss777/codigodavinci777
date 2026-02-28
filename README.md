# 🔗 Acortador de URLs - Guía de Despliegue

## Estructura del proyecto
```
url-shortener/
├── index.js          ← Servidor principal
├── public/
│   └── index.html    ← Panel de administración
├── package.json
├── .env.example      ← Copia a .env y configura
└── db.json           ← Se genera automáticamente (base de datos)
```

---

## 🚀 Desplegar en Render

### Paso 1 - Subir a GitHub
```bash
git init
git add .
git commit -m "Acortador de URLs"
git remote add origin https://github.com/TU_USUARIO/url-shortener.git
git push -u origin main
```

### Paso 2 - Crear servicio en Render
1. Ve a https://render.com → New → **Web Service**
2. Conecta tu repositorio de GitHub
3. Configuración:
   - **Name:** url-shortener (o el nombre que quieras)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`

### Paso 3 - Variables de entorno en Render
En la sección "Environment Variables" agrega:
| Key | Value |
|-----|-------|
| `ADMIN_KEY` | TuClaveSecretaAquí |
| `BASE_URL` | https://tu-dominio.com |

---

## 🌐 Configurar dominio personalizado (Namesilo)

### En Render:
1. Ve a tu servicio → **Settings** → **Custom Domains**
2. Agrega tu dominio, por ejemplo: `tudominio.pro`
3. Render te dará un CNAME como: `url-shortener.onrender.com`

### En Namesilo:
1. Ve a **Manage DNS** de tu dominio
2. Agrega un registro CNAME:
   - **Host:** `@` (para el dominio raíz) o un subdominio como `go`
   - **Value:** `url-shortener.onrender.com`
   - **TTL:** 3600

### Para subdominio (ej: go.tudominio.pro):
- **Host:** `go`
- **Value:** `url-shortener.onrender.com`

---

## 📡 Uso de la API

### Crear enlace único
```bash
curl -X POST https://tudominio.pro/api/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: TuClaveSecreta" \
  -d '{"url": "https://destino.com", "code": "mi-codigo"}'
```

### Generar 100 enlaces masivos
```bash
curl -X POST https://tudominio.pro/api/bulk \
  -H "Content-Type: application/json" \
  -H "x-api-key: TuClaveSecreta" \
  -d '{"url": "https://destino.com", "count": 100, "prefix": "promo-"}'
```

### Listar todos los enlaces
```bash
curl https://tudominio.pro/api/list?key=TuClaveSecreta
```

### Eliminar enlace
```bash
curl -X DELETE https://tudominio.pro/api/delete/CODIGO \
  -H "x-api-key: TuClaveSecreta"
```

---

## ⚠️ Nota importante sobre Render (plan gratuito)
El plan gratuito de Render "duerme" el servicio tras 15 min de inactividad.
El archivo `db.json` se **resetea** en cada deploy o reinicio.

**Para persistencia real**, considera:
- Usar **Render Disk** (plan de pago)
- Migrar a **MongoDB Atlas** (gratuito) - dime si quieres que lo integre

# 🚀 Guía de Deployment - Multi-Location Analytics

## Opción 1: Usar tu propio servidor con dominio HTTPS

### Requisitos:
- Un servidor con IP pública (VPS, Cloud, etc.)
- Un dominio con certificado SSL válido
- Node.js 20+ instalado

### Pasos:

1. **Configurar tu dominio en Shopify**
```bash
# En lugar de usar el túnel, especifica tu dominio
shopify app dev --tunnel-url https://tu-dominio.com:3000
```

2. **Configurar variables de entorno**
```bash
# Crea un archivo .env
SHOPIFY_APP_URL=https://tu-dominio.com
PORT=3000
```

3. **Actualizar shopify.app.toml**
```toml
[build]
dev_store_url = "pitagora-2.myshopify.com"

[application_url]
url = "https://tu-dominio.com"

[webhooks]
api_version = "2024-01"
```

## Opción 2: Usar ngrok (más estable que Cloudflare)

1. **Instalar ngrok**
```bash
# macOS
brew install ngrok

# O descarga desde https://ngrok.com/download
```

2. **Crear cuenta gratuita en ngrok**
- Ve a https://ngrok.com y regístrate
- Obtén tu authtoken

3. **Configurar ngrok**
```bash
ngrok config add-authtoken TU_TOKEN_AQUI
```

4. **Ejecutar la app con ngrok**
```bash
# Terminal 1: Ejecutar la app localmente
npm run build
npm run preview

# Terminal 2: Crear túnel con ngrok
ngrok http 3000
```

5. **Usar la URL de ngrok en Shopify**
```bash
shopify app dev --tunnel-url https://TU-SUBDOMINIO.ngrok.io
```

## Opción 3: Deployment en producción (Recomendado)

### En un VPS (DigitalOcean, Linode, etc.)

1. **Preparar el servidor**
```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 para mantener la app corriendo
sudo npm install -g pm2

# Instalar nginx
sudo apt-get install nginx
```

2. **Clonar y construir la app**
```bash
git clone TU_REPO
cd multi-location-analytics
npm install
npm run build
```

3. **Configurar nginx como proxy**
```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. **Ejecutar con PM2**
```bash
# Crear archivo ecosystem.config.js
module.exports = {
  apps: [{
    name: 'shopify-app',
    script: 'npm',
    args: 'run preview',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      SHOPIFY_APP_URL: 'https://tu-dominio.com'
    }
  }]
}

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Opción 4: Usar Docker

1. **Crear Dockerfile**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview"]
```

2. **Crear docker-compose.yml**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SHOPIFY_APP_URL=https://tu-dominio.com
    restart: unless-stopped
```

3. **Ejecutar con Docker**
```bash
docker-compose up -d
```

## Opción 5: Deployment en servicios cloud

### Render.com (Gratis con limitaciones)
1. Conecta tu repo de GitHub
2. Configura las variables de entorno
3. Deploy automático con cada push

### Railway.app
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### Fly.io
```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

## Configuración de desarrollo local estable

Para desarrollo local sin túneles:

1. **Crear archivo .env.local**
```env
SHOPIFY_APP_URL=https://localhost:3000
SHOPIFY_API_KEY=tu_api_key
SHOPIFY_API_SECRET=tu_api_secret
SCOPES=read_products,read_inventory,read_locations,read_orders
HOST=localhost
```

2. **Configurar SSL local**
```bash
# Generar certificado local
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

3. **Modificar vite.config.js**
```javascript
import { defineConfig } from 'vite'
import fs from 'fs'

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem')
    },
    port: 3000
  }
})
```

## Tips para estabilidad

1. **Usar subdominios dedicados**
   - app.tu-dominio.com para la app
   - api.tu-dominio.com para webhooks

2. **Configurar webhooks correctamente**
   ```javascript
   // En shopify.server.js
   webhooks: {
     APP_UNINSTALLED: {
       deliveryMethod: DeliveryMethod.Http,
       callbackUrl: "https://tu-dominio.com/webhooks"
     }
   }
   ```

3. **Monitoreo con UptimeRobot**
   - Configura checks cada 5 minutos
   - Alertas por email/SMS si se cae

4. **Logs centralizados**
   ```bash
   # Con PM2
   pm2 logs
   pm2 install pm2-logrotate
   ```

¿Cuál opción prefieres? Puedo ayudarte a configurar la que mejor se adapte a tu infraestructura.
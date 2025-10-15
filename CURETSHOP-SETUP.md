# 🚀 Configuración Multi-Location Analytics en curetshop.com

## Paso 1: Configurar Subdominio en Squarespace

### En Squarespace:
1. Ve a **Settings > Domains > curetshop.com**
2. Haz clic en **DNS Settings**
3. Agrega un nuevo registro A:
   - **Host**: `shopify` (esto creará shopify.curetshop.com)
   - **Points to**: La IP de tu servidor Contabo
   - **TTL**: 3600

### Obtén la IP de tu servidor Contabo:
```bash
# Conecta a tu servidor Contabo
ssh root@tu-servidor-contabo

# Obtén la IP
curl ifconfig.me
```

## Paso 2: Configurar la App Localmente

### Ejecuta estos comandos en tu computadora local:

```bash
# 1. Actualizar shopify.app.toml
cat > shopify.app.toml << 'EOF'
# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "b83f71fae506fd71b7f2c2b880d2402f"
name = "multi-location-analytics"
application_url = "https://shopify.curetshop.com"
embedded = true

[build]
automatically_update_urls_on_dev = false
include_config_on_deploy = true
dev_store_url = "pitagora-2.myshopify.com"

[webhooks]
api_version = "2026-01"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"

  [[webhooks.subscriptions]]
  topics = [ "app/scopes_update" ]
  uri = "/webhooks/app/scopes_update"

[access_scopes]
scopes = "read_products,read_inventory,read_locations,read_orders,read_analytics,read_metaobjects,write_metaobjects"

[auth]
redirect_urls = [ "https://shopify.curetshop.com/api/auth" ]

[pos]
embedded = false
EOF

# 2. Crear archivo de configuración de producción
cat > .env.production << 'EOF'
SHOPIFY_APP_URL=https://shopify.curetshop.com
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
EOF

# 3. Crear configuración PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'curet-analytics',
    script: 'npm',
    args: 'run preview',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      SHOPIFY_APP_URL: 'https://shopify.curetshop.com',
      HOST: '0.0.0.0'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# 4. Commit los cambios
git add .
git commit -m "Configurar para shopify.curetshop.com"
git push
```

## Paso 3: Configurar Servidor Contabo

### Conecta a tu servidor:
```bash
ssh root@tu-ip-contabo
```

### Ejecuta este script de instalación:
```bash
#!/bin/bash
# Script de instalación en Contabo

# 1. Actualizar sistema
apt update && apt upgrade -y

# 2. Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Instalar nginx y certbot
apt-get install -y nginx certbot python3-certbot-nginx git

# 4. Instalar PM2
npm install -g pm2

# 5. Crear directorio para la app
mkdir -p /var/www
cd /var/www

# 6. Clonar tu repositorio
git clone https://github.com/TU_USUARIO/multi-location-analytics.git
cd multi-location-analytics

# 7. Instalar dependencias y construir
npm install
npm run build

# 8. Crear directorio de logs
mkdir -p logs

# 9. Configurar nginx
cat > /etc/nginx/sites-available/shopify.curetshop.com << 'NGINX'
server {
    listen 80;
    server_name shopify.curetshop.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name shopify.curetshop.com;

    # SSL se configurará con certbot
    
    # Headers para Shopify
    add_header X-Frame-Options "ALLOWALL" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX

# 10. Activar sitio nginx
ln -s /etc/nginx/sites-available/shopify.curetshop.com /etc/nginx/sites-enabled/
nginx -t

# 11. Obtener certificado SSL
certbot --nginx -d shopify.curetshop.com --non-interactive --agree-tos -m tu@email.com

# 12. Reiniciar nginx
systemctl reload nginx

# 13. Iniciar app con PM2
cd /var/www/multi-location-analytics
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Paso 4: Actualizar en Shopify Partners

1. Ve a [Shopify Partners](https://partners.shopify.com)
2. Selecciona tu app "Multi-Location Analytics"
3. Ve a **Configuration**
4. Actualiza:
   - **App URL**: `https://shopify.curetshop.com`
   - **Allowed redirection URL(s)**: `https://shopify.curetshop.com/api/auth`
5. Click en **Save**

## Paso 5: Reinstalar la App

### Opción A: Desde el CLI (en tu servidor):
```bash
cd /var/www/multi-location-analytics
shopify app generate extension --type=app_link
```

### Opción B: Manual:
1. Desinstala la app de tu tienda
2. Ve a: https://shopify.curetshop.com
3. Instala nuevamente

## 🔧 Comandos Útiles en el Servidor

```bash
# Ver logs en tiempo real
pm2 logs

# Reiniciar app
pm2 restart curet-analytics

# Ver estado
pm2 status

# Monitorear
pm2 monit

# Ver logs de nginx
tail -f /var/log/nginx/error.log

# Actualizar app
cd /var/www/multi-location-analytics
git pull
npm install
npm run build
pm2 restart all
```

## 🚨 Troubleshooting

### Si el DNS no resuelve:
1. Espera 5-10 minutos para propagación DNS
2. Prueba: `nslookup shopify.curetshop.com`

### Si hay error de SSL:
```bash
# Renovar certificado
certbot renew --nginx
```

### Si la app no carga:
```bash
# Verificar que esté corriendo
pm2 list

# Ver errores
pm2 logs --err

# Verificar nginx
nginx -t
systemctl status nginx
```

## 📝 Checklist Final

- [ ] Subdominio configurado en Squarespace
- [ ] App instalada en servidor Contabo
- [ ] Certificado SSL activo
- [ ] Nginx configurado y funcionando
- [ ] PM2 ejecutando la app
- [ ] URLs actualizadas en Shopify Partners
- [ ] App reinstalada en tu tienda

¿Necesitas ayuda con algún paso específico?
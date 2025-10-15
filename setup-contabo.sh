#!/bin/bash

# Script de configuración para Multi-Location Analytics en Contabo
# =================================================================

echo "🚀 Configurando Multi-Location Analytics en Contabo"
echo "=================================================="
echo ""

# Solicitar información del usuario
read -p "Ingresa tu dominio/subdominio (ej: app.tudominio.com): " DOMAIN
read -p "Ingresa el puerto para la app (default: 3000): " PORT
PORT=${PORT:-3000}

# Validar dominio
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo "❌ Error: Dominio inválido"
    exit 1
fi

echo ""
echo "📝 Configurando con:"
echo "   Dominio: https://$DOMAIN"
echo "   Puerto: $PORT"
echo ""

# 1. Actualizar shopify.app.toml
echo "1️⃣ Actualizando shopify.app.toml..."
cat > shopify.app.toml << EOF
# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "b83f71fae506fd71b7f2c2b880d2402f"
name = "multi-location-analytics"
application_url = "https://$DOMAIN"
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
redirect_urls = [ "https://$DOMAIN/api/auth" ]

[pos]
embedded = false

EOF

# 2. Crear archivo .env para producción
echo "2️⃣ Creando archivo .env.production..."
cat > .env.production << EOF
# Configuración de producción
SHOPIFY_APP_URL=https://$DOMAIN
NODE_ENV=production
PORT=$PORT
EOF

# 3. Crear script de deployment para PM2
echo "3️⃣ Creando ecosystem.config.js para PM2..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'multi-location-analytics',
    script: './node_modules/.bin/shopify',
    args: 'app serve',
    env: {
      NODE_ENV: 'production',
      PORT: $PORT,
      SHOPIFY_APP_URL: 'https://$DOMAIN',
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

# 4. Crear configuración de nginx
echo "4️⃣ Creando configuración de nginx..."
cat > nginx-config.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration (actualiza las rutas según tu certificado)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de seguridad
    add_header X-Frame-Options "ALLOWALL" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Configuración del proxy
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts para evitar desconexiones
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 5. Crear script de instalación en el servidor
echo "5️⃣ Creando script de instalación remota..."
cat > install-on-server.sh << 'SCRIPT'
#!/bin/bash

# Script para ejecutar en el servidor Contabo
echo "🚀 Instalando Multi-Location Analytics en el servidor"

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar herramientas necesarias
sudo apt-get install -y git nginx certbot python3-certbot-nginx

# Instalar PM2 globalmente
sudo npm install -g pm2

# Clonar repositorio (ajustar según tu repo)
cd /var/www
sudo git clone [TU_REPO_URL] multi-location-analytics
cd multi-location-analytics

# Instalar dependencias
npm install

# Construir la aplicación
npm run build

# Crear directorio de logs
mkdir -p logs

# Configurar certificado SSL
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m tu@email.com

# Copiar configuración de nginx
sudo cp nginx-config.conf /etc/nginx/sites-available/multi-location-analytics
sudo ln -s /etc/nginx/sites-available/multi-location-analytics /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER

echo "✅ Instalación completada!"
SCRIPT

chmod +x install-on-server.sh

# 6. Instrucciones finales
echo ""
echo "✅ Configuración generada exitosamente!"
echo ""
echo "📋 SIGUIENTES PASOS:"
echo ""
echo "1. En tu servidor Contabo:"
echo "   a) Asegúrate de tener el dominio $DOMAIN apuntando a tu servidor"
echo "   b) Copia este proyecto al servidor"
echo "   c) Ejecuta: ./install-on-server.sh"
echo ""
echo "2. En Shopify Partners:"
echo "   a) Ve a tu app en el dashboard"
echo "   b) Actualiza la App URL a: https://$DOMAIN"
echo "   c) Actualiza los Redirect URLs a: https://$DOMAIN/api/auth"
echo ""
echo "3. Comandos útiles en el servidor:"
echo "   - Ver logs: pm2 logs"
echo "   - Reiniciar: pm2 restart all"
echo "   - Monitorear: pm2 monit"
echo ""
echo "📌 IMPORTANTE: Recuerda actualizar la configuración en Shopify Partners!"
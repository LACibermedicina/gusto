# GUSTO · Nginx do host · produção em / e homologação em /teste/ · gerado por deploy/setup-vps.sh
server {
    listen 80;
    listen [::]:80;
    server_name @DOMINIO@;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name @DOMINIO@;

    ssl_certificate     /etc/letsencrypt/live/@DOMINIO@/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/@DOMINIO@/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:gusto_ssl:10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    client_max_body_size 1m;
    server_tokens off;

    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        $gusto_connection_upgrade;
    proxy_read_timeout 75s;

    # ---- homologação (branch teste): o prefixo /teste é removido antes de chegar à app ----
    location = /teste { return 301 /teste/; }
    location /teste/ {
        add_header X-Robots-Tag "noindex, nofollow" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        proxy_pass http://127.0.0.1:@PORTA_TESTE@/;
    }
    location = /teste/os-ws {
        proxy_pass http://127.0.0.1:@PORTA_TESTE@/os-ws;
        proxy_read_timeout 3600s;
    }

    # ---- produção (branch main) ----
    location = /os-ws {
        proxy_pass http://127.0.0.1:@PORTA_PROD@;
        proxy_read_timeout 3600s;
    }
    location / {
        proxy_pass http://127.0.0.1:@PORTA_PROD@;
    }
}

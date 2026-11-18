# Gusto · pacote de instalação (Linux)

Instala o app e a API do Gusto em um servidor **Debian/Ubuntu** (20.04+), com PostgreSQL, serviço systemd, nginx e HTTPS (Let's Encrypt), acessível pelo **subdomínio** e pela **porta** que você escolher.

## Antes de começar
1. Servidor com acesso root e 1 GB de RAM ou mais.
2. **DNS:** crie um registro `A` do subdomínio (ex.: `gusto.seudominio.com`) apontando para o IP do servidor.
3. Libere no firewall/provedor as portas **80** (certificado) e a **porta pública** escolhida.

## Instalar
```bash
tar xzf gusto-install.tar.gz && cd gusto-install
sudo ./install.sh --domain gusto.seudominio.com --port 3000 --public-port 8443 --email voce@seudominio.com
```
| Opção | Função | Padrão |
|---|---|---|
| `--domain` | subdomínio de acesso (obrigatório) | |
| `--port` | porta interna do app (só em 127.0.0.1) | 3000 |
| `--public-port` | porta pública do subdomínio no nginx | 443 |
| `--email` | e-mail do Let's Encrypt | opcional |
| `--no-tls` | sem HTTPS, só para teste | |

O endereço final é `https://SUBDOMINIO:PORTA` (sem `:porta` quando for 443). O instalador pede a senha inicial do **root**; ela é guardada com bcrypt e a API exige a troca no primeiro acesso. Rodar o instalador de novo atualiza o app e aplica migrações novas, mantendo o banco e os segredos.

## O que é instalado
`/opt/gusto/app` (código) · `/etc/gusto/gusto.env` (segredos, permissão 640) · serviço `gusto` · site nginx `gusto-SUBDOMINIO.conf` · banco `gusto` com usuário próprio de privilégio mínimo · backup diário em `/var/backups/gusto` (14 dias) · renovação automática do certificado.

## Operação
```bash
systemctl status gusto          # estado        journalctl -u gusto -f   # logs
systemctl restart gusto         # reiniciar     curl http://127.0.0.1:3000/health
zcat /var/backups/gusto/gusto-AAAA-MM-DD.sql.gz | sudo -u postgres psql gusto   # restaurar (em banco vazio)
sudo ./uninstall.sh             # remove serviço e nginx, mantém dados   (--purge apaga tudo)
```

## Mapa e localização
O mapa vintage usa a localização do navegador (com sua permissão) e consulta o OpenStreetMap (Overpass API) para desenhar as ruas reais da sua região; as coordenadas, arredondadas, são enviadas a esse serviço público. Sem permissão ou sem rede, o app mostra um desenho ilustrativo. A função Fiscal só existe para usuários criados pelo administrador.

## Limites atuais (leia)
- **Duas camadas de login.** A API tem login real (cookie de sessão, bcrypt, root e permissões no banco). A interface (`public/index.html`) ainda usa o login e os dados locais do navegador, como no protótipo. Ligar a interface à API é o próximo passo.
- **HTTPS é necessário** para a interface (o login usa recursos que o navegador só libera em conexão segura). `--no-tls` só serve para teste.
- **IA do app:** o assistente funciona apenas dentro do claude.ai; neste servidor a interface usa a busca local. Para IA própria é preciso uma chave de API e uma rota no servidor.
- **Pagamentos:** o provedor padrão é `mock`. Para receber de verdade, configure um provedor (`PAYMENTS_PROVIDER=http`, `PSP_API_URL`, `PSP_API_KEY`, `WEBHOOK_SECRET`) em `/etc/gusto/gusto.env` e ajuste `verify()`/`charge()` no `server.js`.
- Não há envio de fotos/vídeos (apenas links) nem cálculo real de rotas.
- Pacote validado quanto à sintaxe e à geração das configurações; ainda não foi executado num servidor real.

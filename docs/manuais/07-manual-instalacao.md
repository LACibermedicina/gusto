# Manual de Instalação (servidor Linux)

## Requisitos
- Debian ou Ubuntu (20.04 ou mais novo), acesso root, 1 GB de RAM ou mais.
- Um **subdomínio** com registro DNS `A` apontando para o IP do servidor.
- Portas **80** (certificado) e a **porta pública** escolhida liberadas no firewall.

## Instalar
```bash
tar xzf gusto-install.tar.gz && cd gusto-install
sudo ./install.sh --domain gusto.seudominio.com --port 3000 --public-port 8443 --email voce@seudominio.com
```
| Opção | Função | Padrão |
|---|---|---|
| `--domain` | subdomínio de acesso (obrigatório) | |
| `--port` | porta interna do app, só em 127.0.0.1 | 3000 |
| `--public-port` | porta pública do subdomínio | 443 |
| `--email` | e-mail do Let's Encrypt | opcional |
| `--no-tls` | sem HTTPS, só para teste | |

O instalador pede a **senha inicial do root**. Ela é guardada com bcrypt e a API exige a troca no primeiro acesso.

## O que é instalado
`/opt/gusto/app` (código), `/etc/gusto/gusto.env` (segredos), serviço `gusto`, site do nginx, banco `gusto` com usuário de privilégio mínimo, backup diário em `/var/backups/gusto` (14 dias) e renovação automática do certificado.

## Operação
```bash
systemctl status gusto            # estado
journalctl -u gusto -f            # logs
systemctl restart gusto           # reiniciar
curl http://127.0.0.1:3000/health # verificação
```

## Atualizar
Extraia o pacote novo e rode `install.sh` de novo com as mesmas opções. O banco e os segredos são mantidos; novas migrações são aplicadas.

## Backup e restauração
Os backups ficam em `/var/backups/gusto`. Para restaurar em um banco vazio: `zcat arquivo.sql.gz | sudo -u postgres psql gusto`.

## Desinstalar
`sudo ./uninstall.sh` remove serviço e nginx e mantém os dados. `--purge` apaga tudo, com confirmação.

## Solução de problemas
- **DNS não resolve**: crie o registro `A` e aguarde a propagação.
- **Porta em uso**: escolha outra `--port` ou `--public-port`.
- **Certificado falhou**: confirme a porta 80 aberta e o DNS correto.
- **Login do app não abre**: o navegador exige HTTPS; evite `--no-tls` fora de testes.

## Mapa e localização
O mapa real usa a localização do navegador (com permissão) e consulta o OpenStreetMap (Overpass). Coordenadas arredondadas são enviadas a esse serviço público. Sem permissão ou rede, aparece um desenho ilustrativo.

## Limites atuais
A API tem login real, mas a interface incluída ainda usa dados locais do navegador. O assistente de IA só funciona dentro do claude.ai. Pagamentos vêm em modo de teste; configure um provedor de Pix antes de receber valores reais.

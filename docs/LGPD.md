# Gusto · Tratamento de dados pessoais (LGPD) — v0.1.0-alpha

> Resumo técnico para apoiar o aviso de privacidade e o RIPD. Não substitui avaliação jurídica.

| Finalidade | Dados | Base legal (art. 7º) | Retenção | Controle do titular |
|---|---|---|---|---|
| Conta e acesso | usuário, nome, hash de senha, sessões | execução de contrato (V) | enquanto ativa | exportar / excluir |
| Pedidos, carteira, pagamentos | pedidos, extrato, cobranças | contrato (V) e obrigação legal (II) | prazo legal; anonimizados na exclusão | exportar |
| Notas, grafo | conteúdo criado pelo usuário | contrato (V) | até o usuário apagar | apagar / exportar |
| Chat | mensagens | consentimento (I) / contrato | `CHAT_RETENTION_DAYS` (30) | exportar / excluir |
| Vídeo | áudio e vídeo **ponto a ponto**, não gravados | consentimento (I) | não armazenado | liga/desliga |
| IA (tradução, assistente) | texto visível ou notas, **com identificadores mascarados** | consentimento (I) | cache só de texto mascarado | liga/desliga a qualquer momento |
| Localização (mapa da base) | coordenadas arredondadas → Overpass | consentimento do navegador | não armazenada | permissão do navegador |

**Medidas:** minimização (art. 6º, III), mascaramento antes de terceiros, criptografia em trânsito (TLS) e senhas com bcrypt, privilégio mínimo no banco, registros de auditoria, isolamento de homologação.

**Pendências do controlador:** definir o encarregado (`LGPD_DPO_CONTATO`), publicar o aviso de privacidade, firmar termos com os provedores de IA (operadores) e avaliar transferência internacional (art. 33) conforme o provedor escolhido.

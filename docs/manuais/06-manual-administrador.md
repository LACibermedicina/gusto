# Manual do Administrador (root)

## Acesso e senha
O usuário inicial é `root`. No primeiro acesso, o guia convida a **trocar a senha**. Uma senha curta ou conhecida deixa o sistema vulnerável: use 8 caracteres ou mais.

## Usuários e funções
Em **⋯ Mais › Administração**:
1. **Novo usuário**: informe login (3 a 20 caracteres: a-z, 0-9, ponto, hífen, sublinhado), nome, senha inicial e as **funções** (Cliente, Preparador, Entregador, Fiscal).
2. **Fiscal** só é atribuído aqui. O root não atua como fiscal; crie um usuário com essa função para aprovar registros.
3. Cada usuário pode ser **ativado, desativado, excluído** ou ter a **senha redefinida**.

## Funcionalidades
- **Por usuário**: desmarque uma funcionalidade para desautorizá-la só para aquele usuário.
- **Global**: desmarque em “Funcionalidades globais” para desligar para todos.
- Funcionalidades: feed, mapa 3D, cadastro de receitas, tutoriais, mercado de créditos, espaços e itens, pagamentos por link, assistente de IA e calendário.

## Preços e taxas
Em **⭐ Carteira › Tabela de preços e taxas**: recompensas, empréstimos, locação e a **taxa da corretora**. Preparo e entrega são precificados por quem aceita cada demanda.

## Auditoria
A lista no fim da administração registra quem fez o quê e quando.

## Limites da versão de teste
Na versão publicada para teste, usuários e dados ficam no navegador. Para operação real, use a instalação em servidor (manual 07) e ligue a interface à API.

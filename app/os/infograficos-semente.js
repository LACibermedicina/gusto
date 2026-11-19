// GUSTO · infográficos públicos iniciais (conteúdo original da equipe Gusto) · by m3d.pro
// Semeados no primeiro start (ON CONFLICT DO NOTHING): editar pelo admin não é sobrescrito no deploy.
// Valores de tempo/temperatura são faixas de referência de cozinha profissional; confirme na sua praça.

export const SEMENTE = [
  {
    slug: "molho-bearnaise", destaque: true,
    titulo: "Molho Béarnaise", categoria: "Molhos-mãe e emulsões", contextoAlvo: "Praça de cozinha quente em serviço de alta demanda",
    resumo: "Emulsão quente de gema e manteiga clarificada aromatizada por redução de estragão: o controle de 60–65 °C separa o molho nappé do molho talhado.",
    tempo: "25 min", rendimento: "≈ 300 g", nivel: "Avançado",
    fisicoQuimica: {
      etapas: [
        { titulo: "Insumos e proporção", icone: "balanca", texto: "Redução de vinho branco + vinagre de vinho branco com chalota, estragão e pimenta mignonette. Base: ≈ 1 gema para 60–75 g de manteiga clarificada morna." },
        { titulo: "Ação térmica e mecânica", icone: "batedor", texto: "Gemas com a redução coada batidas em banho-maria brando (sabayon) até 60–65 °C e ponto de fita; manteiga entra em fio, batendo sem parar." },
        { titulo: "Reação físico-química", icone: "gota", texto: "Lecitina e proteínas da gema envolvem as gotículas de gordura (emulsão óleo-em-água); o calor moderado espessa as proteínas e estabiliza a rede." },
        { titulo: "Textura e ponto final", icone: "colher", texto: "Nappé espesso, brilhante e liso; finaliza com estragão e cerefólio picados. Servir morno, nunca quente." }
      ],
      alerta: { titulo: "Janela crítica: 60–65 °C", icone: "termometro", texto: "Acima de ≈ 70 °C as proteínas da gema coagulam (grumos) e a emulsão quebra. Manteiga quente demais ou em jato rápido também talha o molho." }
    },
    praca: {
      sensorial: ["Textura aveludada que cobre a colher sem escorrer", "Acidez da redução equilibrando a gordura; anisado do estragão evidente", "Cor amarelo-pálido, brilho acetinado, sem película de gordura", "Servir morno (≈ 50–60 °C)"],
      insumos: ["Gemas frescas, à temperatura ambiente", "Manteiga clarificada morna (≈ 50–60 °C)", "Redução aromática reduzida a ≈ 1/3 e coada", "Estragão e cerefólio frescos, ciselé no último momento"],
      defeitos: ["Talhamento: gordura separando e aspecto oleoso", "Grumos ou textura granulosa (gema coagulada)", "Molho ralo, sem corpo (pouca manteiga ou sabayon fraco)", "Película na superfície durante o serviço"],
      correcao: ["Talhou: em tigela limpa, 1 gema + 1 colher de água morna; incorporar o molho talhado em fio, batendo", "Espesso demais: gotas de água morna ou de redução", "Grumos leves: passar no chinois e ajustar o ponto", "Ralo: voltar ao banho-maria brando batendo, sem passar de 65 °C"]
    },
    fluxo: {
      inicio: "Sabayon pronto em banho-maria, manteiga clarificada morna à mão",
      decisao: "A emulsão ficou estável e nappé após toda a manteiga?",
      ok: { rotulo: "Emulsão estável", passos: ["Teste da colher: o traço do dedo permanece nítido", "Ajustar sal e acidez; finalizar com ervas frescas", "Manter morno em banho-maria brando e porcionar no pedido"] },
      desvio: { rotulo: "Separação de fases", passos: ["Retirar do calor imediatamente", "Resgate com nova gema e água morna, em fio", "Conferir temperatura (≤ 65 °C) antes de seguir"] },
      fim: "Emplatamento: molho ao lado ou em cordão sobre a proteína grelhada, nunca sob lâmpada quente"
    },
    segredos: {
      dicas: ["Clarifique a manteiga: sem soro e caseína, a emulsão fica mais estável e não queima", "Reserve um pouco de redução fria para ajustar a acidez no final", "Bata no fundo da tigela em movimento de oito para incorporar ar sem cozinhar a gema", "Produza em lotes pequenos ao longo do serviço; molho com gema fica abaixo de 60 °C e exige controle de tempo de exposição", "Harmoniza com carnes vermelhas grelhadas e peixes de sabor marcante"],
      referencias: ["ESCOFFIER, A. Le Guide Culinaire — sauces chaudes (Sauce Béarnaise)", "Larousse Gastronomique — verbete Béarnaise (sauce)", "McGEE, H. On Food and Cooking — molhos emulsionados à base de ovo", "ANVISA. RDC nº 216/2004 — Boas Práticas para Serviços de Alimentação"],
      glossario: [{ termo: "Sabayon", definicao: "Gemas batidas sobre calor brando até espumar e espessar" }, { termo: "Nappé", definicao: "Ponto em que o molho cobre a costa da colher" }, { termo: "Mignonette", definicao: "Pimenta-do-reino grosseiramente quebrada" }, { termo: "Ciselé", definicao: "Corte fino de ervas sem esmagá-las" }, { termo: "Chinois", definicao: "Peneira cônica de malha fina" }]
    }
  },
  {
    slug: "risotto-alla-milanese",
    titulo: "Risotto alla Milanese", categoria: "Cereais e amidos", contextoAlvo: "Aula prática de técnicas clássicas",
    resumo: "Amido liberado aos poucos, caldo sempre quente e mantecatura fora do fogo: o risoto cremoso all'onda depende de cinética, não de quantidade de queijo.",
    tempo: "30 min", rendimento: "4 porções", nivel: "Intermediário",
    fisicoQuimica: {
      etapas: [
        { titulo: "Insumos e proporção", icone: "balanca", texto: "320 g de arroz Carnaroli ou Arborio (sem lavar) para ≈ 1,2–1,4 L de caldo de carne claro mantido em fervura branda; açafrão em pistilos hidratado." },
        { titulo: "Ação térmica e mecânica", icone: "chama", texto: "Tostatura do grão em manteiga com cebola suada (≈ 2 min) até as bordas ficarem translúcidas; deglaçar com vinho branco e adicionar caldo em conchas." },
        { titulo: "Reação físico-química", icone: "molecula", texto: "O amido da superfície gelatiniza e é liberado pela agitação, espessando o caldo; o centro do grão hidrata mais devagar e mantém a estrutura." },
        { titulo: "Textura e ponto final", icone: "colher", texto: "Grão al dente (16–18 min) envolto em creme fluido; mantecatura fora do fogo com manteiga fria e Grana Padano, até o ponto all'onda." }
      ],
      alerta: { titulo: "Caldo frio interrompe a cocção", icone: "termometro", texto: "Cada concha de caldo frio derruba a temperatura abaixo da gelatinização e alonga o tempo, deixando o centro cru. Mantenha o caldo em fervura branda ao lado." }
    },
    praca: {
      sensorial: ["Ondula ao inclinar o prato (all'onda), sem formar bloco", "Grão íntegro, al dente, sem centro calcário", "Amarelo-ouro uniforme do açafrão, brilho da mantecatura", "Servir imediatamente, ≈ 65–70 °C no prato"],
      insumos: ["Arroz de grão médio rico em amilopectina (Carnaroli/Arborio)", "Caldo quente: ≈ 3,5–4 partes por 1 de arroz (volume), ajustado ao ponto", "Manteiga fria em cubos e Grana Padano ralado fino para a mantecatura", "Açafrão em pistilos hidratado em caldo morno"],
      defeitos: ["Centro gessado/branco ao morder (cocção insuficiente)", "Papa pegajosa: grão rompido por excesso de cocção ou agitação", "Mantecatura oleosa, gordura separada no prato", "Fundo grudando e tostando na panela"],
      correcao: ["Centro cru: mais caldo fervente em pequenas doses e 2–3 min de cocção", "Denso demais antes de servir: uma concha de caldo quente e agitação vigorosa", "Mantecatura separada: um fio de caldo e bater energicamente para re-emulsionar", "Fundo tostando: reduzir o fogo e aumentar a frequência das conchas"]
    },
    fluxo: {
      inicio: "Soffritto pronto, arroz tostado e deglaçado, caldo em fervura branda",
      decisao: "Aos 16 min o grão está al dente e o creme envolve o arroz?",
      ok: { rotulo: "Ponto atingido", passos: ["Retirar do fogo e descansar 1 min", "Mantecatura: manteiga fria + queijo, agitando a panela", "Teste all'onda: inclinar a panela e ver a onda se formar"] },
      desvio: { rotulo: "Cocção desigual", passos: ["Morder 3 grãos de pontos diferentes", "Mais caldo quente em conchas pequenas", "Reavaliar a cada 1 min"] },
      fim: "Emplatamento em prato raso aquecido, bater na base para espalhar; sem decorar sobre o arroz"
    },
    segredos: {
      dicas: ["Não lave o arroz: o amido superficial é o espessante do prato", "Use panela de fundo grosso e larga para cocção uniforme", "A mantecatura é emulsão: manteiga fria e movimento, fora do fogo", "Ajuste o sal só no final, porque o caldo e o queijo concentram durante a cocção", "Tutano de boi no soffritto é a versão tradicional milanesa"],
      referencias: ["ARTUSI, P. La scienza in cucina e l'arte di mangiar bene — Risotto alla milanese", "Larousse Gastronomique — verbete Risotto", "McGEE, H. On Food and Cooking — arroz e gelatinização do amido"],
      glossario: [{ termo: "Tostatura", definicao: "Tostar o grão em gordura antes do líquido" }, { termo: "Mantecatura", definicao: "Emulsão final com manteiga fria e queijo, fora do fogo" }, { termo: "All'onda", definicao: "Textura que forma onda ao mover o prato" }, { termo: "Soffritto", definicao: "Base aromática suada em gordura" }, { termo: "Q.B.", definicao: "Quanto basta" }]
    }
  },
  {
    slug: "magret-de-pato-sous-vide",
    titulo: "Magret de Pato Sous-Vide", categoria: "Proteínas e cocção de precisão", contextoAlvo: "Ficha técnica operacional",
    resumo: "Cocção em banho a temperatura controlada para ponto rosé de borda a borda, seguida de selagem lenta da pele: duas fases, dois objetivos físico-químicos.",
    tempo: "2 h 15 min", rendimento: "2 porções", nivel: "Intermediário",
    fisicoQuimica: {
      etapas: [
        { titulo: "Insumos e preparo", icone: "faca", texto: "Magret limpo, pele riscada em losangos sem atingir a carne; tempero e embalagem a vácuo íntegra, sem bolsas de ar." },
        { titulo: "Ação térmica", icone: "termometro", texto: "Banho termostático a ≈ 57 °C por 1 h 30–2 h (ponto rosé); a temperatura do núcleo se iguala à do banho." },
        { titulo: "Reação físico-química", icone: "molecula", texto: "Miosina desnatura (firmeza) enquanto a actina, que expulsa suco acima de ≈ 65 °C, é preservada; a gordura da pele amolece mas ainda não rende." },
        { titulo: "Textura e ponto final", icone: "chama", texto: "Selagem pele para baixo em frigideira de fogo médio até a gordura render e a pele dourar (Maillard); 30 s no lado da carne; repouso curto." }
      ],
      alerta: { titulo: "Segurança: tempo × temperatura", icone: "alerta", texto: "Abaixo de 60 °C a pasteurização depende do tempo no banho: siga tabela validada. Se não for servir, resfriar rápido em água com gelo e refrigerar; nunca manter morno." }
    },
    praca: {
      sensorial: ["Carne rosada uniforme da borda ao centro, sem faixa cinza", "Pele fina, crocante e dourada; gordura translúcida", "Sabor intenso de pato com notas tostadas", "Fatiar no momento e servir quente"],
      insumos: ["Magret de pato (≈ 350–400 g por peça)", "Sal, pimenta e aromáticos secos (tomilho, zimbro) na embalagem", "Termocirculador calibrado e embalagem própria para cocção", "Frigideira de fundo grosso para a selagem"],
      defeitos: ["Faixa cinza sob a pele: selagem quente e longa demais", "Pele borrachuda: gordura não renderizada", "Embalagem flutuando ou com ar: troca de calor irregular", "Fumaça e amargor: gordura queimada na frigideira"],
      correcao: ["Pele mole: voltar pele para baixo em fogo médio-baixo e escorrer a gordura", "Embalagem com ar: reembalar ou usar peso no banho", "Gordura escurecendo: trocar a frigideira, guardar a gordura limpa", "Ponto passou do rosé: fatiar fino e servir com molho para compensar a textura"]
    },
    fluxo: {
      inicio: "Saída do banho; embalagem aberta e magret seco com papel",
      decisao: "A pele dourou e a gordura rendeu sem passar calor para a carne?",
      ok: { rotulo: "Pele crocante", passos: ["Virar 30 s para selar o lado da carne", "Repouso de 2–3 min sobre grade", "Fatiar em viés, contra as fibras"] },
      desvio: { rotulo: "Pele mole / carne aquecendo", passos: ["Baixar o fogo e escorrer a gordura", "Conferir com termômetro de espeto (≤ 57–58 °C no núcleo)", "Concluir a pele e reduzir o repouso"] },
      fim: "Emplatamento em leque com molho de redução (ex.: fond de pato com frutas vermelhas)"
    },
    segredos: {
      dicas: ["Riscar a pele acelera a renderização e evita que ela encolha", "Comece a selagem com a frigideira morna, não fumegante: a gordura sai antes de queimar", "Guarde a gordura de pato coada para batatas sautées", "Seque muito bem a pele antes de selar; umidade impede a reação de Maillard", "Marca a temperatura e o horário na embalagem (rastreabilidade)"],
      referencias: ["BALDWIN, D. E. A Practical Guide to Sous Vide Cooking — tabelas de tempo e pasteurização", "McGEE, H. On Food and Cooking — proteínas da carne e temperatura", "Larousse Gastronomique — verbete Magret", "ANVISA. RDC nº 216/2004 — controle de tempo e temperatura"],
      glossario: [{ termo: "Sous-vide", definicao: "Cocção do alimento embalado a vácuo em banho de temperatura controlada" }, { termo: "Magret", definicao: "Peito de pato engordado, com a pele" }, { termo: "Renderizar", definicao: "Derreter e retirar a gordura pelo calor" }, { termo: "Maillard", definicao: "Reação entre açúcares e aminoácidos que doura e aromatiza" }, { termo: "Rosé", definicao: "Ponto rosado e suculento" }]
    }
  },
  {
    slug: "massa-folhada-classica",
    titulo: "Massa Folhada Clássica", categoria: "Confeitaria e panificação", contextoAlvo: "Estudo para concursos de gastronomia",
    resumo: "Centenas de camadas alternadas de massa e manteiga: no forno, a água vira vapor e empurra as folhas. Temperatura e repouso decidem o folhado.",
    tempo: "4 h (com repousos)", rendimento: "≈ 1,7 kg", nivel: "Avançado",
    fisicoQuimica: {
      etapas: [
        { titulo: "Insumos e proporção", icone: "balanca", texto: "Détrempe: 1 kg de farinha, ≈ 500 mL de água gelada, 20 g de sal e ≈ 100 g de manteiga. Beurrage: manteiga seca a 75–100% do peso da farinha." },
        { titulo: "Ação mecânica", icone: "faca", texto: "Envelopar a beurrage na détrempe e dar 6 voltas simples (ou 4 duplas), com repousos refrigerados de 20–30 min a cada 2 voltas." },
        { titulo: "Reação físico-química", icone: "forno", texto: "No forno (≈ 200–220 °C) a água evapora entre as camadas de manteiga e infla a massa; depois o amido gelatiniza e as proteínas fixam a estrutura." },
        { titulo: "Textura e ponto final", icone: "colher", texto: "Folhas regulares, altas e crocantes, dourado uniforme, miolo seco; som oco ao bater na base." }
      ],
      alerta: { titulo: "Mesma consistência, massa fria", icone: "gelo", texto: "Détrempe e manteiga precisam ter a mesma plasticidade (manteiga ≈ 12–15 °C). Quente, a manteiga funde e as camadas se misturam; gelada demais, quebra e rasga as folhas." }
    },
    praca: {
      sensorial: ["Crocância que estilhaça, sem miolo úmido", "Sabor amanteigado limpo, sem gosto de farinha crua", "Camadas visíveis e paralelas no corte lateral", "Dourado uniforme; servir no dia"],
      insumos: ["Farinha de força média; détrempe pouco trabalhada", "Manteiga com baixo teor de água (\"seca\")", "Água gelada para controlar a temperatura da massa", "Bancada fria e polvilhamento mínimo de farinha"],
      defeitos: ["Manteiga vazando nas bordas durante as voltas (massa quente)", "Manteiga quebrando em placas sob o rolo (fria demais)", "Encolhimento e deformação no forno (glúten tenso)", "Fundo cru ou miolo pesado"],
      correcao: ["Manteiga vazando: embrulhar e refrigerar 20 min antes de continuar", "Manteiga quebradiça: deixar 5–10 min à temperatura ambiente", "Encolhimento: prolongar o repouso antes de cortar e assar", "Fundo cru: assar na grade inferior ou sobre assadeira preaquecida"]
    },
    fluxo: {
      inicio: "Pâton com 6 voltas, repousado e frio",
      decisao: "Ao abrir, a massa está lisa, fria e sem manteiga aparente?",
      ok: { rotulo: "Folhas íntegras", passos: ["Abrir na espessura final e cortar com faca afiada (corte limpo)", "Pincelar só o topo com dorure, sem escorrer nas bordas", "Assar a 200–220 °C até dourar e baixar para secar o miolo"] },
      desvio: { rotulo: "Manteiga exposta / massa elástica", passos: ["Interromper e refrigerar 20–30 min", "Remendar com farinha mínima", "Reavaliar antes de cortar"] },
      fim: "Montagem: mil-folhas, vol-au-vent ou palmiers; rechear só depois de frio"
    },
    segredos: {
      dicas: ["Marque cada volta com a ponta do dedo para não perder a conta", "Corte com lâmina, nunca arraste: bordas esmagadas não sobem", "A dorure nas bordas cola as camadas e impede o crescimento", "Massa crua congela bem, embalada, já em formato final", "6 voltas simples resultam em 729 camadas de manteiga"],
      referencias: ["ESCOFFIER, A. Le Guide Culinaire — pâte feuilletée", "Larousse Gastronomique — verbete Feuilletage", "Institut Paul Bocuse. Gastronomique — técnicas de massas folhadas", "McGEE, H. On Food and Cooking — massas laminadas e vapor"],
      glossario: [{ termo: "Détrempe", definicao: "Massa básica de farinha, água e sal" }, { termo: "Beurrage", definicao: "Bloco de manteiga envolvido pela détrempe" }, { termo: "Pâton", definicao: "Conjunto détrempe + manteiga em laminação" }, { termo: "Volta simples", definicao: "Dobrar a massa em três" }, { termo: "Dorure", definicao: "Pincelagem de ovo para dourar" }]
    }
  },
  {
    slug: "fundo-escuro-de-vitela",
    titulo: "Fundo Escuro de Vitela (Fond Brun)", categoria: "Fundos e bases", contextoAlvo: "Aula prática de técnicas clássicas",
    resumo: "Ossos tostados, mirepoix e horas em frémissement extraem gelatina e aromas de Maillard: a base de molhos escuros e da demi-glace.",
    tempo: "6–8 h", rendimento: "≈ 4 L", nivel: "Intermediário",
    fisicoQuimica: {
      etapas: [
        { titulo: "Insumos e proporção", icone: "balanca", texto: "Ossos de vitela ricos em cartilagem (joelho, rabo) e aparas; mirepoix ≈ 10–20% do peso dos ossos; extrato de tomate; bouquet garni; água fria cobrindo." },
        { titulo: "Ação térmica", icone: "forno", texto: "Tostar os ossos em forno quente (≈ 200–220 °C) até dourar; juntar mirepoix e pinçar o extrato de tomate; deglaçar a assadeira." },
        { titulo: "Reação físico-química", icone: "molecula", texto: "Maillard nos ossos e legumes gera cor e aroma; na cocção longa úmida o colágeno se hidrolisa em gelatina, que dá corpo ao fundo." },
        { titulo: "Textura e ponto final", icone: "colher", texto: "Líquido límpido, castanho brilhante, que gelifica ao esfriar; reduzido, cobre a colher (base de demi-glace)." }
      ],
      alerta: { titulo: "Frémissement, nunca fervura", icone: "chama", texto: "Fervura forte emulsiona gordura e proteínas e deixa o fundo turvo e gorduroso. Extrato de tomate queimado na pinçage gera amargor que não se corrige." }
    },
    praca: {
      sensorial: ["Límpido e brilhante, cor de mogno", "Corpo gelatinoso que pega nos lábios", "Aroma tostado e de legumes assados, sem amargor", "Sem gordura na superfície"],
      insumos: ["Ossos de vitela cortados (mais superfície = mais extração)", "Mirepoix: cebola, cenoura, salsão em cortes grandes", "Água fria no início (proteínas coagulam devagar e sobem como espuma)", "Bouquet garni amarrado; sem sal"],
      defeitos: ["Turvação: fervura forte ou mexer o fundo", "Amargor: ossos ou extrato de tomate queimados", "Sem corpo: pouca cartilagem ou tempo curto", "Gordura emulsionada na superfície"],
      correcao: ["Turvo: coar em étamine; se preciso, clarificar com claras", "Sem corpo: reduzir lentamente após coar", "Gordura: escumar e desengordurar a frio (gordura solidifica)", "Amargor por queima: separar e refazer a base, não mascarar"]
    },
    fluxo: {
      inicio: "Ossos tostados e deglaçados na panela, água fria cobrindo",
      decisao: "O fundo se mantém em frémissement, límpido, com espuma sendo escumada?",
      ok: { rotulo: "Extração limpa", passos: ["Cocção de 6–8 h, escumando", "Coar em chinois e étamine sem prensar", "Resfriar rápido (banho de gelo) e refrigerar"] },
      desvio: { rotulo: "Fervura / turvação", passos: ["Baixar o fogo e adicionar um pouco de água fria", "Escumar a gordura emulsionada", "Seguir e coar em étamine no final"] },
      fim: "Uso: reduzir para glace ou demi-glace; porcionar e etiquetar com data"
    },
    segredos: {
      dicas: ["Começar com água fria facilita retirar as impurezas como espuma", "Não salgar: o fundo será reduzido e concentrado", "Escumar com frequência nas primeiras horas define a limpidez", "Resfriamento rápido em recipiente raso evita a zona de risco", "Uma segunda extração (remouillage) aproveita os ossos para fundos leves"],
      referencias: ["ESCOFFIER, A. Le Guide Culinaire — fonds de cuisine (fond brun)", "Larousse Gastronomique — verbete Fond", "McGEE, H. On Food and Cooking — colágeno, gelatina e caldos", "ANVISA. RDC nº 216/2004 — resfriamento e armazenamento"],
      glossario: [{ termo: "Mirepoix", definicao: "Cebola, cenoura e salsão em cubos" }, { termo: "Pincer", definicao: "Tostar o extrato de tomate na gordura para tirar a acidez" }, { termo: "Frémissement", definicao: "Fervura mínima, superfície apenas tremulando" }, { termo: "Étamine", definicao: "Pano fino para coar" }, { termo: "Demi-glace", definicao: "Fundo escuro reduzido com molho espanhol" }, { termo: "Remouillage", definicao: "Segunda extração dos mesmos ossos" }]
    }
  }
];

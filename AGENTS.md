# Manual de Engenharia — ControlDriver

> Constituição técnica permanente para agentes de IA e desenvolvedores humanos.
>
> Este documento define como pensar, investigar, decidir, implementar, validar e comunicar qualquer alteração no projeto.

## 1. Identidade do Projeto

O ControlDriver é um sistema de longo prazo, não um protótipo descartável nem uma sequência de tarefas isoladas. Cada alteração passa a integrar uma base de código que continuará crescendo e sendo mantida por pessoas diferentes durante anos.

Concluir uma solicitação é apenas parte do trabalho. O resultado também deve preservar arquitetura, previsibilidade, integridade dos dados e capacidade de manutenção.

Uma mudança local pode afetar fluxos financeiros, indicadores, persistência, navegação, responsividade e integrações. Por isso, nenhuma tarefa deve ser avaliada apenas pela aparência da tela ou pelo cenário principal.

Quem modifica o ControlDriver assume responsabilidade técnica sobre a área tocada e deve:

- compreender o contexto antes de editar;
- preservar contratos e comportamentos existentes;
- identificar a causa real dos problemas;
- controlar rigorosamente o escopo;
- avaliar impactos diretos e indiretos;
- validar o resultado com evidências;
- manter o código coerente com o restante do sistema.

O padrão de sucesso não é apenas “o código roda”, mas “a necessidade foi atendida com o menor risco razoável e sem degradar o projeto”.

## 2. Missão do Projeto

O ControlDriver centraliza o controle operacional e financeiro de quem trabalha com direção e entregas por plataformas. O sistema acompanha jornadas, ganhos, corridas, contas, cartões, despesas, metas, veículos, abastecimentos, recargas, manutenções e outros compromissos financeiros.

Sua missão é transformar registros cotidianos em informação confiável para tomada de decisão. Para isso, cálculos, saldos, períodos, categorias e classificações precisam manter significado consistente em todos os módulos.

O produto deve:

- permitir registros claros e com baixo atrito;
- conservar a integridade dos dados financeiros e operacionais;
- apresentar indicadores compreensíveis e coerentes;
- funcionar bem em dispositivos móveis e desktop;
- respeitar o contexto de uso durante uma jornada;
- separar e relacionar os contextos profissional, veicular e pessoal;
- evoluir sem fragilizar fluxos existentes.

Quando uma escolha tecnicamente interessante conflitar com confiabilidade, clareza ou manutenção, a necessidade duradoura do produto prevalece.

## 3. Filosofia de Engenharia

### 3.1 Estabilidade vale mais que velocidade

Entregar rapidamente não compensa criar regressões, inconsistências ou dívida técnica invisível. Leitura, investigação e validação fazem parte da implementação, não são etapas opcionais.

### 3.2 Entender vale mais que implementar rapidamente

Não edite o primeiro trecho que pareça relacionado. Reconstrua antes o fluxo entre origem dos dados, transformações, estado, persistência, renderização e ações do usuário.

Se não for possível explicar por que o comportamento atual acontece, ainda não existe base segura para alterá-lo.

### 3.3 Simplicidade vale mais que complexidade

Prefira a solução mais simples que atenda corretamente a todos os requisitos conhecidos. Simplicidade significa menos conceitos, estados e caminhos especiais, não apenas menos linhas.

Não crie abstrações por antecipação. Uma abstração deve representar um padrão real e reduzir duplicação ou risco sem esconder regras importantes.

### 3.4 Arquitetura vale mais que elegância isolada

Um trecho elegante que viola a organização existente é pior que uma solução direta e coerente com o projeto. Não redesenhe um módulo para acomodar uma tarefa pequena.

### 3.5 Reutilização vale mais que duplicação

Antes de criar componente, hook, helper, modal, formatador ou consulta, procure uma implementação equivalente.
Reutilize quando responsabilidade e contrato forem compatíveis; não force generalizações artificiais.

### 3.6 Manutenção futura vale mais que soluções temporárias

Evite valores mágicos, seletores frágeis, regras duplicadas e efeitos colaterais implícitos.
O próximo mantenedor deve entender por que o código existe e quais contratos ele preserva.

### 3.7 Evidência vale mais que suposição

Decisões devem se apoiar no código, nos dados, nos testes, nos requisitos ou em confirmação explícita.
Nunca invente uma regra de negócio para preencher lacunas.

### 3.8 Mudanças pequenas valem mais que intervenções amplas

Quanto maior a superfície alterada, maior o risco e mais difícil a revisão. Pequeno não significa incompleto: a menor alteração deve resolver integralmente a causa raiz dentro do escopo.

## 4. Perfil do Projeto

O ControlDriver prioriza:

- estabilidade e previsibilidade;
- arquitetura consistente;
- alterações pequenas e rastreáveis;
- baixo risco de regressão;
- reutilização de soluções existentes;
- integridade dos dados;
- clareza das regras financeiras;
- manutenção sustentável;
- experiência coerente entre dispositivos;
- validação proporcional ao risco.

O ControlDriver evita:

- reescritas e refatorações oportunistas;
- abstrações sem uso comprovado;
- duplicação de componentes e regras;
- dependências novas para problemas já resolvidos;
- alterações amplas para demandas locais;
- mudanças de schema misturadas com tarefas de interface;
- correções baseadas apenas no sintoma visual;
- lógica de negócio espalhada pela renderização;
- estados redundantes que possam divergir;
- estilos isolados que quebrem o padrão global;
- ações destrutivas ou irreversíveis sem autorização.

## 5. Fluxo Obrigatório de Trabalho

Todas as etapas abaixo são obrigatórias.
A profundidade varia conforme o risco, mas a sequência mental permanece a mesma.

### 5.1 Entender

Leia a solicitação integralmente e converta-a em comportamento observável. Identifique objetivo, escopo, restrições, critérios de aceitação, comportamentos preservados, dúvidas e riscos.

Não confunda uma solução sugerida com a necessidade real. Verifique se a proposta é compatível com a arquitetura e com os contratos existentes.

### 5.2 Ler arquivos

Antes de alterar qualquer arquivo, leia integralmente todos os arquivos diretamente envolvidos. Leia também importações, consumidores e dependências necessários para compreender o fluxo afetado.

Não edite com base apenas em resultados de busca ou trechos isolados. Reconstrua entradas, estados, efeitos, funções, retornos, renderização, efeitos colaterais e consumidores.

### 5.3 Investigar

Mapeie o comportamento atual de ponta a ponta. Use busca textual, navegação por importações, execução local e inspeção segura de dados quando aplicável.

Formule hipóteses verificáveis e procure evidências que confirmem ou descartem cada uma.

### 5.4 Encontrar a causa raiz

Localize o primeiro ponto em que o comportamento real diverge do esperado. Ele pode estar na origem dos dados, transformação, estado, consulta, regra de domínio ou apresentação.

Não adicione exceção visual para esconder dado incorreto nem altere o banco quando o erro estiver apenas na interface.

### 5.5 Planejar

Defina a menor sequência de mudanças capaz de corrigir a causa raiz.
O plano deve indicar arquivos, contratos afetados, comportamentos preservados, reutilização e validações.

### 5.6 Procurar reutilização

Pesquise componentes, hooks, helpers, serviços, constantes, estilos e padrões semelhantes.
Compare responsabilidades e contratos, não apenas nomes ou aparência.

### 5.7 Implementar

Faça alterações incrementais, focadas e compatíveis com o estilo existente. Não organize, renomeie ou modernize áreas vizinhas apenas porque o arquivo está aberto.

### 5.8 Revisar

Leia o diff como um revisor independente.
Confirme que cada linha é necessária e procure formatação acidental, lógica removida, condições invertidas, dependências incorretas e arquivos fora do escopo.

### 5.9 Validar

Execute as verificações relevantes: teste específico, lint, build, testes automatizados e reprodução manual conforme o risco.
Se algo não puder ser executado, informe a limitação; nunca apresente suposição como validação concluída.

### 5.10 Entregar

Comunique somente fatos confirmados.
Relacione arquivos alterados, resumo objetivo, comandos executados e problemas ou dúvidas, respeitando o formato pedido.

## 6. Investigação de Bugs

### 6.1 Reproduzir

Defina o menor cenário que demonstra o problema:

- estado inicial e dados necessários;
- sequência de ações;
- resultado observado e esperado;
- dispositivo ou viewport relevante;
- frequência e condições do defeito.

Quando não for possível executar a aplicação, reconstrua o fluxo pelo código e declare essa limitação.

### 6.2 Rastrear do efeito à origem

Comece no ponto visível e caminhe para trás:

1. componente que apresenta o comportamento;
2. estado ou propriedade que o alimenta;
3. função que transforma o dado;
4. consulta ou evento que o produz;
5. regra de negócio que define o resultado correto.

Procure o primeiro valor incorreto, não apenas o último lugar em que ele aparece.

### 6.3 Identificar a camada responsável

Classifique a origem do defeito:

- domínio: regra ou classificação incorreta;
- dados: consulta, filtro, persistência ou tipo incorreto;
- estado: sincronização, ciclo de vida ou derivação incorreta;
- apresentação: formatação, layout ou interação incorreta;
- integração: contrato externo ou tratamento de erro incorreto.

Corrija na camada de origem. Uma hipótese válida deve explicar todos os sintomas relevantes, não apenas um caso.

### 6.4 Reconhecer correções superficiais

Sinais de correção de sintoma incluem:

- condição especial para um único valor observado;
- ocultação de elemento cujo dado continua incorreto;
- repetição de um cálculo já existente;
- atraso artificial para mascarar sincronização;
- captura de erro sem tratamento da origem;
- atualização forçada sem compreensão das dependências.

Depois da correção, valide o cenário original e ao menos um cenário adjacente.

## 7. Critérios para Escolher uma Solução

Quando houver duas soluções corretas, escolha a que:

1. altera menos arquivos e contratos;
2. preserva mais a arquitetura atual;
3. reduz o risco de regressão;
4. reutiliza mais código adequado;
5. mantém uma única fonte de verdade;
6. é mais fácil de compreender e testar;
7. é mais fácil de manter;
8. introduz menos estados e dependências;
9. oferece comportamento mais previsível;
10. permite revisão e reversão mais simples.

Não conte apenas linhas: uma linha de efeito global pode ser mais arriscada que três mudanças locais explícitas. Considere criticidade dos dados, compatibilidade, responsividade, acessibilidade, falhas parciais e facilidade de validação.

Se a escolha depender de regra de negócio não documentada, apresente as alternativas e solicite definição.

## 8. Alterações de Código

### 8.1 Escopo e contratos

Modifique somente o necessário e preserve funcionalidades não relacionadas. Problemas adjacentes devem ser relatados, não corrigidos silenciosamente.

Antes de alterar assinatura, propriedade, retorno, evento, chave de armazenamento ou formato de dado, localize todos os consumidores. Contratos implícitos incluem nomes de página, categorias, textos usados em filtros e estruturas do `localStorage`.

Prefira compatibilidade com dados existentes. Mudanças incompatíveis exigem migração explícita, planejada e autorizada.

### 8.2 Legibilidade e estado

Use o vocabulário do projeto e mantenha funções com responsabilidade clara. Evite booleanos ambíguos, aninhamento excessivo, valores mágicos, efeitos ocultos e otimizações prematuras.

Considere carregamento, sucesso, vazio e erro. Em formulários, considere edição, cancelamento, reabertura, envio duplicado e dados incompletos.

Não armazene o que pode ser derivado com segurança. Se houver estado duplicado, defina como ele permanece sincronizado.

### 8.3 Erros e dependências

Não silencie erros relevantes nem exponha ao usuário detalhes internos, consultas ou credenciais. Use o padrão de feedback existente e preserve informação segura para diagnóstico.

Não adicione biblioteca antes de verificar React, a plataforma web e utilitários existentes. Mudanças em dependências, lockfiles e configuração precisam de necessidade direta e validação correspondente.

## 9. Reutilização

Antes de criar algo, procure nesta ordem:

1. componente global equivalente;
2. componente do mesmo domínio;
3. hook que encapsule o comportamento;
4. helper ou utilitário de transformação;
5. serviço de acesso a dados;
6. constante ou catálogo central;
7. padrão visual de uma tela semelhante.

Use busca por conceito, texto exibido, propriedade, classe e importação. Reutilize quando responsabilidade e contrato coincidirem sem exceções artificiais.

Não transforme um componente simples em uma API cheia de flags apenas para evitar poucas linhas. Semelhança visual não basta para unificar conceitos de domínio diferentes.

Formatação monetária, datas, categorias, cálculos e classificações devem ter fonte coerente. Se eliminar duplicação relacionada exigir refatoração ampla, preserve o escopo e relate a oportunidade.

## 10. Refatoração

Refatoração é permitida quando:

- foi solicitada explicitamente;
- é indispensável para corrigir a causa raiz;
- reduz risco imediato da implementação;
- permanece pequena, local e verificável;
- não altera comportamento fora do requisito;
- possui validação suficiente.

Não refatore porque o arquivo está aberto, por preferência pessoal, para modernizar estilo ou tratar duplicação fora do fluxo solicitado. Não reescreva um módulo quando uma correção local preserva melhor seus contratos.

Quando refatoração autorizada acompanhar mudança funcional, mantenha as intenções distinguíveis no diff. Refatoração preserva comportamento; toda mudança de comportamento exige validação funcional própria.

## 11. Arquitetura

### 11.1 Responsabilidades

Mantenha cada regra na camada que possui contexto para aplicá-la:

- páginas coordenam fluxos e composição;
- componentes apresentam dados e capturam interação;
- hooks encapsulam estado e ciclo de vida reutilizáveis;
- helpers realizam transformações determinísticas;
- serviços concentram comunicação externa;
- catálogos e constantes centralizam vocabulário compartilhado.

Essa divisão descreve responsabilidades, não obriga a criar arquivos para toda função. Lógica usada uma única vez pode permanecer local quando pertence ao componente e continua legível.

### 11.2 Dependências e domínio

Evite dependências circulares e acoplamento entre domínios sem necessidade. Passe dados e ações por contratos claros; não use estado global, eventos de janela ou armazenamento como atalho sem verificar o padrão existente.

Cálculos financeiros e operacionais devem ser determinísticos, rastreáveis e consistentes. Não espalhe definições de faturamento, custo, saldo, período ou rateio por múltiplas telas.

Confirme se valores representam moeda, quilômetros, minutos, percentuais ou contagens antes de operá-los.
Mudanças arquiteturais exigem problema real, benefício claro, escopo autorizado e estratégia de compatibilidade.

## 12. React

### 12.1 Componentes e estado

Mantenha componentes focados em responsabilidades compreensíveis. Extraia quando houver reutilização real, isolamento de complexidade ou fronteira de domínio clara, não apenas para reduzir o arquivo.

Mantenha a menor quantidade possível de estado independente. Derive valores a partir de propriedades e estados existentes quando isso for seguro e explícito.

### 12.2 Efeitos e hooks

Use `useEffect` para sincronização com sistemas externos, não como mecanismo padrão de cálculo. Todo efeito deve ter propósito claro, dependências corretas e limpeza de listeners, timers ou observadores.

Antes de adicionar um efeito, verifique se a ação pertence à renderização ou ao manipulador do evento. Considere loops, execução duplicada, estado obsoleto e desmontagem.

Respeite as regras de hooks e o linter. Hooks customizados devem representar comportamento reutilizável, não apenas mover linhas.

### 12.3 Listas, formulários e modais

Use chaves estáveis relacionadas à identidade; não use índice em listas mutáveis. Atualize coleções de forma imutável.

Preserve modais globais, confirmações e feedbacks existentes.
Considere cancelamento, clique externo, confirmação, navegação do sistema, perda de dados e envio repetido.

### 12.4 Desempenho

Não use memoização sem custo real identificado. Evite consultas, cálculos pesados e listeners repetidos durante renderizações.

Otimização deve preservar clareza e ser proporcional a um problema observado.

## 13. Supabase

### 13.1 Cliente e consultas

Reutilize a instância e os serviços existentes do Supabase. Não crie clientes paralelos nem espalhe configuração pela interface.

Em toda consulta, confirme campos, filtros, ordenação, limites, relações e nulos.
Consultas financeiras também exigem revisão de:

- período e fuso horário;
- usuário ou proprietário;
- status e registros inativos;
- duplicidade causada por relações;
- sinal e unidade dos valores;
- paginação ou limite implícito.

### 13.2 Escritas e exclusões

Valide o payload antes de inserir ou atualizar e preserve campos não relacionados. Trate sucesso e erro explicitamente, evitando duplicidade, otimismo incorreto e recarga desnecessária.

Exclusão de registro é ação de alto risco. Só implemente ou execute quando claramente solicitada e autorizada, após avaliar relações, histórico e exclusão lógica.

### 13.3 Autorização e erros

Ocultar uma ação na interface não protege dados. Respeite autenticação, propriedade do registro e políticas de Row Level Security.

Nunca contorne políticas nem use credencial privilegiada no cliente. Não exponha detalhes internos do Supabase ou registre tokens, chaves e dados pessoais desnecessários.

## 14. Banco de Dados

Nunca altere automaticamente schema, tabelas, colunas, tipos, índices, funções, triggers, views, políticas ou constraints. Qualquer mudança estrutural exige autorização explícita e plano de migração revisável.

Uma proposta de migração deve explicar:

- problema e estado desejado;
- compatibilidade com dados existentes;
- backfill necessário;
- riscos de bloqueio ou perda;
- estratégia de validação;
- possibilidade de reversão;
- impacto no código cliente.

Não corrija dados históricos sem compreender a regra e obter autorização. Considere constraints, relações e políticas como parte do contrato do sistema.

Não presuma que desenvolvimento, homologação e produção possuem dados ou schema idênticos. Confirme o ambiente antes de qualquer operação autorizada e nunca use dados reais quando exemplos fictícios bastarem.

## 15. UI e UX

### 15.1 Consistência e responsividade

Preserve linguagem visual, espaçamento, cores, tipografia, bordas, ícones e padrões de interação. Uma tela nova deve parecer parte do ControlDriver, não um produto separado.

O uso móvel é essencial. Valide larguras pequenas, orientação paisagem quando relevante e desktop.

Evite sobreposições, áreas de toque pequenas, rolagem bloqueada e conteúdo dependente de hover. Considere teclado virtual, barras do navegador e altura dinâmica da viewport.

### 15.2 Estados e acessibilidade

Considere carregamento, conteúdo, ausência de dados, erro, ação em andamento, conclusão e indisponibilidade.
Não apresente ausência de dados como zero quando os significados forem diferentes.

Use elementos semânticos, rótulos claros e navegação por teclado quando aplicável. Botões apenas com ícone precisam de nome acessível; informação importante não pode depender apenas de cor.

### 15.3 Conteúdo

Use português claro e o vocabulário já adotado pelo produto. Confirmações devem explicar consequências e mensagens não devem expor termos técnicos internos.

Não altere nomenclaturas de domínio sem confirmar impacto em filtros, persistência e entendimento do usuário.

## 16. Segurança

Nunca execute sem autorização explícita:

- `git commit`;
- `git push`;
- `git merge`;
- `git reset`;
- `git checkout`;
- criação, troca, alteração ou exclusão de branch;
- exclusão de arquivos ou diretórios;
- renomeação de arquivos ou diretórios;
- movimentação de arquivos ou diretórios;
- comandos destrutivos;
- alteração de schema ou dados externos;
- publicação, deploy ou release.

Autorização para editar arquivos locais não autoriza operações Git ou ações externas. Autorização para uma ação específica não se estende automaticamente a ações semelhantes.

É igualmente obrigatório:

- nunca revelar ou versionar credenciais, tokens e segredos;
- nunca copiar dados sensíveis para logs;
- nunca desabilitar proteções para facilitar desenvolvimento;
- nunca contornar confirmação de ação destrutiva;
- nunca executar código desconhecido sem inspecioná-lo;
- nunca sobrescrever alterações do usuário;
- nunca presumir que arquivos não versionados podem ser descartados.

Em um diretório com alterações existentes, preserve-as e diferencie o que já existia do que foi produzido na tarefa.

## 17. Validação e Testes

Escolha validações proporcionais à superfície e ao risco. Uma mudança visual pede revisão de interface; um cálculo financeiro exige exemplos numéricos e consumidores relacionados.

Quando aplicável, execute:

1. verificação específica do módulo;
2. lint dos arquivos ou projeto;
3. build de produção;
4. testes automatizados existentes;
5. teste manual do cenário principal;
6. teste de cenários adjacentes;
7. revisão completa do diff.

Considere caminho principal, vazio, nulo, zero, limites, erro assíncrono, repetição da ação, dados antigos e viewports relevantes.
Para finanças, valide unidade, sinal, arredondamento e agregação; para datas, valide fuso, limites e viradas de período.

Não altere código fora do escopo apenas para fazer uma verificação global passar. Descubra se a falha foi introduzida pela tarefa ou já existia: corrija a primeira e relate a segunda com evidência.

## 18. Comunicação

Durante o trabalho, comunique investigação, decisões relevantes e bloqueios de forma breve.
Não sobrecarregue o usuário com cada comando mecânico.

Ao finalizar, informe somente:

- arquivos realmente alterados;
- resumo objetivo das mudanças realizadas;
- testes ou comandos executados;
- problemas ou dúvidas encontrados.

Use linguagem factual.
Nunca diga que corrigiu, implementou, validou ou testou algo que não foi realmente realizado.

Siga qualquer formato de entrega específico solicitado.
Melhorias fora do escopo devem apenas ser relatadas de forma curta, sem correção silenciosa.

Pergunte somente o que não puder ser descoberto com segurança no repositório.
Explique qual decisão está pendente e como a resposta muda a implementação.

## 19. Quando Parar

Pare e peça orientação diante de qualquer dúvida de negócio capaz de mudar o comportamento esperado.
Também pare quando:

- houver interpretações funcionais incompatíveis;
- for necessária operação destrutiva não autorizada;
- a solução exigir alteração de schema;
- existir risco de perda ou corrupção de dados;
- acessos necessários não estiverem disponíveis;
- for preciso ampliar materialmente o escopo;
- mudanças do usuário entrarem em conflito com a tarefa;
- não for possível distinguir ambiente seguro de ambiente real;
- o requisito contradizer um contrato crítico existente.

Antes de parar, esgote investigações seguras e somente leitura.
Ao comunicar o bloqueio, apresente evidência, impacto e a decisão necessária.

Não pare por mera dificuldade técnica.
Continue enquanto houver caminhos seguros, relevantes e dentro do escopo.

## 20. Checklist Final

Itens não aplicáveis podem ser ignorados conscientemente, nunca automaticamente.

### 20.1 Entendimento e investigação

- [ ] Li a solicitação completa e identifiquei o resultado observável.
- [ ] Identifiquei escopo, restrições e comportamentos preservados.
- [ ] Li integralmente todos os arquivos diretamente envolvidos.
- [ ] Li consumidores e dependências necessários.
- [ ] Reconstruí o fluxo de dados e eventos.
- [ ] Pesquisei implementações equivalentes.
- [ ] Reproduzi o problema ou obtive evidência equivalente.
- [ ] Confirmei a causa raiz, não apenas o sintoma.
- [ ] Não inventei decisões de negócio.

### 20.2 Solução e código

- [ ] Escolhi a menor mudança completa possível.
- [ ] Minimizei arquivos e contratos alterados.
- [ ] Preservei arquitetura e lógica fora do escopo.
- [ ] Reutilizei componentes, hooks, helpers e serviços adequados.
- [ ] Mantive uma fonte de verdade para cada regra.
- [ ] Evitei abstrações, estados e dependências desnecessários.
- [ ] Mantive responsabilidades na camada correta.
- [ ] Preservei compatibilidade com dados existentes.
- [ ] Tratei carregamento, vazio, sucesso e erro quando aplicável.
- [ ] Tratei nulos, zero, limites e repetição da ação.
- [ ] Não deixei logs temporários, código morto ou comentários acidentais.

### 20.3 React, dados e banco

- [ ] Estado é mínimo e valores derivados não foram duplicados.
- [ ] Efeitos são necessários, têm dependências corretas e limpeza.
- [ ] Listas usam chaves estáveis e atualizações imutáveis.
- [ ] Formulários e modais seguem padrões existentes.
- [ ] Reutilizei cliente e serviços do Supabase.
- [ ] Revisei filtros, períodos, usuário, status, nulos e duplicidades.
- [ ] Escritas preservam campos fora do escopo e tratam erros.
- [ ] Confirmei unidade, sinal, precisão e arredondamento.
- [ ] Não alterei schema nem dados históricos automaticamente.
- [ ] Não expus credenciais ou dados sensíveis.

### 20.4 UI e UX

- [ ] Preservei os padrões globais da interface.
- [ ] Verifiquei mobile, paisagem e desktop quando relevantes.
- [ ] Não criei sobreposição, toque difícil ou rolagem bloqueada.
- [ ] Estados assíncronos fornecem feedback adequado.
- [ ] Controles têm semântica, rótulos e foco adequados.
- [ ] Botões com ícone possuem nome acessível.
- [ ] Informação não depende somente de cor.
- [ ] Textos usam o vocabulário consistente do produto.

### 20.5 Segurança

- [ ] Preservei alterações preexistentes do usuário.
- [ ] Não excluí, movi ou renomeei arquivos.
- [ ] Não executei comandos destrutivos.
- [ ] Não fiz commit, push, merge, reset ou checkout.
- [ ] Não criei, troquei ou alterei branch.
- [ ] Não alterei ambiente externo, publiquei ou fiz deploy.
- [ ] Toda ação de alto risco possuía autorização explícita.

### 20.6 Validação, diff e entrega

- [ ] Testei o cenário principal e cenários adjacentes relevantes.
- [ ] Executei lint, build e testes aplicáveis.
- [ ] Diferenciei falhas novas de problemas preexistentes.
- [ ] Registrei somente comandos e resultados reais.
- [ ] Revisei o diff completo antes de concluir.
- [ ] Somente arquivos autorizados foram alterados.
- [ ] Não há mudanças acidentais de formatação ou encoding.
- [ ] Cada linha alterada é necessária e não há refatoração extra.
- [ ] Listei apenas arquivos realmente alterados.
- [ ] Resumi mudanças reais, testes, problemas e dúvidas.
- [ ] Segui o formato de entrega solicitado.

### 20.7 Padrões globais de formulários, seletores, modais e temas

- Campos obrigatórios são validados inline: todos os inválidos da etapa tremem uma vez, recebem destaque vermelho e exibem mensagem própria. Não use alerta, toast, `FeedbackModal` ou outro pop-up para obrigatoriedade.
- Ao corrigir um campo, remova seu erro imediatamente. Ao sair e retornar a uma etapa, limpe apenas os erros visuais e preserve os valores preenchidos.
- Seletores não usam a aparência nativa do navegador. Reutilize seletores compartilhados com campo clicável, modal ou painel, estado selecionado e comportamento responsivo.
- Modais reutilizam `ModalBase` ou estrutura equivalente com overlay que bloqueia a página, layout em coluna, header e footer fixos e somente a área central rolável.
- Cores estruturais usam os tokens globais de tema. Todo componente novo deve manter contraste e funcionamento nos temas claro e escuro.
- Inputs, listas, modais e seletores devem reutilizar os componentes compartilhados compatíveis antes da criação de uma variante local.

## 21. Princípio Final

Toda alteração deve deixar o ControlDriver preparado para continuar evoluindo.

Antes de concluir, pergunte:

> Esta mudança resolve a necessidade atual sem transferir risco, confusão ou custo desnecessário para o futuro?

Se a resposta não for claramente positiva, a tarefa ainda precisa de investigação, simplificação, validação ou decisão de negócio.

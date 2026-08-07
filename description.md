vamos lá:

esse repo servirá para gerarmos um projeto de um webapp (na prática um site) para uma pesquisa de biologia.

Basicamente, na pesquisa são feitas várias medições de plantas, essas medições precisam ser levantadas pra um banco de dados.

Cada medição possui:
- Bloco (um inteiro que indica a qual bloco a planta medida faz parte)
- Espécie (string, pode ser: CF,CV,CS,ED,ES,MB,MC,MF,MH,MG,JP,ST,SG)
- Tratamento (string, que pode ser T0,T1,T2,T3,T4,T5,T6,T7,T8,T9)
- Altura (float com 1 casa decimal sempre, ex 11.9) em cm
- Diametro (float com 2 casas decimais sempre, ex 1.96) em mm
- Folhas (um binário, sendo 1 para TEM folhas e 0 para NÃO TEM folhas)
- Sobrevivência (um binário, sendo 1 para está viva e 0 para morreu)
- Daninha (um binário, sendo 1 para TEM daninhas e 0 para NÃO TEM daninhas)
- Injúria (string, que podem ser AA,APC,FS,FM,H,P)
- Observação (texto, opcional)

As medições são feitas nessa ordem acima.

Nosso webapp terá inicialmente 2 páginas somente: a página principal (que é onde será feito o cadastro de cada medição) e uma segunda página para baixar relatório de acordo com os filtros, e uma terceira com um pequeno dashboard.

Vamos orquestrar tudo para testar e rodar localmente e posteriormente decidiremos as stacks para implementação de fato. Precisaremos de uma pasta no repo para o front, e outra para o back.

Pagina principal:

deverá ter:
    um campo para escrever o número do Bloco
    um dropdown para escolher a espécie (dentre aquelas descritas acima)
    um dropdown para escolher qual tratamento é (de t0 até t9)
    um campo para escrever a altura
    um campo para escrever o diametro
    um pequeno botão que ao ser pressionado alterna entre tem folhas e não tem folhas 
    um pequeno botão que ao ser pressionado alterna entre está viva e não está viva 
    um pequeno botão que ao ser pressionado alterna entre tem daninha e não tem daninha
    um campo para escolher quais injúrias a planta tem (considere que pode haver mais de uma injuria em cada medição)
    um campo para texto de observação
    um botão grande e evidente para salvar esses campos preenchidos pro banco de dados
    data da medição (preenchida automaticamente com o horário atual)

importante:
    temos um xls atualmente já com alguns dados coletados, e seria ideal ter uma forma para formatar o banco de dados com eles atualmente, para não precisarmos cadastrar tudo denovo.

Página de relatório:
essa segunda página deverá ter alguns campos com filtros, para que seja possível baixar um csv ou um xls com todos os dados (nenhum filtro) ou filtrado (por exemplo só com os blocos 10, ou só de tratamento t2, só das folhas mortas...etc)

Página de dashboard:
entraremos em detalhes posteriormente
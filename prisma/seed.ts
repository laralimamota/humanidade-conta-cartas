import { PrismaClient, CardType } from '@prisma/client';

const prisma = new PrismaClient();

const blackCards = [
  { text: 'O que me mantém acordado de noite é ___.', pick: 1 },
  { text: '___ é a nova tendência entre os jovens.', pick: 1 },
  { text: 'No meu país, ___ é considerado um esporte nacional.', pick: 1 },
  { text: 'Minha avó ficaria horrorizada se soubesse sobre ___.', pick: 1 },
  { text: 'O segredo para um casamento feliz é ___.', pick: 1 },
  { text: 'Quando eu era criança, sonhava em ser ___.', pick: 1 },
  { text: '___ é meu prazer secreto.', pick: 1 },
  { text: 'Estudos mostram que ___ melhora a produtividade em 50%.', pick: 1 },
  { text: 'O presidente declarou estado de emergência por causa de ___.', pick: 1 },
  { text: 'Meu terapeuta disse que eu preciso parar com ___.', pick: 1 },
  { text: 'A coisa mais estranha que já encontrei no metrô foi ___.', pick: 1 },
  { text: 'Minha mãe sempre dizia: "Se você não tem nada bom pra dizer sobre ___, não diga nada."', pick: 1 },
  { text: 'O novo filme da Marvel vai ser sobre ___.', pick: 1 },
  { text: '___ é a razão pela qual fui demitido.', pick: 1 },
  { text: 'Descobri que meu vizinho tem um hobby peculiar: ___.', pick: 1 },
  { text: 'A única coisa pior que ___ é ___.', pick: 2 },
  { text: 'Misturando ___ com ___, consegui criar uma nova religião.', pick: 2 },
  { text: '___ + ___ = Uma noite inesquecível.', pick: 2 },
  { text: 'O segredo da felicidade é substituir ___ por ___.', pick: 2 },
  { text: 'Meu médico recomendou ___ para tratar ___.', pick: 2 },
  { text: 'Em 2050, os historiadores vão lembrar desta época por ___.', pick: 1 },
  { text: 'O brasileiro médio não consegue viver sem ___.', pick: 1 },
  { text: 'Se eu pudesse jantar com qualquer pessoa, seria ___.', pick: 1 },
  { text: '___ é o que acontece quando você mistura Brasil com caipirinha.', pick: 1 },
  { text: 'Na minha família, Natal não é Natal sem ___.', pick: 1 },
  { text: 'O que realmente acontece na salinha do RH é ___.', pick: 1 },
  { text: 'Minha última pesquisa no Google foi: "Como se livrar de ___".', pick: 1 },
  { text: 'O motivo pelo qual não durmo direito é ___.', pick: 1 },
  { text: 'Se ___ fosse uma pessoa, seria meu melhor amigo.', pick: 1 },
  { text: 'A única coisa que salvou meu casamento foi ___.', pick: 1 },
  { text: 'No futuro, crianças vão estudar sobre ___ nas escolas.', pick: 1 },
  { text: 'O verdadeiro significado do Carnaval é ___.', pick: 1 },
  { text: 'Meu chefe me pegou fazendo ___ no trabalho.', pick: 1 },
  { text: 'O ingrediente secreto da minha receita de família é ___.', pick: 1 },
  { text: 'Acabei de criar um app que conecta ___ com ___.', pick: 2 },
  { text: 'O novo emoji da Apple representa ___.', pick: 1 },
  { text: 'Quando morrer, quero ser lembrado por ___.', pick: 1 },
  { text: 'A coisa mais ilegal que já fiz foi ___.', pick: 1 },
  { text: 'O WiFi deveria se chamar ___.', pick: 1 },
  { text: 'Minha desculpa favorita para faltar ao trabalho é ___.', pick: 1 },
];

const whiteCards = [
  { text: 'Comer feijoada às 3 da manhã' },
  { text: 'O cheiro de coxinha' },
  { text: 'Fingir que não está em casa quando a visita chega' },
  { text: 'Mandar áudio de 5 minutos no WhatsApp' },
  { text: 'A calcinha do padre' },
  { text: 'Roubar WiFi do vizinho' },
  { text: 'Chorar no banho' },
  { text: 'A sobrancelha da Gretchen' },
  { text: 'Um beijo de língua no Faustão' },
  { text: 'Fingir orgasmo' },
  { text: 'A dívida do cartão de crédito' },
  { text: 'Assistir Netflix com a ex' },
  { text: 'Mandar nude sem querer para o grupo da família' },
  { text: 'A ressaca de domingo' },
  { text: 'Fazer academia em janeiro e desistir em fevereiro' },
  { text: 'O cheiro de suvaco no metrô lotado' },
  { text: 'Stalkear o ex nas redes sociais' },
  { text: 'Comer brigadeiro da panela' },
  { text: 'Mentir no currículo' },
  { text: 'A cueca suja do seu pai' },
  { text: 'Peidar no elevador' },
  { text: 'O silêncio constrangedor depois de uma piada ruim' },
  { text: 'Perder a virgindade com o primo' },
  { text: 'A previdência que nunca vou ter' },
  { text: 'Usar Comic Sans em documento oficial' },
  { text: 'O chefe bêbado na festa da firma' },
  { text: 'Responder "ok" depois de um textão' },
  { text: 'A sogra' },
  { text: 'Fingir que leu os termos de uso' },
  { text: 'Boleto vencido' },
  { text: 'Corrupção' },
  { text: 'Meu ex' },
  { text: 'A sensação de alívio depois de um pum' },
  { text: 'Chupar dedo do pé' },
  { text: 'Abrir 47 abas no navegador' },
  { text: 'O medo de morrer sozinho' },
  { text: 'Vídeos de gatinhos' },
  { text: 'Um pacote de Doritos' },
  { text: 'Acordar às 5 da manhã para nada' },
  { text: 'O corpo do Silvio Santos' },
  { text: 'A playlist de sofrência' },
  { text: 'Fazer promessa e não cumprir' },
  { text: 'Fofoca do condomínio' },
  { text: 'O like do crush' },
  { text: 'Ficar sem bateria no celular' },
  { text: 'Cuspir no chão' },
  { text: 'Rir de defunto' },
  { text: 'A voz do Cid Moreira' },
  { text: 'Usar crocs com meia' },
  { text: 'O churrasco do tio no domingo' },
  { text: 'Falar "errou" quando alguém erra' },
  { text: 'Aquela tia que posta bom dia no grupo' },
  { text: 'O medo de ficar pobre' },
  { text: 'Fazer xixi no banho' },
  { text: 'Sexo no motel barato' },
  { text: 'O político da sua cidade' },
  { text: 'A foto 3x4 do RG' },
  { text: 'Funk proibidão' },
  { text: 'Fingir que está trabalhando' },
  { text: 'A paçoca que gruda no céu da boca' },
  { text: 'Emoji de berinjela' },
  { text: 'Herpes' },
  { text: 'A mitose das células' },
  { text: 'Memes de 2012' },
  { text: 'O cartão do SUS' },
  { text: 'Uma capivara' },
  { text: 'Pé de frango' },
  { text: 'Crush não correspondido' },
  { text: 'A última fatia de pizza' },
  { text: 'Escutar sertanejo universitário' },
  { text: 'Coçar o saco em público' },
  { text: 'A culpa católica' },
  { text: 'Um pirulito sabor tutti-frutti' },
  { text: 'Cheirar o próprio peido' },
  { text: 'Signo de Escorpião' },
  { text: 'Suruba gospel' },
  { text: 'Um travesseiro molhado de baba' },
  { text: 'A pinta suspeita nas costas' },
  { text: 'Comer miojo cru' },
  { text: 'O barulho da privada' },
  { text: 'Falta de ar condicionado no verão' },
  { text: 'Uma selfie constrangedora' },
  { text: 'O suor das axilas' },
  { text: 'Dividir Netflix com desconhecido' },
  { text: 'Dar ré em cima de alguém' },
  { text: 'Um cachorro vira-lata caramelo' },
  { text: 'As olheiras de segunda-feira' },
  { text: 'Um pé de meia furado' },
  { text: 'Esquentar marmita no micro-ondas da firma' },
  { text: 'Tomar banho gelado' },
];

async function main() {
  console.log('Seeding database...');

  // Clear existing cards
  await prisma.roundSubmissionCard.deleteMany();
  await prisma.roundSubmission.deleteMany();
  await prisma.round.deleteMany();
  await prisma.card.deleteMany();

  // Seed black cards
  for (const card of blackCards) {
    await prisma.card.create({
      data: {
        type: CardType.BLACK,
        text: card.text,
        pick: card.pick,
      },
    });
  }

  console.log(`Created ${blackCards.length} black cards`);

  // Seed white cards
  for (const card of whiteCards) {
    await prisma.card.create({
      data: {
        type: CardType.WHITE,
        text: card.text,
        pick: 1,
      },
    });
  }

  console.log(`Created ${whiteCards.length} white cards`);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

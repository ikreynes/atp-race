/* =========================================================
   ATP RACE — data.js
   Datos base del juego: países, nombres, banderas (SVG generado por JS),
   categorías de torneo, tienda, logros, info de sedes/trofeos, sponsors,
   y las funciones de registro de logros (fuertemente acopladas a ACHIEVEMENTS).
   Este archivo cambia poco de sesión a sesión — la lógica que sí se toca
   seguido vive en game.js.
========================================================= */


/* =========================================================
   DATOS BASE
========================================================= */
// EXPANSIÓN A 64 PAÍSES (sesión de "más países + Grupos Mundiales"): se sumaron 17 países nuevos
// y se sacó Costa Rica (no entraba en la lista de 64 que pidió el usuario — confirmar si fue a
// propósito o si en algún momento hay que volver a agregarla). Detalle completo del pedido del
// usuario, tier por tier, más abajo en COUNTRY_TIER_BIAS.
const COUNTRY_CODES = ["AR","BR","ES","FR","IT","US","GB","DE","SE","RS","CZ","AU","JP","RU","CN","CA","CH","NL","BE","PT","GR","PL","HR","NO","DK","FI","MX","CL","UY","PY","BO","PE","CO","EC","IN","KR","ZA","AT","HU","NZ","TN","MA","EG","TR","UA","SK","BG","TW","MC","LT","LU","BA","IL","KZ","RO","LB","HK","EE","SV","PK","SI","TH","CY","DO"];
const COUNTRY_NAMES = {AR:"Argentina",BR:"Brasil",ES:"España",FR:"Francia",IT:"Italia",US:"EE.UU.",GB:"Reino Unido",DE:"Alemania",SE:"Suecia",RS:"Serbia",CZ:"Rep. Checa",AU:"Australia",JP:"Japón",RU:"Rusia",CN:"China",CA:"Canadá",CH:"Suiza",NL:"Países Bajos",BE:"Bélgica",PT:"Portugal",GR:"Grecia",PL:"Polonia",HR:"Croacia",NO:"Noruega",DK:"Dinamarca",FI:"Finlandia",MX:"México",CL:"Chile",UY:"Uruguay",PY:"Paraguay",BO:"Bolivia",PE:"Perú",CO:"Colombia",EC:"Ecuador",IN:"India",KR:"Corea del Sur",ZA:"Sudáfrica",AT:"Austria",HU:"Hungría",NZ:"Nueva Zelanda",TN:"Túnez",MA:"Marruecos",EG:"Egipto",TR:"Turquía",UA:"Ucrania",
  SK:"Eslovaquia",BG:"Bulgaria",TW:"China Taipei",MC:"Mónaco",LT:"Lituania",LU:"Luxemburgo",BA:"Bosnia y Herzegovina",IL:"Israel",KZ:"Kazajstán",RO:"Rumania",LB:"Líbano",HK:"Hong Kong",EE:"Estonia",SV:"El Salvador",PK:"Pakistán",SI:"Eslovenia",TH:"Tailandia",CY:"Chipre",DO:"República Dominicana"};
const COUNTRY_GROUP = {
  AR:"hispano",ES:"hispano",MX:"hispano",CL:"hispano",UY:"hispano",PY:"hispano",BO:"hispano",PE:"hispano",CO:"hispano",EC:"hispano",SV:"hispano",DO:"hispano",
  BR:"brasil",
  US:"anglo",GB:"anglo",AU:"anglo",CA:"anglo",NZ:"anglo",ZA:"anglo",
  FR:"frances",BE:"frances",MC:"frances",
  IT:"italiano",
  DE:"aleman",AT:"aleman",CH:"aleman",LU:"aleman",
  SE:"nordico",NO:"nordico",DK:"nordico",FI:"nordico",EE:"nordico",
  RS:"eslavo",CZ:"eslavo",PL:"eslavo",HR:"eslavo",RU:"eslavo",UA:"eslavo",SK:"eslavo",BG:"eslavo",BA:"eslavo",KZ:"eslavo",RO:"eslavo",SI:"eslavo",
  JP:"asiatico",KR:"asiatico",CN:"asiatico",IN:"asiatico",TW:"asiatico",HK:"asiatico",PK:"asiatico",TH:"asiatico",
  NL:"otros",PT:"otros",GR:"otros",HU:"otros",TN:"otros",MA:"otros",EG:"otros",TR:"otros",LT:"otros",IL:"otros",LB:"otros",CY:"otros",
};
// NOTA: los países nuevos quedaron mapeados al grupo de nombres (NAME_POOLS) más cercano que ya
// existía, es una aproximación de sabor, no una clasificación lingüística estricta (ej. Lituania e
// Israel cayeron en "otros" por no tener un pool propio). Si en algún momento se justifica, se
// pueden armar pools de nombres dedicados para alguno de estos países.

// Tiers de fuerza tenística por país: cada país tiene una TENDENCIA (no una garantía) a producir
// tenistas un poco mejores o peores que el promedio del circuito. Grupos en espejo por cantidad de
// países (11-13-16-13-11 sobre 64 países). DELTAS ENSANCHADOS DE NUEVO esta sesión, de
// +4/+2/-0.5/-1.5/-4 a +4/+2/-1/-5/-10 (a pedido del usuario, tras ver que un Tier D todavía
// aparecía "demasiado seguido" compitiendo arriba). Validado con chequeo liviano (un pool sin
// simular temporadas): con los deltas viejos, un 19.5% de los D-tier llegaban a nivel ≥70
// (competitivos para ATP 500+); con estos deltas nuevos baja a ~11.8% — se reduce a la mitad, pero
// A PROPÓSITO no baja a cero: el usuario pidió explícitamente NO ponerle techo/tope duro a Tier D,
// para permitir alguna "Cenicienta" ocasional (un país débil que de casualidad saca un crack). Si
// en algún momento se quiere eliminar el outlier casi del todo, la palanca sería un techo duro al
// nivel máximo de Tier D en makeNPC() — decisión pendiente, el usuario prefirió no hacerlo por ahora.
// OJO: con esta combinación de deltas + cantidad de países por tier, la suma total NO da cero (da
// -121) — antes (con +4/+2/0/-2/-4) sí daba cero por espejo exacto S/D y A/C. Repartido entre los
// 64 países, el sesgo es de -121/64 ≈ -1.9 de nivel promedio por jugador generado — SÍ es un
// impacto real esta vez (bajó el nivel promedio del circuito de ~59 a ~57 en el chequeo liviano,
// ~3%), pero es el efecto BUSCADO por el usuario: "no me molesta que baje el promedio, mientras
// Tier S no se infle más" — el circuito general se vuelve un poco más manejable para el jugador sin
// que sus rivales más duros (S/A) se pongan más difíciles.
// Esta misma constante la usa makeNPC() TANTO para el pool fundador COMO para los debutantes
// (forceYoung=true) — es el mismo `tierBias` en las dos ramas de la fórmula, así que ensanchar los
// deltas acá automáticamente ensancha también la diferencia entre debutantes de países fuertes vs
// débiles, sin tocar nada más del código.
// Afecta ÚNICAMENTE a los NPCs generados en makeNPC() (tanto el pool fundador como los debutantes)
// — a pedido explícito del usuario, el país que elige EL JUGADOR nunca se ve afectado por este
// sistema, newPlayer() no lo consulta.
// Decidido con el usuario en sesión — no re-balancear sin confirmar antes.
const COUNTRY_TIER_BIAS = {
  // Tier S (+4, 11 países): Italia, España, Alemania, Bélgica, EE.UU., Francia, Rep. Checa, Rusia,
  // Australia, Austria, Argentina
  IT:4, ES:4, DE:4, BE:4, US:4, FR:4, CZ:4, RU:4, AU:4, AT:4, AR:4,
  // Tier A (+2, 13 países): Países Bajos, Canadá, Reino Unido, Chile, Croacia, Corea del Sur,
  // Hungría, Brasil, India, Finlandia, Dinamarca, Serbia, Ecuador
  NL:2, CA:2, GB:2, CL:2, HR:2, KR:2, HU:2, BR:2, IN:2, FI:2, DK:2, RS:2, EC:2,
  // Tier B (-1, default, 16 países — no hace falta listarlos con un valor propio porque no hay
  // forma de usar `|| 0` acá (el valor no es cero), así que quedan listados explícitamente):
  SK:-1, JP:-1, NO:-1, SE:-1, PE:-1, PL:-1, CH:-1, BG:-1, TW:-1, TR:-1, CO:-1, MC:-1, LT:-1, GR:-1, PT:-1, LU:-1,
  // Tier C (-5, 13 países): Bosnia y Herzegovina, Israel, Kazajstán, Nueva Zelanda, Egipto, China,
  // Rumania, Ucrania, Marruecos, México, Uruguay, Túnez, Líbano
  BA:-5, IL:-5, KZ:-5, NZ:-5, EG:-5, CN:-5, RO:-5, UA:-5, MA:-5, MX:-5, UY:-5, TN:-5, LB:-5,
  // Tier D (-10, 11 países): Hong Kong, Paraguay, Estonia, El Salvador, Pakistán, Sudáfrica,
  // Eslovenia, Tailandia, Bolivia, Chipre, República Dominicana (REEMPLAZARON a Irlanda e Islandia
  // esta sesión, a pedido del usuario)
  HK:-10, PY:-10, EE:-10, SV:-10, PK:-10, ZA:-10, SI:-10, TH:-10, BO:-10, CY:-10, DO:-10,
};

const NAME_POOLS = {
  hispano: { first:["Mateo","Bruno","Franco","Diego","Ignacio","Pablo","Iker","Enzo","Joaquín","Nicolás","Agustín","Santiago","Gonzalo","Tomás","Facundo","Rodrigo","Emiliano","Lautaro","Martín","Valentín","Sebastián","Matías","Andrés","Julián","Maximiliano","Federico","Alejandro","Cristian","Damián","Leandro","Nahuel","Fabián","Esteban","Ezequiel","Ramiro","Camilo","Rafael","Emilio","Guillermo","Adrián","Marcelo","Gustavo","Hernán","Bautista","Thiago","Benjamín","Vicente","Renzo","Simón","Elías","Dante","Cristóbal","Salvador","Gastón","Lisandro","Tobías","Ariel","Manuel","Juan","José","Carlos","Luis","Miguel","Ángel","Antonio","Francisco","Javier","Óscar","Raúl","Eduardo","Alberto","Roberto","Ricardo","Fernando","Jorge","Enrique","Daniel","David","Pedro","Sergio","Rubén","Ismael","Alan","Ian","Kevin","Brandon","Jonathan","Erick","Alexis","Axel","Jesús","Emmanuel","Israel","Uriel","Abel","Isaac","Josué","Moisés","Samuel","Gabriel","Rodolfo","Arturo","Alfredo","Armando","Ernesto","Genaro","Hugo","Iván","Jaime","Leonardo","Lorenzo","Mauricio","Máximo","Norberto","Octavio","Orlando","Osvaldo","Patricio","Ramón","Reinaldo","Rigoberto","Rolando","Walter","Bernardo","Domingo","Efraín","Elian","Felipe","Franklin","Gael","Gerónimo","Giovanni","Guido","Horacio","Humberto","Jeremías","Joel","Jonás","Jordi","Leonel","Marcos","Néstor","Rómulo","Saúl","Teodoro","Ulises","Wilfredo","Yago","Zacarías","Aarón","Eugenio","Florencio","Gregorio","Justino","Lázaro","Anselmo","Bartolomé"],
             last:["Ferraro","Vidal","Herrera","Duarte","Castillo","Delgado","Reyes","Torres","Aguilar","Rojas","Ibáñez","Sosa","Correa","Salinas","Peralta","Molina","Cano","Vega","Suárez","Bravo","Núñez","Cabrera","Godoy","Acosta","Paredes","Ríos","Miranda","Campos","Fuentes","Ortega","Guzmán","Espinoza","Carrasco","Lozano","Maldonado","García","Rodríguez","Martínez","López","González","Pérez","Sánchez","Ramírez","Flores","Gómez","Díaz","Cruz","Morales","Gutiérrez","Ortiz","Chávez","Ramos","Vargas","Castro","Jiménez","Romero","Álvarez","Mendoza","Silva","Ruiz","Medina","Aguirre","Vázquez","Contreras","Rosales","Navarro","Cortés","Domínguez","Robles","Escobar","Pizarro","Valenzuela","Bustos","Sepúlveda","Figueroa","Bermúdez","Zambrano","Villalobos","Cordero","Montoya","Palacios","Quintero","Solano","Meza","Prado","Cisneros","Osorio","Larrea","Andrade","Vera","Salazar","Yépez","Benítez","Franco","Rivas","Cárdenas","Pineda","Serrano","Barrios","Guerrero","Villegas","Espinal","Calderón","Moya","Segura","Cuevas","Bautista","Naranjo","Trujillo","Arce","Beltrán","Cifuentes","Toledo","Riquelme","Fajardo","Uribe","Zapata","Quiroga","Bahamondes","Farfán","Yupanqui","Chuquimia"] },
  brasil: { first:["Bruno","Rafael","Lian","Thiago","Gustavo","Caio","Matheus","Vinícius","Enzo","Kaique","Igor","Otávio","Renan","Danilo","Léo","Pedro","Lucas","Felipe","Gabriel","Rodrigo","André","Diego","Bernardo","Vitor","Murilo","Arthur","Nicolas","Marcelo","Guilherme","Eduardo","Emerson","Wesley","Anderson","Cauã","Heitor","Davi","Samuel","Miguel","Joaquim","Ricardo","Alexandre","Fábio","Cristiano","Everton","Marcos","Wallace","João","Paulo","Antônio","Fernando","Roberto","Sérgio","Carlos","José","Francisco","Luiz","Márcio","Leandro","Adriano","Alan","Alex","Breno","Cauê","Daniel","Douglas","Elias","Fabrício","Gilberto","Hélio","Henrique","Ivan","Jefferson","Jonathan","Júlio","Kléber","Maicon","Nelson","Nilton","Raul","Renato","Robson","Rogério","Sandro","Silas","Tiago","Valter","Vagner","Washington","Yago","Alisson","Bento","Caetano","Célio","Cézar","Edmilson","Edson","Elton","Emanuel","Erasmo","Ewerton","Fagner","Flávio","Geraldo","Hamilton","Jean","Jorge","Josimar","Kaio","Lauro","Luan","Luís","Manoel","Nilo","Osmar","Paulinho","Ronaldo","Rui","Sávio","Tadeu","Valdir","Wagner","Zeca"],
            last:["Souza","Oliveira","Cardoso","Barros","Pereira","Nogueira","Teixeira","Ramalho","Guimarães","Correia","Farias","Azevedo","Moraes","Lima","Ribeiro","Carvalho","Machado","Melo","Duarte","Rezende","Andrade","Castro","Vieira","Monteiro","Silva","Santos","Costa","Almeida","Nascimento","Araújo","Fernandes","Rodrigues","Gonçalves","Martins","Rocha","Dias","Batista","Freitas","Barbosa","Cavalcanti","Cunha","Pinto","Moura","Ferreira","Lopes","Alves","Sales","Xavier","Peixoto","Coutinho","Sampaio","Brandão","Siqueira","Tavares","Bezerra","Marques","Amaral","Pacheco","Fontes","Leal","Nery"] },
  anglo: { first:["Owen","Ethan","James","Jack","Harrison","Cooper","Liam","Noah","Ryan","Callum","Blake","Toby","Finn","Miles","Oscar","Wyatt","Kai","Connor","Lucas","Nathan","Aiden","Zachary","Riley","Dylan","Hunter","Jordan","Mason","Elliot","Spencer","Reid","Tanner","Cole","Henry","William","Charlie","Max","Adam","Grant","Logan","Carter","Brody","Grayson","Beckett","Jasper","Sawyer","Silas","Rhys","Declan","Preston","Wesley","Graham","Marcus","George","Thomas","Alexander","Benjamin","Samuel","Joseph","Daniel","Matthew","Andrew","Christopher","Nicholas","Anthony","Joshua","Jacob","Michael","David","Robert","John","Peter","Edward","Richard","Simon","Patrick","Sean","Aaron","Isaac","Elijah","Caleb","Jeremiah","Nathaniel","Theodore","Sebastian","Vincent","Julian","Xavier","Dominic","Felix","Gabriel","Leon","Malcolm","Bruce","Dean","Trevor","Curtis","Gordon","Neil","Ross","Craig","Stuart","Ewan","Rory","Angus","Fraser","Lewis","Cameron","Bradley","Shane","Wade","Colby","Chase","Garrett","Landon","Nolan","Brayden","Caden","Jaxon","Bentley","Emerson","Griffin","Weston","Sterling","Harvey","Freddie","Archie","Alfie","Bertie","Reggie","Percy","Clive","Nigel","Roy","Trent","Corey","Warren","Byron","Terrence","Vernon","Norman","Winston","Edmund","Leopold"],
           last:["Whitfield","Bennett","Carter","Bishop","Hartley","Sinclair","Marsh","Prescott","Doyle","Fenwick","Lawson","Ashford","Colton","Grier","Sullivan","Mercer","Whitmore","Kingsley","Barlow","Redmond","Fairweather","Holloway","Chandler","Winters","Blackwood","Sterling","Osborne","Tucker","Radcliffe","Merritt","Smith","Johnson","Williams","Brown","Taylor","Wilson","Davies","Evans","Thomas","Roberts","Walker","Wright","Robinson","Thompson","White","Harris","Clarke","Cooper","Ward","Turner","Parker","Collins","Edwards","Stewart","Morris","Murphy","Reid","Kelly","Fraser","Douglas","Campbell","Murray","Hamilton","Mitchell","Wallace","O'Brien","O'Connor","Kennedy","Fitzgerald","Bryant","Foster","Graham","Newton","Palmer","Reeves","Sheppard","Vaughan","Yates","Botha","Van der Merwe","Pretorius","Nkosi","Dlamini"] },
  frances: { first:["Théo","Hugo","Léo","Nathan","Maxime","Antoine","Julien","Baptiste","Clément","Louis","Adrien","Mathis","Romain","Simon","Alexandre","Victor","Pierre","Quentin","Benjamin","Nicolas","Gabriel","Thibault","Enzo","Rémi","Valentin","Guillaume","Arthur","Corentin","Florian","Damien","Yohann","Sébastien","Kylian","Mathéo","Noé","Lucas","Jules","Paul","Étienne","Bastien","Cyril","Fabien","Grégoire","Hervé","Ivan","Joël","Kevin","Laurent","Marc","Noël","Olivier","Patrice","Raphaël","Serge","Tristan","Vianney","Xavier","Yann","Alain","Bernard","Christophe","Denis","Éric","François","Gérard","Henri","Jean","Michel","Pascal","Régis","Stéphane","Thierry","Aurélien","Brice","Cédric","Dorian","Émile","Fabrice","Gaël","Ilan","Jérôme","Killian","Loïc","Mickaël","Nolan","Owen","Priam","Rayan","Solal","Timothée","Ulysse","Wilfried","Yanis","Zacharie"],
             last:["Roux","Moreau","Fontaine","Girard","Lefevre","Renard","Chevalier","Dubois","Lacroix","Marchand","Bertrand","Perrin","Boucher","Gauthier","Fournier","Mercier","Blanchard","Rousseau","Lemoine","Guerin","Martin","Bernard","Petit","Durand","Leroy","Simon","Laurent","Michel","Garcia","David","Lefebvre","Faure","Andre","Blanc","Muller","Henry","Robin","Clement","Morel","Nicolas","Vincent","Chevallier","Robert","Colin","Noel","Meunier","Legrand","Denis","Dumas","Marie","Bourgeois","Poirier","Verstraete","Peeters","Janssens","Maes"] },
  italiano: { first:["Marco","Luca","Matteo","Davide","Riccardo","Andrea","Leonardo","Gabriele","Federico","Alessio","Stefano","Simone","Lorenzo","Nicolò","Giacomo","Tommaso","Filippo","Emanuele","Alberto","Fabio","Francesco","Antonio","Giovanni","Salvatore","Christian","Diego","Edoardo","Michele","Roberto","Vincenzo","Pietro","Enrico","Massimo","Cristian","Samuele","Giuseppe","Domenico","Alessandro","Angelo","Carlo","Dario","Ettore","Fausto","Gino","Ivano","Lino","Mauro","Nicola","Ottavio","Piero","Sandro","Tullio","Umberto","Valerio","Aldo","Carmine","Flavio","Germano","Ilario","Lodovico","Manfredi","Nino","Orazio","Pierluigi","Quirino","Raimondo","Silvio","Tancredi","Vito","Adriano","Benito","Corrado","Duilio","Eros","Fiorenzo","Gaetano","Igor","Leone","Massimiliano","Nunzio","Osvaldo","Pio","Remo","Settimio","Ugo","Walter","Zeno","Amedeo","Cesare","Ercole","Guglielmo"],
              last:["Mancini","Bianchi","Ferretti","Conti","Greco","Longo","Marino","Villa","Barbieri","Ferrero","Rinaldi","Colombo","Romano","Gallo","Ricci","Bruno","De Luca","Moretti","Fontana","Caruso","Russo","Esposito","Rossi","Costa","Marchetti","Rizzo","Lombardi","Barone","Santoro","Mariani","Cattaneo","Pellegrini","Testa","Gatti","Sartori","Leone","Farina","Basile","Riva","Milani","Coppola","Serra","De Santis","Vitale","Amato","Grasso","Fabbri","Orlando","Damico","Costantini","Marini"] },
  aleman: { first:["Lukas","Erik","Felix","Jonas","Niklas","Moritz","Leon","Tobias","Finn","Julian","Simon","Maximilian","Paul","Fabian","David","Sebastian","Jan","Philipp","Dominik","Marius","Florian","Matthias","Christian","Andreas","Benedikt","Konstantin","Johannes","Elias","Henrik","Robin","Marcel","Timo","Alexander","Georg","Kevin","Michael","Stefan","Thomas","Markus","Frank","Peter","Klaus","Werner","Dieter","Hans","Wolfgang","Bernd","Rainer","Uwe","Jürgen","Manfred","Rolf","Herbert","Günther","Horst","Helmut","Erwin","Otto","Karl","Kurt","Reinhard","Norbert","Gerd","Detlef","Volker","Achim","Oliver","Sven","Ralf","Steffen","Torsten","Enrico","Falk","Gunnar","Ingo","Malte","Nico","Ole","Piet","Rüdiger","Volkmar","Wieland","Adalbert","Berthold","Cornelius","Dietmar","Eberhard","Friedrich","Gottfried","Heinrich","Ilja","Konrad","Ludwig","Oskar","Quirin","Reinhold","Siegfried","Traugott","Ulrich","Waldemar","Xaver","Yannick","Zacharias"],
            last:["Weber","Adler","Brandt","Kessler","Hoffmann","Vogel","Richter","Baumann","Krüger","Lindner","Wagner","Stein","Fischer","Schulz","Hartmann","Zimmermann","Braun","Krause","Lehmann","Schreiber","Müller","Schmidt","Schneider","Meyer","Wolf","Schröder","Neumann","Schwarz","Zimmer","Klein","Werner","Schmitt","Huber","Mayer","Vogt","Frank","Berger","Jung","Simon","Beck","Roth","Winkler","Fuchs","Keller","Frei","Baur","Meier","Steiner","Egger","Widmer","Peter"] },
  nordico: { first:["Erik","Aleksander","Oskar","Emil","Viktor","Anders","Elias","Magnus","Nils","Sander","Henrik","Kristian","Fredrik","Johan","Mikael","Sebastian","Gustav","Aksel","Olav","Bjørn","Lars","Rasmus","Jesper","Karsten","Thomas","Peter","Martin","Andreas","Simon","Mathias","Jonas","Tobias","Adrian","Emanuel","Kasper","Sven","Håkan","Stellan","Torbjörn","Ulf","Alvar","Bertil","Conrad","Dag","Einar","Folke","Gunnar","Halvard","Ingvar","Jarl","Kjell","Leif","Mats","Ove","Preben","Roar","Sigurd","Trygve","Vidar","Ask","Bo","Casper","Dennis","Eskil","Filip","Gustaf","Herman","Ingemar","Knut","Lennart","Melker","Niklas","Oscar","Pontus","Rikard","Sixten","Torkel","Urban","Vilhelm","Wilmer","Åke","Alfred","Arvid","Christoffer","Didrik","Edvin","Frans","Gösta","Hjalmar","Isak","Joel","Karl","Ludvig","Nikolaj","Otto","Patrik","Sigmund","Valter","Yngve"],
             last:["Larsson","Bergman","Lindqvist","Karlsson","Nystrom","Holm","Solberg","Andersen","Virtanen","Jonsson","Berg","Dahl","Lund","Eriksson","Kristiansen","Halvorsen","Nilsen","Aho","Korhonen","Mäkinen","Andersson","Johansson","Nilsson","Svensson","Gustafsson","Persson","Olsson","Hansen","Pedersen","Jensen","Kristensen","Rasmussen","Nielsen","Sørensen","Mikkelsen","Aalto","Laine","Heikkinen","Koskinen","Järvinen","Lindberg","Sundqvist","Åberg","Blomqvist","Wikström","Fridriksson","Sigurdsson","Jónsson","Magnusson","Þórsson"] },
  eslavo: { first:["Aleks","Andrei","Novak","Milan","Petar","Vladimir","Dušan","Marek","Tomasz","Ivan","Kacper","Filip","Nikola","Bogdan","Stefan","Luka","Vuk","Goran","Bartek","Adam","Dmitri","Igor","Sergei","Pavel","Jakub","Krzysztof","Mateusz","Radovan","Zoran","Mihail","Marko","Nemanja","Dario","Branislav","Aleksandar","Damir","Milorad","Ognjen","Vojislav","Boris","Denis","Timofey","Artem","Roman","Yuri","Andrey","Alexei","Anton","Bohdan","Bojan","Cyril","Darko","Grigory","Henryk","Ilya","Jarosław","Jovan","Kamil","Leszek","Lukáš","Maciej","Miloš","Mirko","Nikita","Oleg","Piotr","Radek","Rafał","Sasha","Slavomír","Tibor","Vasily","Vitaly","Zdeněk","Zlatko","Aleš","Czesław","Feliks","Grzegorz","Hubert","Ivo","Ladislav","Marian","Přemysl","Ratko","Slaven","Tihomir","Vojtěch","Wiktor","Zbigniew","Andrzej","Bartosz","Cvetko","Danijel","Emir","Franjo","Gojko","Hrvoje","Ilija"],
            last:["Kowalski","Dvorak","Novak","Petrov","Popov","Kovac","Nowak","Zielinski","Horvat","Sokolov","Wojcik","Novotny","Kaczmarek","Lewandowski","Jankovic","Simic","Todorov","Mikhailov","Volkov","Pavlović","Marinković","Duda","Wisniewski","Kubiak","Baranov","Orlov","Stanković","Radić","Kralj","Novosad","Kovačević","Petrović","Jovanović","Nikolić","Ilić","Đorđević","Popović","Mihajlović","Kostić","Vuković","Babić","Matić","Perić","Knežević","Antić","Filipović","Kralik","Prochazka","Svoboda","Cerny","Marek","Fiala","Kucera","Sedlak","Kowalczyk","Wojciechowski","Kaminski","Szymanski","Woźniak","Dabrowski","Mazur","Baran","Jablonski","Zajac","Jurić","Marić","Kovač","Blažević","Šimić","Barišić","Vuletić","Grbić","Ivanov","Sidorov","Fedorov","Morozov","Kuznetsov","Sokolova","Kovalenko","Bondarenko","Tkachenko","Melnyk","Shevchenko","Kravchenko"] },
  asiatico: { first:["Kenji","Ravi","Haruto","Minjun","Wei","Arjun","Sora","Daichi","Rohan","Siddharth","Junho","Takumi","Hiroshi","Jian","Yusuke","Aarav","Vikram","Dae-hyun","Seojun","Kaito","Ren","Sota","Yuto","Riku","Taiga","Hyun-woo","Min-jae","Do-yun","Ji-hoon","Tao","Lei","Bo","Aditya","Karthik","Nikhil","Hiroto","Kenta","Yamato","Shohei","Sho","Ryota","Kaoru","Naoki","Tatsuya","Akira","Kazuki","Shun","Shin","Tetsuya","Minato","Isamu","Jun","Kohei","Hideki","Satoshi","Yuki","Ken","Genki","Daisuke","Masato","Ryo","Taro","Susumu","Ichiro","Katsuya","Min-ho","Jae-won","Sung-min","Tae-yang","Woo-jin","Joon-ho","Yong-jae","Hyun-jun","Seung-hyun","Kang-min","Bo-min","Chan-woo","Dong-hyun","Eun-woo","Gi-tae","Han-sol","Il-sung","Ji-woo","Kyu-hyun","Myung-hoon","Nam-gil","Rae-won","Sang-woo","Tae-woo","Woo-sung","Xiang","Chen","Yong","Ming","Feng","Hao","Long","Peng","Qiang","Rui","Sheng","Wen","Xin","Zhi","Anand","Deepak","Gaurav","Harsh","Ishaan","Jatin","Kabir","Lakshay","Manoj","Naveen","Om","Pranav","Rahul","Sameer","Tarun","Umesh","Vivek","Yash","Zubin","Arnav","Dev","Girish","Harish","Ishan","Kunal"],
              last:["Nakamura","Yamada","Okafor","Singh","Chen","Tanaka","Kobayashi","Park","Watanabe","Rao","Kimura","Suzuki","Sato","Wang","Zhang","Ito","Yoshida","Sharma","Gupta","Han","Takahashi","Yamamoto","Saito","Matsumoto","Inoue","Kato","Yamaguchi","Hayashi","Shimizu","Mori","Kim","Lee","Choi","Jung","Kang","Cho","Yoon","Jang","Lim","Liu","Yang","Huang","Zhao","Wu","Xu","Sun","Zhou","Ma","Patel","Kumar","Reddy","Verma","Nair","Iyer","Menon","Joshi"] },
  otros: { first:["Sami","Yusuf","Emre","Jarrah","Milo","Kostas","Rui","Zoltan","Bilal","Ahmet","Youssef","Dimitris","Tiago","Hamza","László","Omar","Karim","Vasco","Nuno","Mehmet","Andreas","Ioannis","Panos","Nikos","Christos","Miklós","Gábor","Péter","Tamás","Reza","Farid","Tariq","Adem","Baran","Cenk","Jan","Willem","Pieter","Hendrik","Cornelis","Bram","Daan","Sander","Thijs","Bas","Wouter","Joris","Maarten","Ruben","Teun","Dirk","Gerrit","Huib","Job","Koen","Lars","António","Manuel","Duarte","Gonçalo","Henrique","Miguel","Filipe","João","Simão","Bernardo","Constantinos","Dimitrios","Georgios","Iraklis","Konstantinos","Leonidas","Marios","Nektarios","Odysseas","Pavlos","Spyros","Theodoros","Vasilis","Xenofon","Zisis","Attila","Balázs","Csaba","Dénes","Előd","Ferenc","Géza","Huba","Imre","Jenő","Kálmán","Levente","Márk","Örs","Pál","Roland","Szabolcs","Zsolt","Amine","Anas","Fahim","Habib","Idriss","Jamal","Khalid","Mounir","Nabil","Rachid","Said","Tarek","Walid","Yassine","Abdullah","Cem","Deniz","Ercan","Furkan","Halil","Ismail","Kaan","Levent","Murat","Onur","Selim"],
           last:["Costa","Silva","Demir","Yilmaz","Papadopoulos","Nagy","Kovacs","Amrani","Haddad","Popescu","Alves","Pereira","Doğan","Şahin","Papadakis","Horvath","Tóth","Cherif","Bouzid","Karimi","de Jong","Jansen","Bakker","Visser","Smit","Meijer","Bos","Vos","Peters","Hendriks","Ferreira","Rodrigues","Marques","Gomes","Fonseca","Cardoso","Ramos","Nunes","Georgiou","Nikolaou","Konstantinou","Antoniou","Christodoulou","Ionescu","Dumitrescu","Stoica","Marin","Radu","Boujemaa","Benali","Idrissi","Mansour","Farouk","Sayed","Abdel-Rahman","Kaya","Aydın","Öztürk","Çelik","Arslan","Molnár","Kovács","Szabó","Varga","Balogh","Farkas","Németh"] },
};

const ECO_SURNAMES = {
  hispano: ["Nadales","Ferreró","Muguruzán","Alcaraztí","Moyanes","Verdascón","Del Potrín","Almagrete","Schwartzman","Coriano","Berlocqui","Zeballosti","Cerúndolo","Baezoso","Etchevarri","Garinesco","Ríos-Gómez","Chela-Coria","Bustante","Guaú-Massú","Vilasino","Orantesín","Puerteño"],
  brasil: ["Kuerten-Jr","Bellucchi","Melzinho","Soarinha","Meligenio","Guganeiro","Zaneiro","Boviano"],
  anglo: ["Sampranov","Ashefield","Connorson","Aggasian","Courierón","Isneroski","Fritzner","Opelkoski","Sheltonoff","Querreyón","Paulsonby","Tiafoemon","Ruudbeck","Chang-Wong","Rosewalley","Newcomberg","Roddicksen","Blaketon","Hewittley"],
  eslavo: ["Djokovix","Ivanovac","Kuznetsov","Medvedín","Rublyov","Safínov","Kafelnik","Chachanov","Khachanov","Kovalenko","Ostapenko","Zvereva","Sharapov","Kuchárova","Cibulkov"],
  aleman: ["Beckerhoff","Grafenberg","Zverovsky","Struffalo","Kerbermann","Haasenoff","Sieboldt","Petzschke","Görgeson"],
  frances: ["Noahmont","Pierrenoah","Tsongandre","Monfilsán","Gasquette","Simonoux","Mahutien","Pouillín","Mladenov","Halepescu"],
  italiano: ["Panatta","Sinnerelli","Fogninetti","Berretini","Musettone","Camerini","Barazzuti","Pietrangeli"],
  nordico: ["Borglund","Edbergsson","Ruudberg","Söderling","Wilander","Larsholm","Ljungqvist","Nyström","Ahlgren","Björkman","Norrgård","Enqvist"],
  asiatico: ["Naomura","Nishikori","Osakawa","Chan-Wong","Kubotani","Nishioka","Zhengxin","Rybakina","Bencic-Yu","Halepova"],
  otros: ["Federmann","Wawrinsky","Thiemann","Cilicevic","Dimitrovac","Tsitsipas","Rublevio","Baghdadis","Karlovic","Coricente","Krajinov","Basilash","Hrbatyov"],
};

// Registro global de nombres completos ya usados en la partida en curso, para evitar duplicados
// tanto en la generación inicial del pool como en los debutantes que se suman año a año.
let usedFullNames = new Set();
function resetUsedFullNames(){ usedFullNames = new Set(); }

function randNameFor(countryCode, avoidSet){
  const group = COUNTRY_GROUP[countryCode] || "otros";
  const pool = NAME_POOLS[group];
  const used = avoidSet || usedFullNames;
  function buildOne(){
    const first = pool.first[Math.floor(Math.random()*pool.first.length)];
    let last;
    // bajamos la probabilidad de apellido "eco" (antes 25%) porque en pools chicos generaba
    // colisiones frecuentes al haber pocas combinaciones distintas.
    if(ECO_SURNAMES[group] && Math.random()<0.12){
      const eco = ECO_SURNAMES[group];
      last = eco[Math.floor(Math.random()*eco.length)];
    } else {
      last = pool.last[Math.floor(Math.random()*pool.last.length)];
    }
    return first+" "+last;
  }
  let name, intentos = 0;
  do{ name = buildOne(); intentos++; } while(used.has(name) && intentos < 40);
  if(used.has(name)){
    // Se agotaron los reintentos (pool muy exigido): garantizamos unicidad combinando
    // un segundo apellido del mismo pool en vez de repetir el nombre completo.
    let intentos2 = 0, altName;
    do{
      const extraLast = pool.last[Math.floor(Math.random()*pool.last.length)];
      altName = name + " " + extraLast;
      intentos2++;
    } while(used.has(altName) && intentos2 < 20);
    name = altName;
  }
  used.add(name);
  return name;
}
function flagEmoji(code){ return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + (c.charCodeAt(0)-65))); }
function hStripes(colors){
  const n=colors.length, hh=1/n;
  return colors.map((c,i)=>({s:'r',x:0,y:i*hh,w:1,h:hh+0.01,c}));
}
function vStripes(colors){
  const n=colors.length, ww=1/n;
  return colors.map((c,i)=>({s:'r',x:i*ww,y:0,w:ww+0.01,h:1,c}));
}
// Escudo ajedrezado chico (tipo "šahovnica" croata): grilla de rectángulos alternando 2 colores,
// pensado para superponerse sobre otra bandera ya armada (ej. las franjas de Croacia). Simplificado
// a propósito — a este tamaño de ícono (16-26px) un escudo con el detalle real no se leería.
function checkerShield(x0,y0,w,h,cols,rows,colorA,colorB){
  const cw=w/cols, ch=h/rows;
  const layers=[];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      layers.push({s:'r',x:x0+c*cw,y:y0+r*ch,w:cw+0.004,h:ch+0.004,c:(r+c)%2===0?colorA:colorB});
    }
  }
  return layers;
}
function crossLayers(bg,cross,border){
  const L=[{s:'r',x:0,y:0,w:1,h:1,c:bg}];
  if(border){
    L.push({s:'r',x:0.29,y:0,w:0.19,h:1,c:border});
    L.push({s:'r',x:0,y:0.37,w:1,h:0.19,c:border});
  }
  L.push({s:'r',x:0.32,y:0,w:0.13,h:1,c:cross});
  L.push({s:'r',x:0,y:0.4,w:1,h:0.13,c:cross});
  return L;
}
function centeredCrossLayers(bg,cross){
  // cruz suiza: chica y flotante, sin tocar los bordes (para no confundirse con las cruces nórdicas)
  return [
    {s:'r',x:0,y:0,w:1,h:1,c:bg},
    {s:'r',x:0.41,y:0.22,w:0.18,h:0.56,c:cross},
    {s:'r',x:0.28,y:0.4,w:0.44,h:0.2,c:cross},
  ];
}
function saltireLayers(bg,white,red){
  const dtW=0.13, dtR=0.055;
  const bandTLBR = (dt,c)=>({s:'po', pts:[[0,0],[dt,0],[1,1-dt],[1,1],[1-dt,1],[0,dt]], c});
  const bandTRBL = (dt,c)=>({s:'po', pts:[[1,0],[1,dt],[dt,1],[0,1],[0,1-dt],[1-dt,0]], c});
  return [
    {s:'r',x:0,y:0,w:1,h:1,c:bg},
    bandTLBR(dtW,white), bandTRBL(dtW,white),
    bandTLBR(dtR,red), bandTRBL(dtR,red),
  ];
}
function unionJackLayers(){
  return saltireLayers('#00247D','#FFFFFF','#CF142B').concat([
    {s:'r',x:0.42,y:0,w:0.16,h:1,c:'#FFFFFF'},
    {s:'r',x:0,y:0.38,w:1,h:0.24,c:'#FFFFFF'},
    {s:'r',x:0.465,y:0,w:0.07,h:1,c:'#CF142B'},
    {s:'r',x:0,y:0.435,w:1,h:0.13,c:'#CF142B'},
  ]);
}
function scaleLayers(layers,x0,y0,w,h){
  return layers.map(l=>{
    if(l.s==='r') return {s:'r',x:x0+l.x*w,y:y0+l.y*h,w:l.w*w,h:l.h*h,c:l.c};
    if(l.s==='po') return {s:'po',pts:l.pts.map(p=>[x0+p[0]*w,y0+p[1]*h]),c:l.c};
    if(l.s==='ci') return {s:'ci',x:x0+l.x*w,y:y0+l.y*h,r:l.r*Math.min(w,h),c:l.c};
    return l;
  });
}
function navyCantonLayers(bg, opts){
  // bandera lisa con un cantón tipo Union Jack real (a escala) + estrellitas de la Cruz del Sur (AU/NZ).
  // Parametrizada para poder diferenciar Australia de Nueva Zelanda (antes usaban exactamente los
  // mismos parámetros y quedaban idénticas): AU tiene 5 estrellas BLANCAS (4 grandes + la "estrella
  // de la Mancomunidad" chica extra, debajo del Jack) y NZ tiene 4 estrellas ROJAS con borde blanco,
  // sin la estrella extra — igual que en las banderas reales.
  const o = opts || {};
  const starColor = o.starColor || '#FFFFFF';
  const starStroke = o.starStroke || null;
  const jackMini = scaleLayers(unionJackLayers(), 0, 0, 0.5, 0.5);
  const layers = [
    {s:'r',x:0,y:0,w:1,h:1,c:bg},
    ...jackMini,
  ];
  if(o.commonwealthStar){
    layers.push({s:'st',x:0.24,y:0.72,r:0.075,c:starColor,stroke:starStroke});
  }
  const sizeMul = o.starStroke ? 1.25 : 1; // estrellas con borde (NZ) un poco más grandes, como en la bandera real
  layers.push(
    {s:'st',x:0.79,y:0.26,r:0.06*sizeMul,c:starColor,stroke:starStroke},
    {s:'st',x:0.9,y:0.52,r:0.075*sizeMul,c:starColor,stroke:starStroke},
    {s:'st',x:0.74,y:0.78,r:0.06*sizeMul,c:starColor,stroke:starStroke},
    {s:'st',x:0.58,y:0.92,r:0.045*sizeMul,c:starColor,stroke:starStroke},
  );
  return layers;
}

const FLAG_COLORS = {
  AR:{bg:'#74ACDF',L:[...hStripes(['#74ACDF','#FFFFFF','#74ACDF']),{s:'ci',x:0.5,y:0.5,r:0.09,c:'#F6B40E'}]},
  BR:{bg:'#009C3B',L:[{s:'r',x:0,y:0,w:1,h:1,c:'#009C3B'},{s:'po',pts:[[0.5,0.15],[0.92,0.5],[0.5,0.85],[0.08,0.5]],c:'#FEDD00'},{s:'ci',x:0.5,y:0.5,r:0.14,c:'#002776'}]},
  ES:{L:[{s:'r',x:0,y:0,w:1,h:0.25,c:'#AA151B'},{s:'r',x:0,y:0.25,w:1,h:0.5,c:'#F1BF00'},{s:'r',x:0,y:0.75,w:1,h:0.25,c:'#AA151B'}]},
  FR:{L:vStripes(['#0055A4','#FFFFFF','#EF4135'])},
  IT:{L:vStripes(['#008C45','#FFFFFF','#CD212A'])},
  US:{L:[...hStripes(['#B22234','#FFFFFF','#B22234','#FFFFFF','#B22234']),{s:'r',x:0,y:0,w:0.42,h:0.55,c:'#3C3B6E'},
    // Detalle de estrellitas en el cantón (no las 50 reales, solo un puñado a modo de guiño visual).
    {s:'st',x:0.07,y:0.09,r:0.045,c:'#FFFFFF'},{s:'st',x:0.18,y:0.09,r:0.045,c:'#FFFFFF'},{s:'st',x:0.29,y:0.09,r:0.045,c:'#FFFFFF'},
    {s:'st',x:0.12,y:0.2,r:0.045,c:'#FFFFFF'},{s:'st',x:0.23,y:0.2,r:0.045,c:'#FFFFFF'},{s:'st',x:0.34,y:0.2,r:0.045,c:'#FFFFFF'},
    {s:'st',x:0.07,y:0.31,r:0.045,c:'#FFFFFF'},{s:'st',x:0.18,y:0.31,r:0.045,c:'#FFFFFF'},{s:'st',x:0.29,y:0.31,r:0.045,c:'#FFFFFF'},
  ]},
  GB:{L:unionJackLayers()},
  DE:{L:hStripes(['#000000','#DD0000','#FFCE00'])},
  SE:{L:crossLayers('#006AA7','#FECC02')},
  RS:{L:hStripes(['#C6363C','#0C4076','#FFFFFF'])},
  CZ:{L:[{s:'r',x:0,y:0,w:1,h:0.5,c:'#FFFFFF'},{s:'r',x:0,y:0.5,w:1,h:0.5,c:'#D7141A'},{s:'po',pts:[[0,0],[0.42,0.5],[0,1]],c:'#11457E'}]},
  AU:{L:navyCantonLayers('#00247D', {starColor:'#FFFFFF', commonwealthStar:true})},
  JP:{L:[{s:'r',x:0,y:0,w:1,h:1,c:'#FFFFFF'},{s:'ci',x:0.5,y:0.5,r:0.26,c:'#BC002D'}]},
  RU:{L:hStripes(['#FFFFFF','#0039A6','#D52B1E'])},
  CN:{L:[{s:'r',x:0,y:0,w:1,h:1,c:'#DE2910'},{s:'st',x:0.18,y:0.28,r:0.11,c:'#FFDE00'},{s:'ci',x:0.36,y:0.12,r:0.035,c:'#FFDE00'},{s:'ci',x:0.42,y:0.22,r:0.035,c:'#FFDE00'},{s:'ci',x:0.42,y:0.36,r:0.035,c:'#FFDE00'},{s:'ci',x:0.36,y:0.46,r:0.035,c:'#FFDE00'}]},
  CA:{L:[{s:'r',x:0,y:0,w:0.28,h:1,c:'#FF0000'},{s:'r',x:0.28,y:0,w:0.44,h:1,c:'#FFFFFF'},{s:'r',x:0.72,y:0,w:0.28,h:1,c:'#FF0000'},{s:'po',pts:[[0.5,0.22],[0.58,0.42],[0.72,0.36],[0.62,0.52],[0.7,0.6],[0.55,0.62],[0.5,0.78],[0.45,0.62],[0.3,0.6],[0.38,0.52],[0.28,0.36],[0.42,0.42]],c:'#FF0000'}]},
  CH:{L:centeredCrossLayers('#FF0000','#FFFFFF')},
  NL:{L:hStripes(['#AE1C28','#FFFFFF','#21468B'])},
  BE:{L:vStripes(['#000000','#FAE042','#ED2939'])},
  PT:{L:[{s:'r',x:0,y:0,w:0.4,h:1,c:'#046A38'},{s:'r',x:0.4,y:0,w:0.6,h:1,c:'#DA020E'},{s:'ci',x:0.4,y:0.5,r:0.13,c:'#FFCC00'}]},
  GR:{L:[...hStripes(['#0D5EAF','#FFFFFF','#0D5EAF','#FFFFFF','#0D5EAF']),{s:'r',x:0,y:0,w:0.4,h:0.55,c:'#0D5EAF'},{s:'r',x:0.15,y:0,w:0.1,h:0.55,c:'#FFFFFF'},{s:'r',x:0,y:0.22,w:0.4,h:0.12,c:'#FFFFFF'}]},
  // 19 banderas nuevas de la expansión a 64 países (antes rectángulo gris de relleno). Mismo
  // criterio de simplificación que el resto del archivo (ver notas de ZA/HR más arriba): a este
  // tamaño de ícono (16-26px) se prioriza que sean RECONOCIBLES por colores/forma general, no
  // reproducciones exactas — escudos/emblemas muy finos (líneas, texto, 12+ puntas de sol, etc.)
  // se simplifican a la forma más parecida que ya tenemos disponible (círculos, estrellas de 5
  // puntas, polígonos).
  SK:{L:[...hStripes(['#FFFFFF','#0B4EA2','#EE1C25']),
    // escudo simplificado (cruz blanca de doble travesaño se aproxima a una cruz simple) sobre
    // fondo rojo, corrido hacia el asta, como en la bandera real.
    ...scaleLayers(centeredCrossLayers('#D7141A','#FFFFFF'), 0.1, 0.26, 0.24, 0.48),
  ]},
  BG:{L:hStripes(['#FFFFFF','#00966E','#D62612'])},
  TW:{L:[
    // "China Taipei": no es la bandera de Taiwán (por motivos políticos, en el circuito ATP
    // compite bajo la bandera olímpica de "Chinese Taipei" — campo blanco con un emblema central
    // que combina la flor de ciruelo (mei hua) y el sol blanco, no el sol blanco de 12 puntas
    // sobre campo rojo de la bandera real de Taiwán).
    {s:'r',x:0,y:0,w:1,h:1,c:'#FFFFFF'},
    // 5 pétalos de la flor de ciruelo, con bordes curvos (círculos superpuestos que se cruzan
    // cerca del centro, mismo recurso que en la bandera de Hong Kong) — a pedido del usuario,
    // el emblema no puede leerse como un simple círculo.
    {s:'ci',x:0.5,y:0.29,r:0.185,c:'#0072BC'},
    {s:'ci',x:0.662,y:0.407,r:0.185,c:'#0072BC'},
    {s:'ci',x:0.6,y:0.598,r:0.185,c:'#0072BC'},
    {s:'ci',x:0.4,y:0.598,r:0.185,c:'#0072BC'},
    {s:'ci',x:0.338,y:0.407,r:0.185,c:'#0072BC'},
    // "hueco" blanco central para separar los pétalos del emblema del sol, dejando ver solo las
    // puntas curvas de cada pétalo alrededor
    {s:'ci',x:0.5,y:0.46,r:0.195,c:'#FFFFFF'},
    {s:'ci',x:0.5,y:0.46,r:0.155,c:'#FE0000'},
    {s:'ci',x:0.5,y:0.46,r:0.115,c:'#FFFFFF'},
    {s:'ci',x:0.5,y:0.46,r:0.085,c:'#0072BC'},
    {s:'st',x:0.5,y:0.46,r:0.045,c:'#FFFFFF'},
  ]},
  MC:{L:hStripes(['#CE1126','#FFFFFF'])},
  LT:{L:hStripes(['#FDB913','#006A44','#C1272D'])},
  LU:{L:hStripes(['#ED2939','#FFFFFF','#00A1DE'])},
  BA:{L:[
    // REHECHA esta sesión (a pedido del usuario, comparando contra foto real): el triángulo estaba
    // mal orientado — antes tenía el ángulo recto en la esquina SUPERIOR IZQUIERDA y su lado
    // vertical ocupaba TODO el borde del asta, tapando de amarillo todo el borde izquierdo (cero
    // azul ahí) — al revés de la bandera real. Ahora el triángulo va pegado al borde DERECHO
    // (ángulo recto arriba a la derecha), es más chico, y no llega hasta la esquina inferior
    // derecha — así queda azul bien visible tanto a la izquierda (la mayoría del paño) como abajo
    // a la derecha, igual que en la bandera real. Estrellas agrandadas (r 0.05→0.062) para que se
    // lean mejor, centradas sobre la hipotenusa (mitad en el amarillo, mitad en el azul, como en
    // el original). Geometría validada con un render SVG→PNG antes de aplicar.
    {s:'r',x:0,y:0,w:1,h:1,c:'#002395'},
    {s:'po',pts:[[1,0],[0.46,0],[1,0.70]],c:'#FECB00'},
    {s:'st',x:0.406,y:-0.07,r:0.062,c:'#FFFFFF'},
    {s:'st',x:0.503,y:0.056,r:0.062,c:'#FFFFFF'},
    {s:'st',x:0.611,y:0.196,r:0.062,c:'#FFFFFF'},
    {s:'st',x:0.719,y:0.336,r:0.062,c:'#FFFFFF'},
    {s:'st',x:0.827,y:0.476,r:0.062,c:'#FFFFFF'},
    {s:'st',x:0.935,y:0.616,r:0.062,c:'#FFFFFF'},
    {s:'st',x:1.043,y:0.756,r:0.062,c:'#FFFFFF'},
  ]},
  IL:{L:[
    {s:'r',x:0,y:0,w:1,h:1,c:'#FFFFFF'},
    {s:'r',x:0,y:0.12,w:1,h:0.12,c:'#0038B8'},
    {s:'r',x:0,y:0.76,w:1,h:0.12,c:'#0038B8'},
    // Estrella de David: dos triángulos superpuestos, solo contorno (sin relleno) — se apoya en
    // el soporte de stroke para polígonos agregado en esta misma sesión.
    {s:'po',pts:[[0.5,0.34],[0.62,0.56],[0.38,0.56]],c:'none',stroke:'#0038B8',strokeWidth:0.045},
    {s:'po',pts:[[0.5,0.66],[0.38,0.44],[0.62,0.44]],c:'none',stroke:'#0038B8',strokeWidth:0.045},
  ]},
  KZ:{L:[
    {s:'r',x:0,y:0,w:1,h:1,c:'#00AFCA'},
    {s:'st',x:0.55,y:0.5,r:0.24,c:'#FEC50C'},
    {s:'ci',x:0.55,y:0.5,r:0.1,c:'#FEC50C'},
    // franja ornamental angosta del asta, simplificada (la real tiene un patrón repetido de motivos tradicionales)
    {s:'r',x:0,y:0,w:0.045,h:1,c:'#FEC50C'},
  ]},
  RO:{L:vStripes(['#002B7F','#FCD116','#CE1126'])},
  LB:{L:[
    {s:'r',x:0,y:0,w:1,h:0.25,c:'#ED1C24'},
    {s:'r',x:0,y:0.25,w:1,h:0.5,c:'#FFFFFF'},
    {s:'r',x:0,y:0.75,w:1,h:0.25,c:'#ED1C24'},
    // cedro simplificado: dos triángulos superpuestos (follaje) + tronco corto
    {s:'po',pts:[[0.5,0.32],[0.63,0.56],[0.37,0.56]],c:'#00A651'},
    {s:'po',pts:[[0.5,0.4],[0.68,0.64],[0.32,0.64]],c:'#00A651'},
    {s:'r',x:0.47,y:0.62,w:0.06,h:0.08,c:'#6F4E37'},
  ]},
  HK:{L:[
    {s:'r',x:0,y:0,w:1,h:1,c:'#DE2910'},
    // Flor de Bauhinia — CUARTA REHECHA esta sesión, ajuste fino sobre la anterior (que ya tenía
    // buena separación y ancho de pétalo, pero 2 cosas quedaban mal a pedido del usuario): (1) la
    // punta se había redondeado de más (arco), y el usuario la quería más "tipo hoja" — ahora las
    // dos curvas del borde convergen directo en un único punto en la punta, en vez de recorrer un
    // arco; (2) los 5 pétalos arrancaban excatamente en el centro de la flor (0.5,0.46), sin dejar
    // nada de rojo visible en el medio — ahora la base de cada pétalo arranca desplazada ~0.045 del
    // centro exacto, dejando un pequeño hueco rojo visible entre los 5 pétalos, como en la bandera
    // real. Validado visualmente con un render SVG→PNG antes de aplicar.
    {s:'po',pts:[[0.5,0.415],[0.57,0.377],[0.613,0.334],[0.63,0.286],[0.62,0.233],[0.583,0.174],[0.52,0.11],[0.489,0.152],[0.469,0.197],[0.46,0.246],[0.462,0.299],[0.476,0.355]],c:'#FFFFFF'},
    {s:'po',pts:[[0.543,0.446],[0.6,0.501],[0.654,0.529],[0.705,0.53],[0.753,0.504],[0.798,0.451],[0.839,0.371],[0.79,0.354],[0.74,0.349],[0.691,0.356],[0.642,0.374],[0.592,0.404]],c:'#FFFFFF'},
    {s:'po',pts:[[0.526,0.496],[0.492,0.568],[0.482,0.628],[0.497,0.677],[0.536,0.714],[0.601,0.74],[0.69,0.755],[0.69,0.703],[0.68,0.654],[0.658,0.609],[0.625,0.568],[0.581,0.53]],c:'#FFFFFF'},
    {s:'po',pts:[[0.474,0.496],[0.395,0.486],[0.335,0.495],[0.293,0.524],[0.269,0.573],[0.264,0.642],[0.278,0.731],[0.328,0.716],[0.371,0.691],[0.407,0.656],[0.436,0.613],[0.458,0.559]],c:'#FFFFFF'},
    {s:'po',pts:[[0.457,0.446],[0.443,0.368],[0.416,0.313],[0.375,0.283],[0.321,0.276],[0.254,0.292],[0.173,0.333],[0.203,0.375],[0.24,0.408],[0.284,0.432],[0.335,0.446],[0.393,0.451]],c:'#FFFFFF'},
    {s:'st',x:0.57,y:0.281,r:0.048,c:'#DE2910'},
    {s:'st',x:0.692,y:0.471,r:0.048,c:'#DE2910'},
    {s:'st',x:0.548,y:0.646,r:0.048,c:'#DE2910'},
    {s:'st',x:0.338,y:0.563,r:0.048,c:'#DE2910'},
    {s:'st',x:0.352,y:0.338,r:0.048,c:'#DE2910'},
  ]},
  EE:{L:hStripes(['#0072CE','#000000','#FFFFFF'])},
  SV:{L:[...hStripes(['#0047AB','#FFFFFF','#0047AB']),{s:'ci',x:0.5,y:0.5,r:0.07,c:'#FCD116'}]},
  PK:{L:[
    {s:'r',x:0,y:0,w:1,h:1,c:'#01411C'},
    {s:'r',x:0,y:0,w:0.25,h:1,c:'#FFFFFF'},
    {s:'ci',x:0.63,y:0.46,r:0.17,c:'#FFFFFF'},
    {s:'ci',x:0.69,y:0.42,r:0.135,c:'#01411C'},
    {s:'st',x:0.82,y:0.46,r:0.075,c:'#FFFFFF'},
  ]},
  SI:{L:[...hStripes(['#FFFFFF','#0033A0','#ED1C24']),
    {s:'r',x:0.07,y:0.16,w:0.17,h:0.36,c:'#0033A0'},
    {s:'po',pts:[[0.07,0.5],[0.155,0.24],[0.24,0.5]],c:'#FFFFFF'},
    {s:'st',x:0.105,y:0.135,r:0.022,c:'#FCD116'},
    {s:'st',x:0.155,y:0.10,r:0.022,c:'#FCD116'},
    {s:'st',x:0.205,y:0.135,r:0.022,c:'#FCD116'},
  ]},
  TH:{L:[
    {s:'r',x:0,y:0,w:1,h:0.167,c:'#A51931'},
    {s:'r',x:0,y:0.167,w:1,h:0.167,c:'#F4F5F8'},
    {s:'r',x:0,y:0.334,w:1,h:0.332,c:'#2D2A4A'},
    {s:'r',x:0,y:0.666,w:1,h:0.167,c:'#F4F5F8'},
    {s:'r',x:0,y:0.833,w:1,h:0.167,c:'#A51931'},
  ]},
  CY:{L:[
    {s:'r',x:0,y:0,w:1,h:1,c:'#FFFFFF'},
    // silueta de la isla simplificada: cuerpo principal + una "cola" angosta hacia la derecha
    // (evocando la península de Karpas), como un polígono cerrado y sólido — no es geográficamente exacta.
    {s:'po',pts:[[0.2,0.52],[0.3,0.45],[0.42,0.43],[0.52,0.46],[0.6,0.44],[0.7,0.4],[0.8,0.38],[0.86,0.4],[0.82,0.44],[0.72,0.45],[0.6,0.5],[0.56,0.58],[0.44,0.62],[0.32,0.62],[0.22,0.58]],c:'#D57800'},
    // dos ramas de olivo simplificadas debajo
    {s:'po',pts:[[0.38,0.8],[0.5,0.72],[0.62,0.8],[0.5,0.76]],c:'#4E9F3D'},
  ]},
  DO:{L:[
    {s:'r',x:0,y:0,w:1,h:1,c:'#FFFFFF'},
    {s:'r',x:0,y:0,w:0.44,h:0.4,c:'#002D62'},
    {s:'r',x:0.56,y:0,w:0.44,h:0.4,c:'#CE1126'},
    {s:'r',x:0,y:0.6,w:0.44,h:0.4,c:'#CE1126'},
    {s:'r',x:0.56,y:0.6,w:0.44,h:0.4,c:'#002D62'},
    {s:'ci',x:0.5,y:0.5,r:0.05,c:'#CE1126'},
  ]},
  PL:{L:[{s:'r',x:0,y:0,w:1,h:0.5,c:'#FFFFFF'},{s:'r',x:0,y:0.5,w:1,h:0.5,c:'#DC143C'}]},
  HR:{L:[...hStripes(['#FF0000','#FFFFFF','#171796']), ...checkerShield(0.40,0.25,0.20,0.5,4,5,'#FF0000','#FFFFFF')]},
  NO:{L:crossLayers('#EF2B2D','#002868','#FFFFFF')},
  DK:{L:crossLayers('#C60C30','#FFFFFF')},
  FI:{L:crossLayers('#FFFFFF','#003580')},
  MX:{L:[{s:'r',x:0,y:0,w:0.34,h:1,c:'#006847'},{s:'r',x:0.34,y:0,w:0.32,h:1,c:'#FFFFFF'},{s:'r',x:0.66,y:0,w:0.34,h:1,c:'#CE1126'},{s:'ci',x:0.5,y:0.5,r:0.1,c:'#8B5E34'}]},
  CL:{L:[{s:'r',x:0,y:0,w:1,h:0.5,c:'#FFFFFF'},{s:'r',x:0,y:0.5,w:1,h:0.5,c:'#D52B1E'},{s:'r',x:0,y:0,w:0.35,h:0.5,c:'#0039A6'},{s:'st',x:0.175,y:0.25,r:0.13,c:'#FFFFFF'}]},
  UY:{L:[...hStripes(['#FFFFFF','#0038A8','#FFFFFF','#0038A8','#FFFFFF']),{s:'r',x:0,y:0,w:0.4,h:0.44,c:'#FFFFFF'},{s:'ci',x:0.2,y:0.22,r:0.12,c:'#FCD116'}]},
  PY:{L:[...hStripes(['#D52B1E','#FFFFFF','#0038A8']),
    {s:'ci',x:0.5,y:0.5,r:0.1,c:'#0038A8'},
    {s:'ci',x:0.5,y:0.5,r:0.085,c:'#FFFFFF'},
    {s:'st',x:0.5,y:0.5,r:0.055,c:'#FCD116'},
  ]},
  BO:{L:hStripes(['#D52B1E','#F9E300','#007934'])},
  PE:{L:vStripes(['#D91023','#FFFFFF','#D91023'])},
  CO:{L:[{s:'r',x:0,y:0,w:1,h:0.5,c:'#FCD116'},{s:'r',x:0,y:0.5,w:1,h:0.25,c:'#003893'},{s:'r',x:0,y:0.75,w:1,h:0.25,c:'#CE1126'}]},
  EC:{L:[{s:'r',x:0,y:0,w:1,h:0.5,c:'#FFDD00'},{s:'r',x:0,y:0.5,w:1,h:0.25,c:'#0072CE'},{s:'r',x:0,y:0.75,w:1,h:0.25,c:'#EF3340'}]},
  IN:{L:[...hStripes(['#FF9933','#FFFFFF','#138808']),{s:'ci',x:0.5,y:0.5,r:0.09,c:'#000080'}]},
  KR:{t:'circle2',bg:'#FFFFFF',top:'#CD2E3A',bottom:'#0047A0'},
  ZA:{L:[
    // Geometría calibrada a mano contra una foto real de la bandera (no contra la descripción
    // "de manual"): el quiebre de la Y no está en la mitad del asta al batiente, está más cerca
    // del asta, en x≈0.38 — usar x=0.5 (como en el intento anterior) corría todo el dibujo hacia
    // la derecha y lo deformaba. El triángulo negro también es bastante más grande de lo que
    // tenía antes (llega casi hasta la mitad de la altura en su punta más ancha).
    {s:'r',x:0,y:0,w:1,h:0.5,c:'#E03C31'},
    {s:'r',x:0,y:0.5,w:1,h:0.5,c:'#001489'},
    // banda blanca (borde de la Y): arranca angosta pegada a las esquinas del asta, converge en
    // x=0.38 y de ahí sigue horizontal hasta el borde del batiente.
    {s:'po',pts:[[0,0.06],[0.38,0.333],[1,0.333],[1,0.5],[0.38,0.5],[0,0.22]],c:'#FFFFFF'},
    {s:'po',pts:[[0,0.94],[0.38,0.667],[1,0.667],[1,0.5],[0.38,0.5],[0,0.78]],c:'#FFFFFF'},
    // banda verde, inset adentro del blanco (mismo quiebre en x=0.38)
    {s:'po',pts:[[0.02,0.13],[0.38,0.4],[1,0.4],[1,0.5],[0.38,0.5],[0.02,0.27]],c:'#007A4D'},
    {s:'po',pts:[[0.02,0.87],[0.38,0.6],[1,0.6],[1,0.5],[0.38,0.5],[0.02,0.73]],c:'#007A4D'},
    // triángulo dorado: usa EXACTAMENTE los mismos puntos que la muesca interior de las dos
    // bandas blancas de arriba (0,0.22)-(0.38,0.5)-(0,0.78), así rellena el hueco entre blanco y
    // dorado sin dejar ver rojo/azul de fondo por un gap de redondeo entre polígonos.
    {s:'po',pts:[[0,0.22],[0.38,0.5],[0,0.78]],c:'#FFB81C'},
    {s:'po',pts:[[0,0.29],[0.27,0.5],[0,0.71]],c:'#000000'},
  ]},
  AT:{L:hStripes(['#ED2939','#FFFFFF','#ED2939'])},
  HU:{L:hStripes(['#CE2939','#FFFFFF','#477050'])},
  NZ:{L:navyCantonLayers('#00247D', {starColor:'#CF142B', starStroke:'#FFFFFF'})},
  TN:{t:'crescentDisk',bg:'#E70013',disk:'#FFFFFF',sym:'#E70013'},
  MA:{L:[{s:'r',x:0,y:0,w:1,h:1,c:'#C1272D'},{s:'st',x:0.5,y:0.5,r:0.19,c:'none',stroke:'#006233'}]},
  EG:{L:hStripes(['#CE1126','#FFFFFF','#000000'])},
  TR:{t:'crescent',bg:'#E30A17',sym:'#FFFFFF'},
  UA:{L:[{s:'r',x:0,y:0,w:1,h:0.5,c:'#0057B7'},{s:'r',x:0,y:0.5,w:1,h:0.5,c:'#FFD700'}]},
};
function flagImg(code, size){
  size = size||20;
  const h = Math.round(size*0.72);
  const f = FLAG_COLORS[code];
  let inner;
  if(!f){
    inner = `<rect width="${size}" height="${h}" fill="#888"/>`;
  } else if(f.t==='circle2'){
    inner = `<rect width="${size}" height="${h}" fill="${f.bg}"/><path d="M ${size/2} ${h*0.24} A ${h*0.26} ${h*0.26} 0 0 1 ${size/2} ${h*0.76} A ${h*0.13} ${h*0.13} 0 0 0 ${size/2} ${h/2} A ${h*0.13} ${h*0.13} 0 0 1 ${size/2} ${h*0.24}" fill="${f.top}"/><path d="M ${size/2} ${h*0.24} A ${h*0.26} ${h*0.26} 0 0 0 ${size/2} ${h*0.76} A ${h*0.13} ${h*0.13} 0 0 1 ${size/2} ${h/2} A ${h*0.13} ${h*0.13} 0 0 0 ${size/2} ${h*0.24}" fill="${f.bottom}"/>`;
  } else if(f.t==='crescent'){
    const cx=size*0.4, cy=h/2, r=h*0.3;
    inner = `<rect width="${size}" height="${h}" fill="${f.bg}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${f.sym}"/><circle cx="${cx+r*0.38}" cy="${cy}" r="${r*0.8}" fill="${f.bg}"/><circle cx="${cx+r*1.05}" cy="${cy}" r="${r*0.18}" fill="${f.sym}"/>`;
  } else if(f.t==='crescentDisk'){
    // Túnez: a diferencia de Turquía (creciente y estrella BLANCOS directo sobre el rojo), acá hay
    // un disco blanco centrado de fondo, y el creciente + la estrella van en ROJO adentro de ese disco.
    const cx=size*0.5, cy=h/2, R=h*0.34;
    inner = `<rect width="${size}" height="${h}" fill="${f.bg}"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="${f.disk}"/><circle cx="${cx-R*0.12}" cy="${cy}" r="${R*0.72}" fill="${f.sym}"/><circle cx="${cx+R*0.1}" cy="${cy}" r="${R*0.56}" fill="${f.disk}"/><circle cx="${cx+R*0.46}" cy="${cy}" r="${R*0.15}" fill="${f.sym}"/>`;
  } else {
    inner = (f.L||[]).map(l=>{
      if(l.s==='r') return `<rect x="${l.x*size}" y="${l.y*h}" width="${l.w*size}" height="${l.h*h}" fill="${l.c}"/>`;
      if(l.s==='ci') return `<circle cx="${l.x*size}" cy="${l.y*h}" r="${l.r*Math.min(size,h)}" fill="${l.c}"/>`;
      if(l.s==='po') return `<polygon points="${l.pts.map(p=>`${p[0]*size},${p[1]*h}`).join(' ')}" fill="${l.c}" ${l.stroke?`stroke="${l.stroke}" stroke-width="${(l.strokeWidth||0.05)*size}"`:''}/>`;
      if(l.s==='st'){
        // aproximación de estrella de 5 puntas
        const cx=l.x*size, cy=l.y*h, R=l.r*Math.min(size,h), r=R*0.42;
        let pts=[];
        for(let i=0;i<10;i++){
          const ang = -Math.PI/2 + i*Math.PI/5;
          const rad = i%2===0 ? R : r;
          pts.push(`${cx+rad*Math.cos(ang)},${cy+rad*Math.sin(ang)}`);
        }
        return `<polygon points="${pts.join(' ')}" fill="${l.c}" ${l.stroke?`stroke="${l.stroke}" stroke-width="${R*0.16}"`:''}/>`;
      }
      return '';
    }).join('');
  }
  return `<svg class="flagimg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}" style="vertical-align:middle;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,0.25);">${inner}</svg>`;
}

// 8 categorías de torneo (simplificado de las 11 reales del circuito)
const TIERS = [
  {id:"gs", name:"Grand Slam", weight:8, minRanking:100, minLevel:65, cap:4,
    pool:["Abierto de Australia (Melbourne)","Roland Garros (París)","Wimbledon (Londres)","US Open (Nueva York)"],
    points:[10,45,90,180,360,720,1200,2000], prize:[10000,22000,43000,87000,167000,333000,533000,750000], fisicoCost:9},
  {id:"m1000", name:"Masters 1000", weight:7, minRanking:150, minLevel:65, cap:6,
    pool:["Indian Wells","Miami","Roma","Madrid","Montecarlo","Shanghái","Canadá","Cincinnati","París-Bercy"],
    points:[10,45,90,180,360,600,1000], prize:[3700,8000,15800,31700,63300,116700,216700], fisicoCost:8},
  {id:"atp500", name:"ATP 500", weight:6, minRanking:250, minLevel:58, cap:6,
    pool:["Rotterdam","Barcelona","Acapulco","Halle","Washington","Tokio","Basilea","Viena","Dubái"],
    points:[20,45,90,180,300,500], prize:[1500,3200,6300,12500,25000,50000], fisicoCost:6},
  {id:"atp250", name:"ATP 250", weight:5, minRanking:350, minLevel:50, cap:10,
    pool:["Buenos Aires","Santiago","Marsella","Estocolmo","Metz","Winston-Salem","Newport","Gstaad","Auckland","Bastad","Kitzbühel","Chennai"],
    points:[10,20,45,90,150,250], prize:[530,1200,2300,4700,9200,18300], fisicoCost:5},
  {id:"ch175", name:"Challenger 175", weight:4, minRanking:450, minLevel:44, cap:6,
    pool:["Nonthaburi","Cherbourg","Ortisei","Bendigo","Tampere","Braunschweig","Aix-en-Provence"],
    points:[8,16,32,64,110,175], prize:[220,430,870,1750,3500,7000], fisicoCost:4},
  {id:"ch125", name:"Challenger 125", weight:3, minRanking:9999, minLevel:38, cap:99,
    pool:["Tigre","Concepción","Split","Lima","Salinas","Barranquilla","Porto","Lyon","Rennes","Trieste","Segovia","Tenerife","Vilnius","Charleston","Indianápolis","Tulsa","Cali","Bogotá","Santo Domingo","Antofagasta","Puerto Vallarta","Guangzhou","Seúl","Kobe","Yokohama","Nur-Sultan","Zagreb","Sibiu","Braga"],
    points:[6,12,24,48,80,125], prize:[150,300,580,1080,2170,4330], fisicoCost:4},
  {id:"m25", name:"ITF M25", weight:2, minRanking:9999, minLevel:0, cap:99,
    pool:["Villa María","Antalya","Sharm El Sheikh","Monastir","Bengaluru","Todi","Mérida","Bagnoles","Loulé","Sunderland","Tokushima","Nakhon Si Thammarat","Buenos Aires","Bratislava","Rovaniemi","Bangkok"],
    points:[3,6,12,20,25], prize:[60,120,230,420,750], fisicoCost:3},
  {id:"m15", name:"ITF M15", weight:1, minRanking:9999, minLevel:0, cap:99,
    pool:["Villa Allende","Sharm El Sheikh Satélite","Monastir Satélite","Anning","Hurghada","San Luis Potosí","Antalya Satélite","Manacor","Kish Island","Sabadell","Bagnères-de-Bigorre","Cairo Satélite","Heraklion","Bujumbura","Nairobi","Mogyoród"],
    points:[1,3,6,10,15], prize:[20,40,75,130,230], fisicoCost:2},
];
const TIER_BY_ID = Object.fromEntries(TIERS.map(t=>[t.id,t]));
// Abreviaturas de 2 letras para las 9 sedes de Masters 1000, usadas como encabezado de columna en
// la pestaña "ATP 1000" de la pantalla "Torneos disputados" (renderTorneosDisputados en game.js).
const M1000_ABBR = {
  "Indian Wells":"IW","Miami":"MI","Roma":"RO","Madrid":"MA","Montecarlo":"MC",
  "Shanghái":"SH","Canadá":"CA","Cincinnati":"CI","París-Bercy":"PB",
};
// Idem para las 9 sedes reales de ATP 500 (el pool que arma el calendario — TOURNAMENT_INFO.atp500
// tiene más sedes listadas, pero son solo contenido de "sabor" para la pantalla de Información de
// torneos, nunca aparecen realmente en un calendario jugable).
const ATP500_ABBR = {
  "Rotterdam":"RT","Barcelona":"BA","Acapulco":"AC","Halle":"HA","Washington":"WA",
  "Tokio":"TO","Basilea":"BS","Viena":"VI","Dubái":"DU",
};
// Idem para las 12 sedes de ATP 250.
const ATP250_ABBR = {
  "Buenos Aires":"BA","Santiago":"SA","Marsella":"MA","Estocolmo":"ES","Metz":"MZ",
  "Winston-Salem":"WS","Newport":"NE","Gstaad":"GS","Auckland":"AU","Bastad":"BD",
  "Kitzbühel":"KI","Chennai":"CH",
};
// Challengers (fusiona Challenger 175 y Challenger 125 en una sola tabla en "Torneos disputados" —
// el jugador no distingue entre las dos categorías en esa pantalla, solo importa la sede).
const CHALLENGER_ABBR = {
  "Nonthaburi":"NO","Cherbourg":"CH","Ortisei":"OR","Bendigo":"BE","Tampere":"TA","Braunschweig":"BW","Aix-en-Provence":"AI",
  "Tigre":"TI","Concepción":"CO","Split":"SP","Lima":"LI","Salinas":"SL","Barranquilla":"BQ","Porto":"PO","Lyon":"LY",
  "Rennes":"RE","Trieste":"TR","Segovia":"SG","Tenerife":"TN","Vilnius":"VL","Charleston":"CL","Indianápolis":"IN",
  "Tulsa":"TU","Cali":"CA","Bogotá":"BG","Santo Domingo":"SD","Antofagasta":"AN","Puerto Vallarta":"PV","Guangzhou":"GZ",
  "Seúl":"SE","Kobe":"KO","Yokohama":"YO","Nur-Sultan":"NS","Zagreb":"ZA","Sibiu":"SI","Braga":"BR",
};
// ITFs (fusiona M25 y M15 en una sola tabla, mismo criterio que Challengers).
const ITF_ABBR = {
  "Villa María":"VM","Antalya":"AN","Sharm El Sheikh":"SH","Monastir":"MO","Bengaluru":"BG","Todi":"TD","Mérida":"ME",
  "Bagnoles":"BN","Loulé":"LO","Sunderland":"SU","Tokushima":"TK","Nakhon Si Thammarat":"NK","Buenos Aires":"BA",
  "Bratislava":"BR","Rovaniemi":"RV","Bangkok":"BK",
  "Villa Allende":"VA","Sharm El Sheikh Satélite":"SS","Monastir Satélite":"MS","Anning":"AI","Hurghada":"HU",
  "San Luis Potosí":"SL","Antalya Satélite":"AS","Manacor":"MA","Kish Island":"KI","Sabadell":"SB",
  "Bagnères-de-Bigorre":"BB","Cairo Satélite":"CS","Heraklion":"HE","Bujumbura":"BJ","Nairobi":"NA","Mogyoród":"MG",
};
// Categorías que cuentan para el logro "Colección completa": se excluyen ITF M15/M25 a pedido del
// usuario — son las categorías de entrada, y muchas carreras ni las juegan pasado el arranque, lo
// que hacía que el logro dependiera de un tramo del juego que ni siquiera es parte habitual de una
// carrera larga. Copa Davis nunca formó parte de este chequeo (no pasa por TIERS/finalizeTournamentResult,
// se resuelve aparte en finishYear()), así que no hace falta excluirla explícitamente acá.
const COLECCION_COMPLETA_TIER_IDS = TIERS.filter(t=>t.id!=='m15' && t.id!=='m25').map(t=>t.id);

const SHOP_ITEMS = [
  {id:"coach", name:"Entrenador personal", desc:"Cada carta de entrenamiento rinde un poco más.", costs:[6000,13000,24000,42000,72000,120000,200000,340000,560000,950000], totalEffect:6},
  {id:"fisio", name:"Fisioterapeuta de planta", desc:"Reduce el riesgo de sufrir lesiones, en pretemporada y durante el año.", costs:[5000,10500,19000,33000,57000,98000,165000,280000,470000,800000], totalEffect:18},
  {id:"nutri", name:"Nutricionista deportivo", desc:"Te desgastás menos físico por ronda y recuperás más rápido entre torneos y temporadas.", costs:[4000,8500,15500,27000,46000,79000,135000,230000,390000,660000], totalEffect:0.5},
  {id:"raquetas", name:"Set de raquetas de torneo", desc:"Sube tu saque de a poco, en cada nivel.", costs:[3500,7500,13500,23000,40000,68000,115000,195000,330000,560000], totalEffect:24, stat:"saque"},
  {id:"prepFisico", name:"Preparador de potencia", desc:"Sube tu potencia de a poco, en cada nivel.", costs:[3500,7500,13500,23000,40000,68000,115000,195000,330000,560000], totalEffect:24, stat:"potencia"},
  {id:"velocista", name:"Entrenador de movilidad", desc:"Sube tu movilidad de a poco, en cada nivel.", costs:[3500,7500,13500,23000,40000,68000,115000,195000,330000,560000], totalEffect:24, stat:"movilidad"},
  {id:"tecnico", name:"Entrenador técnico", desc:"Sube tu técnica de a poco, en cada nivel.", costs:[3500,7500,13500,23000,40000,68000,115000,195000,330000,560000], totalEffect:24, stat:"tecnica"},
  {id:"psico", name:"Psicólogo deportivo", desc:"Sube tu nivel mental de a poco, en cada nivel.", costs:[3500,7500,13500,23000,40000,68000,115000,195000,330000,560000], totalEffect:24, stat:"mental"},
  {id:"representante", name:"Representante de primer nivel", desc:"Mejores contactos: ofertas de sponsor más frecuentes y más generosas.", costs:[10000,22000,45000,90000,170000,320000,600000], totalEffect:5},
];
const SHOP_REPEATABLE = [
  {id:"descanso_premium", name:"Estadía de recuperación premium", desc:"Recuperás físico al instante. Podés comprarlo las veces que quieras (sube de precio).", baseCost:3000, effect:"fisico"},
  {id:"evento_pr", name:"Evento de prensa / PR", desc:"Un empujón de fama para conseguir mejores invitaciones y sponsors. Repetible.", baseCost:3500, effect:"fama"},
];
// Lujos de alto vuelo: no mejoran ninguna stat de juego, son puro sumidero de dinero (con algo de fama simbólica)
const SHOP_LUXURY = [
  {id:"auto_lujo", name:"Colección de autos deportivos", desc:"Puro estatus. Repetible: te podés armar una colección entera.", baseCost:220000, fama:2},
  {id:"jet", name:"Jet privado", desc:"El lujo definitivo del circuito. Repetible, más caro cada vez.", baseCost:1800000, fama:6},
  {id:"fundacion", name:"Fundación benéfica con tu nombre", desc:"No suma nada a tu juego, pero deja huella. Una sola vez.", baseCost:900000, fama:12, oneTimeMax:1},
];
// "Selección Nacional": inversiones caras que NO mejoran al jugador, mejoran a los tenistas de SU
// PAÍS (los NPCs), para subir las chances de que esa selección clasifique y le vaya bien en la
// Copa Davis / Ranking de Selecciones. Cada ítem tiene 2 niveles/usos nada más, y el bonus de cada
// nivel es un rango variable (no un número fijo), calculado en el momento en que se aplica:
// - "becas": bonus por debutante nuevo, entre minLvl y maxLvl (promedio (minLvl+maxLvl)/2), un
//   sorteo independiente por CADA NIVEL comprado (nivel 2 = 2 sorteos sumados). Se aplica en
//   makeNPC() cada vez que nace un debutante del país del jugador — nunca retroactivo.
// - "predio": bonus inmediato por CADA jugador activo del país en el momento de la compra, sorteo
//   independiente por jugador (no un único monto para todo el país). Se aplica una sola vez por
//   nivel comprado, sobre el roster que exista en ese instante.
const SHOP_NATIONAL_ITEMS = [
  {id:"becas", name:"Becas para nuevos jugadores", desc:"Financiás un programa de becas y detección temprana de talento en todo el país. Los tenistas que debutan en el circuito a partir de ahora arrancan con un plus de nivel, desde el día en que aparecen.", costs:[500000,850000], bonusMin:2, bonusMax:4},
  {id:"predio", name:"Predio de entrenamiento nacional", desc:"Construís un centro de entrenamiento de primer nivel para toda la selección. Los tenistas activos de tu país reciben un salto de nivel apenas se inaugura.", costs:[750000,1200000], bonusMin:1, bonusMax:3},
];

// Imágenes reales tomadas de Wikimedia Commons vía la URL "directa" Special:FilePath (pensada
// para insertar en sitios externos sin tener que resolver el hash de la ruta del archivo original).
// OJO: estas imágenes NO cargan en el sandbox de artifacts de Claude.ai (bloquea red externa),
// pero sí cargan normalmente al abrir el .html descargado en un navegador común.
function wikiImg(file, width){
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width||600}`;
}

// Datos de los 6 trofeos "grandes" del juego (4 Grand Slam + ATP Finals + Copa Davis), usados por
// la pantalla de celebración renderTrophyCelebration() que aparece al final de la temporada cuando
// el jugador ganó alguno de ellos. Imágenes reales de Wikimedia Commons (íconos oficiales de cada
// trofeo, misma categoría "Tennis trophy icons" — estilo consistente entre los 6). `articulo` se
// usa para armar el título "¡Ganaste el/la/— TROFEO!" con buena gramática en español (Wimbledon no
// lleva artículo, "ganaste Wimbledon" es como se dice habitualmente).
const TROFEO_INFO = {
  gs_au: { img:"Norman Brookes Challenge Cup (Australian Open - Gentlemen's single).svg", label:"Abierto de Australia", articulo:"el", desc:"El trofeo Norman Brookes Challenge Cup, entregado al campeón del primer Grand Slam del año." },
  gs_rg: { img:"Coupe des Mousquetaires (French Open - Gentlemen's single).svg", label:"Roland Garros", articulo:"el", desc:"La Coupe des Mousquetaires, el trofeo del Grand Slam de polvo de ladrillo." },
  gs_wim: { img:"Wimbledon Trophy (Wimbledon - Gentlemen's single).svg", label:"Wimbledon", articulo:"", desc:"El trofeo más tradicional de los cuatro, entregado desde 1887 en el All England Club." },
  gs_uso: { img:"US Open Trophy (US Open - Gentlemen's single).svg", label:"US Open", articulo:"el", desc:"El trofeo que cierra el año de Grand Slams, en Flushing Meadows." },
  finals: { img:"ATP World Tour Finals Singles Trophy (London).svg", label:"ATP Finals", articulo:"el", desc:"El trofeo del cierre de temporada, reservado para los 8 mejores del año." },
  davis: { img:"Davis Cup Trophy.svg", label:"Copa Davis", articulo:"la", desc:"El título por equipos más importante del tenis, disputado entre selecciones nacionales." },
  jjoo: { img:"Olympic rings without rims.svg", label:"Juegos Olímpicos", articulo:"los", desc:"La medalla de oro olímpica, disputada cada 4 años entre los mejores tenistas del mundo representando a sus países." },
};

const TOURNAMENT_INFO = {
  finals: {
    label: "ATP Finals",
    intro: "El torneo que cierra la temporada, reservado para los 8 mejores del año (7 por ranking de la temporada + 1 cupo especial). Se juega bajo techo, en formato de grupos seguido de semifinales y final — el único gran evento del calendario que no es de eliminación directa desde el arranque.",
    venues: [
      { name:"Pala Alpitour / Inalpi Arena — Turín, Italia", img:"Pala-alpitour-illus.jpg",
        text:"Sede actual del torneo. El edificio se construyó para los Juegos Olímpicos de Invierno de 2006 como pista de patinaje, y con el tiempo pasó a albergar eventos de todo tipo, del deporte a los recitales. Turín le ganó la candidatura a otras ciudades europeas para quedarse con el cierre de temporada por varios años." },
    ],
  },
  gs: {
    label: "Grand Slam",
    intro: "Los cuatro torneos más importantes del calendario. Dan la mayor cantidad de puntos y premios, y ganarlos es lo que más pesa a la hora de definir quién queda en la historia del circuito.",
    venues: [
      { name:"Abierto de Australia — Melbourne", img:"Rod laver arena by night.jpg",
        text:"El primer Grand Slam del año, jugado a fines de enero bajo el calor del verano australiano. Se disputa en Melbourne Park, con la Rod Laver Arena como cancha central — bautizada en honor al único tenista, junto con Margaret Court, en ganar los cuatro Grand Slam del mismo año en dos ocasiones distintas. Es el torneo con más techos retráctiles del circuito, pensados para las tardes de calor extremo." },
      { name:"Roland Garros — París, Francia", img:"Court Philippe Chatrier 2023 cropped.jpg",
        text:"El Grand Slam de polvo de ladrillo, jugado en mayo-junio. Se juega en el complejo del Stade Roland Garros, con la Court Philippe Chatrier como cancha principal desde 1928. El nombre del estadio recuerda a un aviador y militar francés — nada que ver con el tenis — elegido por la federación local como homenaje. Es considerado el torneo físicamente más exigente por la lentitud de la superficie, que estira los puntos." },
      { name:"Wimbledon — Londres, Inglaterra", img:"Centre Court Wimbledon 2009.JPG",
        text:"El más antiguo de los cuatro y el único que todavía se juega sobre césped. Se disputa desde 1877 en el All England Club, y mantiene tradiciones que ningún otro torneo conserva: el código de vestimenta casi enteramente blanco para los jugadores, y la ausencia (hasta hace pocos años) de publicidad visible en las canchas." },
      { name:"US Open — Nueva York, EE.UU.", img:"Arthur Ashe Stadium 01.JPG",
        text:"Cierra el año de Grand Slams, a fines de agosto y comienzos de septiembre, en el USTA Billie Jean King National Tennis Center de Flushing Meadows. Su cancha principal, el Arthur Ashe Stadium, es el estadio de tenis más grande del mundo por capacidad, y lleva el nombre del primer jugador afroamericano en ganar el torneo. Es el Grand Slam con el ambiente más ruidoso y nocturno del circuito." },
    ],
  },
  m1000: {
    label: "Masters 1000",
    intro: "El escalón justo debajo de los Grand Slam. Son los torneos que cualquier jugador de elite intenta no faltar en su calendario, con cuadros muy exigentes desde la primera ronda. Elegí una sede en el desplegable para ver su info.",
    venues: [
      { name:"Indian Wells, EE.UU.", img:"Indian Wells Tennis Garden, Stadium 1.jpg",
        text:"Se juega en marzo en pleno desierto de California, en el Indian Wells Tennis Garden — el segundo estadio de tenis al aire libre más grande del mundo después del Arthur Ashe. Junto con Miami, forma el llamado 'Sunshine Double': ganar los dos en el mismo año es una hazaña que muy pocos lograron." },
      { name:"Miami, EE.UU.", img:"Hard Rock Stadium during the national anthem before a Miami Dolphins game.jpg",
        text:"Se juega en el Hard Rock Stadium, el mismo estadio de los Miami Dolphins de la NFL, sobre canchas armadas especialmente en los estacionamientos del predio. Antes de 2019 tuvo casa propia durante más de tres décadas en Crandon Park, sobre la isla de Key Biscayne." },
      { name:"Montecarlo, Mónaco", img:"Terrains Monte-Carlo Rolex Masters 1000.JPG",
        text:"Uno de los Masters 1000 más tradicionales, jugado sobre polvo de ladrillo con el Mediterráneo de fondo, en el Monte Carlo Country Club. Suele abrir la temporada de canchas de tierra en Europa, de cara a Roland Garros." },
      { name:"Madrid, España", img:"Panoramica caja magica.jpg",
        text:"Se juega en La Caja Mágica, un complejo con techo retráctil inaugurado en 2009. Pasó por varias superficies a lo largo de su historia — arrancó en cancha dura, tuvo una polémica edición de tierra azul en 2012, y hoy se juega sobre polvo de ladrillo tradicional." },
      { name:"Roma, Italia", img:"Foro Italico – Central Tennis Court.jpg",
        text:"Se disputa en el Foro Italico, un complejo deportivo construido en la época de Mussolini y rodeado de estatuas de mármol de atletas clásicos. Es, junto con Montecarlo, uno de los grandes clásicos de tierra battida antes de Roland Garros." },
      { name:"Canadá (Toronto / Montreal)", img:"Rexall Centre at York Toronto Canada.JPG",
        text:"El Canadian Open alterna sede todos los años entre Toronto (Sobeys Stadium) y Montreal (Stade IGA) — la ciudad que un año recibe a los hombres, al año siguiente recibe a las mujeres. Es uno de los torneos más antiguos del circuito, con ediciones que se remontan a 1881." },
      { name:"Cincinnati, EE.UU.", img:"Lindner Family Tennis Center 2025.jpg",
        text:"Se juega en el Lindner Family Tennis Center, cerca de Cincinnati, y es de los torneos más antiguos del circuito — sus orígenes se remontan a 1899. Se disputa entre Canadá y el US Open, cerrando la gira norteamericana de cancha dura previa al último Grand Slam del año." },
      { name:"Shanghái, China", img:"Qizhong Stadium.jpg",
        text:"El único Masters 1000 que se juega fuera de Europa o Norteamérica, en el Qizhong Forest Sports City Arena. Su cancha central tiene un techo retráctil inspirado en la forma de una flor de magnolia, la flor símbolo de la ciudad." },
      { name:"París-Bercy, Francia", img:"Paris masters court.jpg",
        text:"El último Masters 1000 del año, bajo techo. Durante casi cuatro décadas se jugó en el Accor Arena, en el barrio de Bercy — de ahí el apodo por el que todavía lo conoce la mayoría de los fanáticos, aunque desde 2025 se mudó a La Défense Arena, en las afueras de París." },
    ],
  },
  atp500: {
    label: "ATP 500",
    intro: "Categoría intermedia-alta, con menos puntos y menos exigencia que un Masters 1000 pero todavía muy competitiva. Son 16 torneos en total. Elegí una sede en el desplegable para ver su info.",
    venues: [
      { name:"Rotterdam, Países Bajos", img:"Rotterdam Ahoy 2016.jpg",
        text:"El ABN AMRO Open se juega bajo techo, sobre cancha dura, en el complejo Rotterdam Ahoy — uno de los torneos indoor más consolidados de Europa, con más de cinco décadas de historia ininterrumpida." },
      { name:"Río de Janeiro, Brasil", img:"Hipodromo do Cristal (cropped).jpg",
        text:"El Rio Open se juega sobre polvo de ladrillo en el Jockey Club Brasileiro, y es el único ATP 500 que se disputa en Sudamérica. Ganó notoriedad ya en su edición inaugural de 2014, cuando Rafael Nadal se quedó con el título." },
      { name:"Doha, Catar", img:"Khalifa Tennis and Squash Complex in Lekhwair.jpg",
        text:"El Qatar ExxonMobil Open se juega desde 1993 en el Khalifa International Tennis and Squash Complex, uno de los primeros grandes recintos tenísticos construidos en Medio Oriente. Ascendió a la categoría ATP 500 recién en 2025, después de muchos años como uno de los ATP 250 más fuertes del calendario." },
      { name:"Acapulco, México", img:"Arena-GNP-seguros.jpg",
        text:"El Abierto Mexicano se juega desde 2022 en la Arena GNP Seguros, un complejo construido específicamente para el tenis y el recinto de este tipo más grande de toda Latinoamérica. Antes de esa fecha, el torneo pasó por otras sedes de la misma ciudad, entre ellas el hotel Fairmont Acapulco Princess." },
      { name:"Barcelona, España", img:"Conde de godo-2009 (2).JPG",
        text:"El Trofeo Godó se juega en el Real Club de Tenis Barcelona, fundado en 1899 y uno de los clubes más tradicionales de España. Desde 2017 la pista central lleva el nombre de Rafael Nadal, quien lo levantó en numerosas ocasiones a lo largo de su carrera. Junto con Montecarlo, es de los grandes clásicos de polvo de ladrillo que abren la temporada europea de tierra." },
      { name:"Múnich, Alemania", img:"BMW Open 2014 - Anlage MTTC Iphitos - Clubheim 01.JPG",
        text:"El BMW Open se juega desde hace más de un siglo en el MTTC Iphitos, un club de tenis tradicional de Múnich, sobre canchas de polvo de ladrillo al aire libre. Subió a la categoría ATP 500 en 2025, tras haber sido durante décadas uno de los ATP 250 clásicos de la primavera europea." },
      { name:"Halle, Alemania", img:"GerryWeberStadion.JPG",
        text:"El Halle Open se disputa en la OWL Arena (conocida durante casi tres décadas como Gerry Weber Stadion), uno de los pocos escenarios de césped que quedan en el calendario. Roger Federer es, de lejos, el nombre más asociado al torneo: lo ganó en repetidas ocasiones a lo largo de su carrera." },
      { name:"Londres, Reino Unido", img:"Courts 1 & 2 Queens Club.jpg",
        text:"El torneo de Queen's Club se juega desde 1890 en el mismo club de West Kensington, y es la principal preparación en césped de cara a Wimbledon, apenas a unos kilómetros de distancia. Es uno de los pocos escenarios de pasto que sobreviven en el calendario, junto con Halle y el propio Wimbledon." },
      { name:"Hamburgo, Alemania", img:"Centre Court Am Rothenbaum (Hamburg).jpg",
        text:"El Hamburg Open se juega en el estadio Am Rothenbaum desde 1892, lo que lo convierte en el torneo de tenis más antiguo de Alemania. Formó parte de los Masters 1000 durante muchos años, categoría que perdió en la reestructuración del calendario de 2009, aunque sigue siendo uno de los dos ATP 500 en suelo alemán (el otro es Halle)." },
      { name:"Washington, EE.UU.", img:"FitzGerald Tennis Center.jpg",
        text:"El Washington Open se juega en el FitzGerald Tennis Center, dentro del Rock Creek Park, y es el único evento combinado ATP/WTA 500 de todo el calendario. Su llegada a la capital estadounidense en 1969 se debió en buena parte al impulso de Arthur Ashe, uno de sus primeros grandes defensores." },
      { name:"Beijing, China", img:"Diamond Court, National Tennis Center (20240821134822).jpg",
        text:"El China Open se juega en el China National Tennis Center desde 2009, dentro del parque construido para los Juegos Olímpicos de Beijing 2008. Su cancha principal, la Diamond Court, tiene techo retráctil y capacidad para 15.000 espectadores, una de las canchas de tenis techadas más grandes del mundo." },
      { name:"Tokio, Japón", img:"Ariake Coliseum, at Ariake, Koto, Tokyo (2019-08-13).jpg",
        text:"El Japan Open se juega habitualmente en el Ariake Coliseum, dentro del Ariake Tennis Forest Park, un estadio con techo retráctil que fue pionero en Asia cuando se instaló a comienzos de los años 90. El mismo complejo fue también sede de las competencias de tenis de los Juegos Olímpicos de Tokio 2020." },
      { name:"Basilea, Suiza", img:"St Jakobshalle Basel.JPG",
        text:"El Swiss Indoors se disputa en el St. Jakobshalle, un polideportivo inaugurado en 1976 en las afueras de Basilea. Es el torneo de la casa de Roger Federer, que lo ganó en numerosas ocasiones representando a su ciudad natal a lo largo de su carrera." },
      { name:"Viena, Austria", img:"David_Ferrer_(Spain)_against_Viktor_Troicki_(Serbia),_2016_Erste_Bank_Open.jpg",
        text:"El Erste Bank Open se juega desde 1974 en el Wiener Stadthalle, el recinto cubierto más grande de Austria. El complejo, diseñado por el arquitecto Roland Rainer, combina varias salas bajo un mismo techo y durante el resto del año recibe conciertos y otros eventos deportivos." },
      { name:"Dubái, Emiratos Árabes Unidos", img:"Dubai Tennis Stadium.jpg",
        text:"El Dubai Tennis Championships se juega en el Dubai Duty Free Tennis Stadium desde su inauguración en 1996, y es uno de los pocos torneos que reúne en la misma semana un cuadro masculino y otro femenino de primer nivel. Roger Federer es el jugador con más títulos ganados en la historia del evento." },
      { name:"Dallas, EE.UU.", img:"Ford_Center_at_the_Star.jpg",
        text:"El Dallas Open volvió al circuito ATP en 2022, tras casi cuatro décadas sin un torneo profesional en la ciudad, y jugó sus primeras tres ediciones en el Styslinger/Altec Tennis Complex de la Universidad SMU. El ascenso a ATP 500 en 2025 vino de la mano de una mudanza: el torneo se trasladó al Ford Center at The Star, en Frisco, el centro de entrenamiento de los Dallas Cowboys, y hoy es uno de los dos únicos ATP 500 en suelo estadounidense y el único evento indoor de la categoría en el país." },
      /* NOTA DE DESARROLLO (no visible in-game, solo para próximas sesiones):
           - Dallas y Viena: fotos confirmadas por el usuario en su navegador real esta sesión
             (Ford_Center_at_the_Star.jpg y David_Ferrer_(Spain)_against_Viktor_Troicki_(Serbia),
             _2016_Erste_Bank_Open.jpg respectivamente). Ambas resueltas, ya no están pendientes.
           - REGLA GENERAL a partir de esta sesión: cualquier nota aclaratoria para el desarrollo
             (fotos pendientes, decisiones a medias, etc.) va en un comentario JS como este,
             NUNCA en el texto `text` que ve el jugador en pantalla. */
    ],
  },
  atp250: {
    label: "ATP 250",
    intro: "La categoría más numerosa del calendario regular, con torneos repartidos por todo el mundo. Dan menos puntos que las categorías superiores, pero son fundamentales para sostener el ranking a lo largo del año. Elegí una sede en el desplegable para ver su info.",
    venues: [
      { name:"Buenos Aires, Argentina", img:"Court central Buenos Aires Lawn Tennis Club.jpg",
        text:"El Argentina Open se juega sobre polvo de ladrillo en el Buenos Aires Lawn Tennis Club, y abre en febrero la temporada sudamericana de tierra batida, conocida entre los jugadores como la 'gira sudamericana' o 'golden swing'. Es uno de los torneos más tradicionales de la región." },
      { name:"Santiago, Chile", img:"20250302 Final Chile Open 2025 01.jpg",
        text:"El Chile Open se disputa también sobre polvo de ladrillo, como parte de esa misma gira sudamericana que sigue a Buenos Aires. Marcelo Ríos, el único chileno en llegar al número 1 del ranking mundial, es una referencia obligada cada vez que se habla del tenis local." },
      { name:"Marsella, Francia", img:"Palais des Sports de Marseille - Open 13.jpg",
        text:"El torneo de Marsella se juega bajo techo, sobre cancha rápida, en pleno invierno europeo. Con distintos nombres a lo largo de las décadas, es uno de los eventos indoor más consolidados del calendario francés fuera de París-Bercy." },
      { name:"Estocolmo, Suecia", img:"Kungliga Tennishallen.JPG",
        text:"El Stockholm Open se juega desde 1969 en el Kungliga tennishallen (la Sala Real de Tenis), uno de los escenarios más tradicionales del circuito indoor europeo. Por su historia pasaron nombres como Björn Borg y Mats Wilander, y en 1975 el recinto llegó incluso a albergar el propio Masters de fin de temporada." },
      { name:"Metz, Francia", img:"Metz 2010 4.1.jpg",
        text:"El Moselle Open se disputa bajo techo en Les Arènes de Metz, la misma semana que otros ATP 250 europeos de la temporada indoor de fin de año. Es una alternativa relativamente joven dentro del circuito, pensada para los jugadores que arrancan la gira europea de otoño." },
      { name:"Winston-Salem, EE.UU.", img:"Winston-Salem Skyline2.jpg",
        text:"El Winston-Salem Open se juega al aire libre, sobre cancha dura, en el campus de la Universidad Wake Forest, apenas unos días antes del arranque del US Open. Muchos jugadores lo eligen justamente por eso: es de las últimas chances de sumar ritmo de partidos antes del último Grand Slam del año." },
      { name:"Newport, EE.UU.", img:"ITHF Grounds and Newport Casino building.jpg",
        text:"El Hall of Fame Open se juega sobre césped, en las históricas canchas del International Tennis Hall of Fame, en Newport. Es el único torneo de pasto que quedó en el calendario norteamericano, y se disputa apenas después de Wimbledon, cuando la mayoría del circuito ya se pasó a cancha dura." },
      { name:"Gstaad, Suiza", img:"EFG Swiss Open Gstaad-ATP 250, Tennis Herren 250.jpg",
        text:"El Swiss Open Gstaad se juega sobre polvo de ladrillo en plena montaña, en uno de los pueblos de esquí más conocidos de los Alpes suizos. Es uno de los torneos de mayor altitud del calendario, con un marco natural que lo distingue del resto de los eventos de tierra europeos." },
      { name:"Auckland, Nueva Zelanda", img:"ASB Tennis Arena 2020.jpg",
        text:"El ASB Classic se juega en enero, sobre cancha dura, y suele ser uno de los primeros torneos del año calendario — una escala habitual para los jugadores que después siguen camino hacia el Abierto de Australia." },
      { name:"Båstad, Suecia", img:"Båstad Tennisstadion och Hotel Skansen augusti 2009.jpg",
        text:"El Swedish Open se juega sobre polvo de ladrillo en este pueblo costero del sur de Suecia, y es uno de los torneos más antiguos que sigue en el calendario, con ediciones que se remontan a fines de los años 40. Björn Borg lo ganó en varias oportunidades a lo largo de su carrera." },
      { name:"Kitzbühel, Austria", img:"Tennisstadion Kitzbuehel, 2015.jpg",
        text:"El Generali Open se disputa sobre polvo de ladrillo en Kitzbühel, otro pueblo alpino conocido sobre todo por el esquí. Es un clásico de mitad de año en el circuito europeo, con historia que se remonta a fines de los años 60." },
      { name:"Chennai, India", img:"Aircel Chennai Open.jpg",
        text:"El Chennai Open se jugaba sobre cancha dura al arrancar el año calendario, en el estadio SDAT de la ciudad. Durante años fue el único torneo ATP de India, y sirvió de plataforma a varios talentos locales antes de que el circuito se mudara a otras sedes del país." },
      /* NOTA DE DESARROLLO (no visible in-game):
           - Winston-Salem: foto confirmada por el usuario en su navegador real (Winston-Salem
             Skyline2.jpg). Resuelta, ya no está pendiente.
           - El resto de las sedes de ATP 250 agregadas en sesiones anteriores (Buenos Aires,
             Santiago, Marsella, Metz, Newport, Gstaad, Auckland, Båstad, Kitzbühel, Chennai) siguen
             con foto sin confirmar desde el sandbox de Claude.ai — pendiente de que el usuario
             confirme cuáles cargan la próxima vez que abra el archivo. */
    ],
  },
  challenger: {
    label: "Challenger 175 / 125",
    intro: "Un escalón por debajo del circuito principal, pensado para jugadores jóvenes en ascenso o para quienes están recuperando ranking después de una lesión. Los premios son mucho más chicos, y muchas veces los jugadores viajan y se hospedan por cuenta propia. En el juego incluye sedes como Nonthaburi, Cherbourg, Tigre, Concepción, Split y varias más.",
    venues: [
      { name:"Circuito Challenger (varias sedes)", img:"ATP Challenger Tour Tournaments (51748767809) (cropped).jpg",
        text:"El ATP Challenger Tour existe desde 1976 como escalón de transición hacia el circuito principal. Es el terreno donde la gran mayoría de los profesionales pasan buena parte de sus primeros años, lejos todavía de las canchas centrales de los grandes estadios." },
    ],
  },
  itf: {
    label: "ITF M25 / M15",
    intro: "La base de la pirámide del tenis profesional. Premios muy chicos, canchas modestas, y muchísimos jugadores compitiendo por un puñado de puntos que apenas mueven el ranking. Es donde casi todos los profesionales — incluidas futuras estrellas — dan sus primeros pasos como profesionales. En el juego incluye decenas de sedes chicas repartidas por el mundo.",
    venues: [
      { name:"Torneos ITF (varias sedes)", img:"Riverside Clay Tennis Courts.jpg",
        text:"El ITF World Tennis Tour ofrece varios cientos de torneos M15 y M25 por año en más de setenta países. Son la puerta de entrada al profesionalismo: ganar puntos acá, aunque sean pocos, es el primer paso obligado de cualquier carrera." },
    ],
  },
};

const SPONSOR_BRANDS = [
  {name:"VoltGear", color:"#2B6CB0"},
  {name:"Meridian Sport", color:"#B7791F"},
  {name:"Aurum Watches", color:"#C9A227"},
  {name:"NordFit", color:"#2C7A4B"},
  {name:"Pulse Energy", color:"#C1440E"},
  {name:"Altura Rackets", color:"#5B3A8E"},
  {name:"Zenith Airlines", color:"#1B4332"},
  {name:"Cursa Sportswear", color:"#7C3AED"},
];

// Lista de logros disponibles en el juego. Cada logro se desbloquea llamando a
// unlockAchievement(p, id) desde el punto del código donde corresponda. El campo `tier`
// (1=sencillo, 2=intermedio, 3=difícil, 4=prácticamente imposible) se usa solo para ordenar la
// pantalla de logros por dificultad — no afecta la lógica de desbloqueo.
const ACHIEVEMENTS = [
  { id:"jugador_profesional", icon:"🎾", name:"Jugador profesional", desc:"Jugaste tu primer partido como profesional.", tier:1 },
  { id:"primer_titulo", icon:"🏆", name:"Primer título", desc:"Ganaste tu primer título como profesional.", tier:1 },
  { id:"cinco_titulos", icon:"🎯", name:"Coleccionista de trofeos", desc:"Ganaste 5 títulos a lo largo de tu carrera.", tier:1 },
  { id:"diez_titulos", icon:"🏅", name:"Diez en la vitrina", desc:"Ganaste 10 títulos a lo largo de tu carrera.", tier:1 },
  { id:"primer_top100", icon:"💯", name:"Top 100", desc:"Entraste por primera vez al Top 100 del ranking ATP.", tier:1 },
  { id:"temporada_sin_lesion", icon:"🩺", name:"Cuerpo sano", desc:"Terminaste una temporada completa sin ninguna lesión.", tier:1 },
  { id:"primera_final", icon:"🥈", name:"Primera final", desc:"Llegaste a tu primera final como profesional.", tier:1 },
  { id:"primer_sponsor", icon:"🤝", name:"Primer sponsor", desc:"Firmaste tu primer contrato de sponsor.", tier:1 },
  { id:"primera_compra_tienda", icon:"🛒", name:"Primera inversión", desc:"Hiciste tu primera compra en la tienda.", tier:1 },
  { id:"cinco_temporadas", icon:"📆", name:"Constancia", desc:"Jugaste 5 temporadas completas sin perderte ningún torneo (por lesión, doping o soborno).", tier:1 },
  { id:"diez_temporadas", icon:"🎖️", name:"Veterano del circuito", desc:"Jugaste 10 temporadas completas sin perderte ningún torneo.", tier:1 },
  { id:"veinte_temporadas", icon:"⏳", name:"Longevidad", desc:"Jugaste 20 temporadas completas sin perderte ningún torneo.", tier:2 },
  { id:"veintiseis_temporadas", icon:"🗻", name:"Inquebrantable", desc:"Jugaste 26 temporadas completas sin perderte ningún torneo — el máximo posible en una carrera.", tier:3 },
  { id:"ganar_m1000", icon:"🥇", name:"Maestro de los 1000", desc:"Ganaste un Masters 1000.", tier:2 },
  { id:"top10", icon:"🔟", name:"Top 10 mundial", desc:"Entraste al Top 10 del ranking ATP.", tier:2 },
  { id:"atp_finals_clasif", icon:"🏟️", name:"Clasificado al ATP Finals", desc:"Terminaste el año entre los 8 mejores y clasificaste al ATP Finals.", tier:2 },
  { id:"davis_convocado", icon:"🎽", name:"Convocado al Equipo de la Copa Davis", desc:"Fuiste convocado al equipo de tu selección para la Copa Davis.", tier:2 },
  { id:"davis_campeon", icon:"🏳️", name:"Campeón de Copa Davis", desc:"Ganaste la Copa Davis con tu selección.", tier:2 },
  { id:"remontada", icon:"🔥", name:"Remontada", desc:"Ganaste un título justo después de una racha de 4 o más torneos cayendo en primera ronda.", tier:2 },
  { id:"zona_gris_esquivada", icon:"😇", name:"Manos limpias", desc:"Rechazaste una propuesta de doping o de arreglar un partido.", tier:2 },
  { id:"doping_impune", icon:"💊", name:"Sin sospechas", desc:"Usaste el doping y no te agarraron en el control.", tier:2 },
  { id:"titulo_precoz", icon:"🐣", name:"Promesa precoz", desc:"Ganaste un título siendo menor de 18 años.", tier:2 },
  { id:"titulo_veterano", icon:"🧓", name:"El último baile", desc:"Ganaste un título con 36 años o más.", tier:2 },
  { id:"cinco_millones", icon:"💵", name:"Cinco millones", desc:"Superaste los $5.000.000 ganados a lo largo de tu carrera.", tier:2 },
  { id:"cinco_items_stat", icon:"🧰", name:"Equipo completo", desc:"Subiste al menos un nivel las 5 mejoras de stats en la tienda (saque, potencia, movilidad, técnica y mental).", tier:2 },
  { id:"minijuegos_completos", icon:"🕹️", name:"Todoterreno", desc:"Ganaste los 3 minijuegos de match point, cada uno al menos una vez.", tier:2 },
  { id:"cuatro_sponsors", icon:"💼", name:"Cartera completa", desc:"Tuviste 4 sponsors activos al mismo tiempo.", tier:2 },
  { id:"veinticinco_titulos", icon:"🎖️", name:"Máquina de ganar", desc:"Ganaste 25 títulos a lo largo de tu carrera.", tier:2 },
  { id:"numero1_mundo", icon:"🌍", name:"Número 1 del mundo", desc:"Llegaste a ser el #1 del ranking ATP.", tier:3 },
  { id:"golden_slam_carrera", icon:"🎖️", name:"Career Golden Slam", desc:"Ganaste los 4 Grand Slams a lo largo de tu carrera.", tier:3 },
  { id:"super_slam", icon:"🏵️", name:"Super Slam", desc:"Ganaste los 4 Grand Slams y el ATP Finals a lo largo de tu carrera.", tier:4 },
  { id:"career_super_slam", icon:"💎", name:"Career Super Slam", desc:"Ganaste los 4 Grand Slams, el ATP Finals y la Copa Davis a lo largo de tu carrera.", tier:4 },
  { id:"big_four", icon:"🎴", name:"Big Four", desc:"Ganaste al menos un Grand Slam, un Masters 1000, el ATP Finals y la Copa Davis a lo largo de tu carrera.", tier:3 },
  { id:"retiro_top5", icon:"🌟", name:"Leyenda del circuito", desc:"Te retiraste habiendo estado en el Top 5 del mundo en algún momento de tu carrera.", tier:3 },
  { id:"racha_titulos_temporada", icon:"⚡", name:"Temporada de ensueño", desc:"Ganaste 3 o más títulos en la misma temporada.", tier:2 },
  { id:"temporada_perfecta", icon:"🌠", name:"Temporada perfecta", desc:"Ganaste 5 o más títulos en la misma temporada.", tier:3 },
  { id:"diez_millones", icon:"💰", name:"Diez millones", desc:"Superaste los $10.000.000 ganados a lo largo de tu carrera.", tier:3 },
  { id:"veinte_millones", icon:"🏦", name:"Veinte millones", desc:"Superaste los $20.000.000 ganados a lo largo de tu carrera.", tier:4 },
  { id:"cenicienta", icon:"👠", name:"La Cenicienta", desc:"Ganaste un Grand Slam habiendo arrancado tu carrera sin ninguna etiqueta especial (nivel normal).", tier:3 },
  { id:"cincuenta_titulos", icon:"👑", name:"Salón de la fama", desc:"Ganaste 50 títulos a lo largo de tu carrera.", tier:3 },
  { id:"calendario_gs_real", icon:"🐐", name:"Grand Slam de calendario", desc:"Ganaste los 4 Grand Slams en la MISMA temporada.", tier:4 },
  { id:"carrera_sin_lesion", icon:"🛡️", name:"Cuerpo de acero", desc:"Terminaste toda tu carrera sin sufrir ninguna lesión, ni en pretemporada ni durante la temporada.", tier:4 },
  { id:"numero1_sin_comprar", icon:"🧘", name:"Talento puro", desc:"Llegaste a ser #1 del mundo sin haber comprado nada en la tienda.", tier:4 },
  { id:"doping_impune_x4", icon:"🎰", name:"El intocable", desc:"Usaste el doping 4 veces a lo largo de tu carrera y nunca te agarraron en un control.", tier:4 },
  { id:"coleccion_completa", icon:"🗂️", name:"Colección completa", desc:"Ganaste al menos un título en las 6 categorías principales del calendario: Grand Slam, Masters 1000, ATP 500, ATP 250, Challenger 175 y Challenger 125.", tier:4 },
  { id:"ganar_gs", icon:"👑", name:"Grand Slam", desc:"Ganaste un Grand Slam.", tier:3 },
  { id:"ganar_atp_finals", icon:"🏟️", name:"Campeón del ATP Finals", desc:"Ganaste el ATP Finals de fin de temporada.", tier:2 },
  { id:"ganar_m1000_todos", icon:"🌐", name:"Dueño de los Masters", desc:"Ganaste los 9 Masters 1000 del calendario a lo largo de tu carrera.", tier:4 },
  { id:"juegos_olimpicos_participante", icon:"🎌", name:"Representante olímpico", desc:"Fuiste convocado y jugaste los Juegos Olímpicos representando a tu país.", tier:1 },
  { id:"juegos_olimpicos_medalla", icon:"🏅", name:"Medallista Olímpico", desc:"Ganaste al menos una medalla (oro, plata o bronce) en los Juegos Olímpicos.", tier:2 },
  { id:"juegos_olimpicos_oro", icon:"🥇", name:"Campeón Olímpico", desc:"Ganaste la medalla de oro en los Juegos Olímpicos.", tier:3 },
  { id:"super_career_slam", icon:"💫", name:"Super Career Slam", desc:"Ganaste los Juegos Olímpicos, los 4 Grand Slams, el ATP Finals y la Copa Davis a lo largo de tu carrera.", tier:4 },
];
// BUG CORREGIDO (a pedido del usuario): varios logros que se desbloquean en finishYear() DESPUÉS
// de p.edad++ (ATP Finals, Copa Davis, ranking, rachas de temporada, retiro) quedaban registrados
// con la edad del año SIGUIENTE en vez de la edad real en la que se ganaron — ej. "Leyenda del
// circuito" podía aparecer desbloqueado "a los 41 años" con una carrera que termina a los 40. Ahora
// unlockAchievement() acepta un tercer parámetro opcional `edadOverride`; si no se pasa, sigue
// usando p.edad (comportamiento de siempre, correcto para todo lo que se dispara EN PLENA
// temporada, antes del incremento). Los call-sites de finishYear()/renderEpilogue() que corren
// después del incremento ahora pasan explícitamente `p.edad-1` (o `edadRetiro`, que es lo mismo).
function unlockAchievement(p, id, edadOverride){
  p.logros = p.logros || {};
  if(!p.logros[id]) p.logros[id] = { edad: edadOverride!==undefined ? edadOverride : p.edad };
}
// Variante para logros "dinámicos" cuyo id/nombre/ícono no está fijo en la constante ACHIEVEMENTS
// (por ejemplo, "Rey de <ciudad>", que depende de la sede real donde se ganó el título 5 veces).
// Se guarda toda la info directamente en el registro del logro (p.logros[id]), en vez de resolverla
// contra ACHIEVEMENTS como hacen los logros fijos — renderLogros() sabe leer ambos formatos.
// Acepta `edadOverride` opcional, mismo motivo que unlockAchievement: algunos disparadores (ATP
// Finals en finishYear()) corren DESPUÉS de p.edad++, así que sin este parámetro quedaría
// registrado con la edad del año siguiente en vez de la edad real en la que se ganó.
function unlockDynamicAchievement(p, id, info, edadOverride){
  p.logros = p.logros || {};
  if(!p.logros[id]) p.logros[id] = { edad: edadOverride!==undefined ? edadOverride : p.edad, icon: info.icon, name: info.name, desc: info.desc, tier: info.tier, dynamic:true };
}
// Chequea los logros de "título precoz/veterano" según la edad que tenía el jugador cuando
// efectivamente jugó ese título (no necesariamente p.edad actual, que ya pudo haber envejecido
// un año en finishYear() para cuando se resuelven los bonus de ATP Finals / Copa Davis). Como
// edadAlJugar YA es la edad correcta, se la pasamos directo a unlockAchievement como edadOverride
// (antes se calculaba bien para el chequeo del umbral pero no se usaba para lo que quedaba
// GUARDADO en el logro, que caía siempre en p.edad — mismo bug de fondo que el resto de esta lista).
function checkAgeTitleAchievements(p, edadAlJugar){
  if(edadAlJugar < 18) unlockAchievement(p, 'titulo_precoz', edadAlJugar);
  if(edadAlJugar >= 36) unlockAchievement(p, 'titulo_veterano', edadAlJugar);
}
function checkMoneyAchievements(p, edadOverride){
  if((p.dineroTotalGanado||0) >= 5000000) unlockAchievement(p, 'cinco_millones', edadOverride);
  if((p.dineroTotalGanado||0) >= 10000000) unlockAchievement(p, 'diez_millones', edadOverride);
  if((p.dineroTotalGanado||0) >= 20000000) unlockAchievement(p, 'veinte_millones', edadOverride);
}
// Logros por cantidad total de títulos acumulados en la carrera (torneos normales + ATP Finals +
// Copa Davis, todo lo que suma a p.titulos). Se llama cada vez que p.titulos se incrementa.
function checkTitleCountAchievements(p, edadOverride){
  if(p.titulos >= 5) unlockAchievement(p, 'cinco_titulos', edadOverride);
  if(p.titulos >= 10) unlockAchievement(p, 'diez_titulos', edadOverride);
  if(p.titulos >= 25) unlockAchievement(p, 'veinticinco_titulos', edadOverride);
  if(p.titulos >= 50) unlockAchievement(p, 'cincuenta_titulos', edadOverride);
}
// Cuenta temporadas "limpias" en p.historial — aquellas donde se jugaron los 8 torneos previstos,
// sin que se haya recortado el calendario por lesión, sanción de doping o de soborno (las 3 únicas
// razones por las que yearState.calendario puede terminar con menos de 8 entradas — ver
// checkMidSeasonInjuryThenPlay, renderDopingEvent y renderSobornoEvent). Reemplaza al viejo chequeo
// de "jugaste 5 temporadas" (que no exigía nada sobre si se habían completado sin interrupciones) —
// a pedido del usuario, ahora la escalera completa (5/10/20/26) exige lo mismo, con 26 siendo el
// máximo posible en una carrera (retiro obligatorio a los 40, arrancando a los 15).
function checkCleanSeasonsAchievements(p, edadOverride){
  const limpias = p.historial.filter(h=>h.torneos && h.torneos.length===8).length;
  if(limpias>=5) unlockAchievement(p, 'cinco_temporadas', edadOverride);
  if(limpias>=10) unlockAchievement(p, 'diez_temporadas', edadOverride);
  if(limpias>=20) unlockAchievement(p, 'veinte_temporadas', edadOverride);
  if(limpias>=26) unlockAchievement(p, 'veintiseis_temporadas', edadOverride);
}
// El "Big Four": ganar al menos un Grand Slam, un Masters 1000, el ATP Finals y la Copa Davis a
// lo largo de la carrera (no hace falta que sea el mismo año). Los primeros dos se leen directo
// de los logros ya desbloqueados; ATP Finals no tiene un logro propio por ganarlo (solo por
// clasificar), así que se trackea con un flag interno (p.atpFinalsGanado) pensado solo para esto.
function checkBigFour(p, edadOverride){
  p.logros = p.logros || {};
  if(p.logros.ganar_gs && p.logros.ganar_m1000 && p.atpFinalsGanado && p.logros.davis_campeon){
    unlockAchievement(p, 'big_four', edadOverride);
  }
}
// "Super Slam": ganar los 4 Grand Slams (Career Golden Slam) MÁS el ATP Finals a lo largo de la
// carrera (no hace falta que sea el mismo año). "Career Super Slam": lo mismo, sumando además la
// Copa Davis. Se llama desde los 3 puntos donde se puede completar la combinación: al ganar un
// Grand Slam (junto a golden_slam_carrera, en finalizeTournamentResult), al ganar el ATP Finals, y
// al ganar la Copa Davis (estos dos últimos en finishYear()).
function checkSuperSlam(p, edadOverride){
  p.logros = p.logros || {};
  if(p.logros.golden_slam_carrera && p.atpFinalsGanado){
    unlockAchievement(p, 'super_slam', edadOverride);
    if(p.logros.davis_campeon) unlockAchievement(p, 'career_super_slam', edadOverride);
  }
}
// "Super Career Slam": ganaste los Juegos Olímpicos, los 4 Grand Slams (Career Golden Slam), el
// ATP Finals y la Copa Davis a lo largo de la carrera (no hace falta que sea el mismo año). Se
// llama desde los 4 puntos donde se puede completar la combinación: al ganar un Grand Slam (junto
// a golden_slam_carrera/checkSuperSlam, en finalizeTournamentResult), al ganar el ATP Finals, al
// ganar la Copa Davis (estos dos en finishYear()), y al ganar el oro olímpico.
function checkSuperCareerSlam(p, edadOverride){
  p.logros = p.logros || {};
  if(p.logros.golden_slam_carrera && p.atpFinalsGanado && p.logros.davis_campeon && p.olimpicoOro){
    unlockAchievement(p, 'super_career_slam', edadOverride);
  }
}
function checkStatItemsAchievement(p){
  const statItems = SHOP_ITEMS.filter(it=>it.stat);
  if(statItems.every(it=>(p.itemLevels[it.id]||0)>=1)) unlockAchievement(p, 'cinco_items_stat');
}
// Registra que se ganó un minijuego de match point de un tipo puntual ('timing'/'rally'/'movrally'),
// y desbloquea el logro combinado apenas se ganaron los 3 tipos al menos una vez cada uno.
function registerMinigameWin(p, tipo){
  p.minijuegosGanados = p.minijuegosGanados || {};
  p.minijuegosGanados[tipo] = true;
  if(p.minijuegosGanados.timing && p.minijuegosGanados.rally && p.minijuegosGanados.movrally){
    unlockAchievement(p, 'minijuegos_completos');
  }
}

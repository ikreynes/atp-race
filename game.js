/* =========================================================
   ATP RACE — game.js
   Estado del juego, generación de pool/NPCs, calendario, resolución de
   torneos, todas las pantallas (render*), flujo de temporada, minijuegos,
   Copa Davis, Juegos Olímpicos, epílogo. Depende de las constantes y
   funciones definidas en data.js (debe cargarse DESPUÉS de data.js).
========================================================= */

/* =========================================================
   ESTADO DEL JUEGO
========================================================= */
let G = {
  screen: "intro",
  player: null,
  pool: [],
  yearEvents: [],       // pool de cartas de evento sin repetir
  turn: 0,
  selectedCountry: null,
  minijuegosOn: false,  // si está tildado en la creación de personaje, el match point puede resolverse con un minijuego
  tempMinijuegos: true, // arranca tildado por default (es fácil olvidarse de tildarlo a mano)
  nightMode: false,     // modo nocturno (colores suaves para poca luz), desactivado por defecto
  tempNightMode: false,
  grandSlamHistorial: [], // registro año a año de los 4 campeones de Grand Slam (jugador o NPC), ver assignGrandSlamChampions()
};

function clamp(v,min=0,max=100){ return Math.max(min, Math.min(max, v)); }
// Entero al azar entre min y max, ambos inclusive. Usado por los bonus variables de "Selección
// Nacional" (becas/predio) — antes esos bonus eran un número fijo, se pidió que fueran un rango.
function randInt(min,max){ return min + Math.floor(Math.random()*(max-min+1)); }
function fmt(n){ return "$" + Math.round(n).toLocaleString('es-AR'); }
function randNormal(mean, sd){ let u=1-Math.random(), v=Math.random(); return mean + sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

// Genera las 5 sub-stats iniciales del jugador con variación individual (randNormal, desvío 6,
// mismo criterio que siempre) pero forzando que la SUMA de las 5 dé exactamente nivelObjetivo*5.
// Así el "nivel" final (promedio redondeado de las 5 sub-stats) cae SIEMPRE en el nivel exacto que
// se sorteó, nunca se corre al tramo vecino por culpa del redondeo o de la variación individual de
// cada sub-stat — ver el comentario largo en newPlayer() sobre por qué hacía falta esto.
function genSubstatsForNivel(nivelObjetivo){
  const stats = ["saque","potencia","movilidad","tecnica","mental"];
  const minStat = 20, maxStat = 99; // límites razonables por sub-stat individual (casi nunca se pisan en el rango de nivel 50-74)
  let raw = stats.map(()=> clamp(Math.round(randNormal(nivelObjetivo,6)), minStat, maxStat));
  let diff = nivelObjetivo*5 - raw.reduce((a,b)=>a+b,0);
  // Repartimos la diferencia de a 1 punto por vez, en orden aleatorio (no siempre la misma stat),
  // respetando los límites individuales de cada sub-stat.
  const order = shuffle(stats.map((_,i)=>i));
  let guard = 0;
  while(diff !== 0 && guard < 2000){
    const idx = order[guard % order.length];
    if(diff > 0 && raw[idx] < maxStat){ raw[idx]++; diff--; }
    else if(diff < 0 && raw[idx] > minStat){ raw[idx]--; diff++; }
    guard++;
  }
  const result = {};
  stats.forEach((s,i)=>{ result[s]=raw[i]; });
  return result;
}

function newPlayer(nombre, country){
  const roll = Math.random();
  // Probabilidades de etiqueta especial de inicio — SUBIDAS de nuevo esta sesión (a pedido del
  // usuario, "más diversión para el jugador"): normal 55% (antes 65.98%), destacado 28% (antes 21%),
  // promesa 13% (antes 10.5%), prodigio 3% (antes 2.1%), maestro del tenis 1% (antes 0.42%).
  // Los RANGOS DE NIVEL por tramo (sesión anterior, sin solapamiento entre tramos vecinos — ver
  // genSubstatsForNivel()) NO se tocaron: normal 50-54, destacado 55-59, promesa 60-64, prodigio
  // 65-69, maestro del tenis 70-74. Este cambio es puramente de FRECUENCIA (qué tan seguido te toca
  // cada tramo), no de qué nivel te da cada uno.
  // SOLO afecta al jugador (esta función) — makeNPC() no se tocó, los NPCs rivales siguen
  // generándose exactamente igual que antes.
  const tramo = roll < 0.01 ? {label:"maestro", min:70, max:74}
    : roll < 0.04 ? {label:"prodigio", min:65, max:69}
    : roll < 0.17 ? {label:"promesa", min:60, max:64}
    : roll < 0.45 ? {label:"destacado", min:55, max:59}
    : {label:null, min:50, max:54};
  const nivel = randInt(tramo.min, tramo.max);
  const substats = genSubstatsForNivel(nivel);
  const etiquetaInicio = tramo.label;
  return {
    nombre, pais: country,
    edad: 15, nivel, ...substats,
    fisico: 85, fisicoMax: 100, fama: 3, dinero: 4000,
    puntos: 0, ranking: 700, bestRanking: 700, bestNivel: nivel,
    titulos: 0, finales: 0, etiquetaInicio,
    itemLevels: {}, repeatBuys: {}, sponsors: [], pendingSponsorOffers: [],
    historial: [], titulosList: [], dineroTotalGanado: 4000,
    dopingUsos: 0, // cuántas veces aceptó el doping en esta carrera; sube el riesgo de ser descubierto la próxima vez
    dopingImpuneCount: 0, // cuántas veces usó el doping SIN ser descubierto (para "El intocable")
    dopingAgarradoAlgunavez: false, // si alguna vez lo agarraron en un control (invalida "El intocable" para siempre)
    tuvoLesionAlguna: false, // si tuvo alguna lesión real en cualquier temporada de la carrera (para "Cuerpo de acero")
    categoriasTitulo: {}, // categorías de torneo (gs/m1000/atp500/etc) en las que ya ganó al menos un título, para "Colección completa"
    gsGanados: {}, // sedes de Grand Slam ya ganadas (para Career Golden Slam)
    m1000Ganados: {}, // sedes de Masters 1000 ya ganadas (para "Dueño de los Masters")
    titulosPorSede: {}, // cantidad de títulos ganados por combinación categoría+sede (para el logro dinámico "Rey de <ciudad>")
    torneosSinGanarRonda: 0, // racha de torneos consecutivos cayendo en primera ronda (se resetea apenas gana una ronda), para el logro "Remontada"
    copaDavisHistorial: [], // registro año a año del fixture de Copa Davis (campeón/subcampeón/semifinalistas), para la pestaña "Historial de Copa Davis" — se llena en finishYear(), un registro por temporada, jugado o no el jugador
    torneosPorAnio: {}, // registro año a año de QUÉ jugó el jugador y a qué ronda llegó, para la pantalla "Torneos disputados" — ver registrarTorneoAnio()
    logros: {}, // logros desbloqueados: { [id]: {edad} } — los logros dinámicos ("Rey de <ciudad>") además guardan icon/name/desc/tier propios, ver unlockDynamicAchievement
  };
}

function makeNPC(idPrefix, idx, forceYoung, forcedPais){
  const roll = Math.random();
  // Para debutantes (forceYoung), la cantera de futuras figuras es más generosa que para el pool
  // fundador: así el circuito sostiene en el tiempo una cantidad de jugadores de élite parecida
  // a la que arranca en el año 0, en vez de licuarse a medida que los fundadores se retiran.
  const isEstrella = forceYoung ? roll < 0.25 : roll < 0.12;
  const isTop = forceYoung ? (!isEstrella && roll < 0.60) : (!isEstrella && roll < 0.40);
  // El país se elige ANTES de calcular el nivel (antes se elegía después), porque ahora el nivel
  // depende del tier tenístico del país — ver COUNTRY_TIER_BIAS más arriba. `forcedPais` (opcional)
  // permite pisar la elección al azar y forzar un país puntual — lo usa la "red de seguridad" de
  // replenishPool() para rellenar países que quedaron por debajo del piso de 3 jugadores activos.
  const pais = forcedPais || COUNTRY_CODES[Math.floor(Math.random()*COUNTRY_CODES.length)];
  const tierBias = COUNTRY_TIER_BIAS[pais] || 0;
  // Base de los NPCs "estrella" del pool FUNDADOR: bajada de 85 a 74 en la sesión de "menos 90+/
  // 95+", pero el usuario reportó que quedó DEMASIADO bajo (afectó feo al puntaje general del
  // ranking). CORRECCIÓN esta sesión: subida a 81 — un punto medio entre el original (85, con
  // demasiados 90+/95+) y el 74 anterior (muy poco, deprimía el ranking entero). Ver también
  // npcGrowthFactor() más abajo, ajustado en la misma dirección.
  const base = forceYoung
    ? (isEstrella ? randNormal(66+tierBias,7) : isTop ? randNormal(50+tierBias,7) : randNormal(34+tierBias,8)) // debutantes: potencial, no nivel ya hecho
    : (isEstrella ? randNormal(81+tierBias,6) : isTop ? randNormal(68+tierBias,8) : randNormal(48+tierBias,13));
  const nombre = randNameFor(pais);
  // Becas para nuevos jugadores (ítem de "Selección Nacional" en la tienda, ver SHOP_NATIONAL_ITEMS):
  // los debutantes (forceYoung) del país del jugador arrancan con un plus de nivel — un sorteo
  // independiente de 2 a 4 por CADA nivel que el jugador haya comprado del ítem (nivel 2 = 2 sorteos
  // sumados, entre +4 y +8). No afecta al pool fundador (forceYoung=false) ni a otros países, y no
  // es retroactivo: solo aplica a partir del momento en que se compró.
  let becasBonus = 0;
  if(forceYoung && G.player && G.player.pais===pais && G.player.itemLevels){
    const becasLevel = G.player.itemLevels.becas || 0;
    for(let i=0;i<becasLevel;i++) becasBonus += randInt(2,4);
  }
  const nivel = clamp(Math.round(base)+becasBonus,16,99);
  // Edad: para debutantes (forceYoung) sigue siendo siempre 15-16, sin cambios — ya arrancan con
  // "potencial" bajo y van creciendo con los años (nunca fue un problema real, confirmado con
  // simulación). Para el pool FUNDADOR (forceYoung=false, los NPCs que ya están en el circuito al
  // arrancar la carrera), antes la edad se sorteaba 15-32 TOTALMENTE independiente del nivel —
  // eso permitía que le tocara, por pura casualidad, un nivel "estrella" (85-99) a un pibe de
  // 15-16 años, algo que el usuario reportó ver seguido (confirmado con simulación: ~0.86 casos
  // por carrera antes de este fix). Fix: la edad mínima posible ahora depende del nivel ya
  // sorteado — así un nivel muy alto no puede caerle a alguien recién salido. La fórmula de nivel
  // en sí NO se toca (ni la distribución de niveles, ni el sesgo por tier de país, ni el punto de
  // corte de "estrella"/"top"), así que el balance general del ranking queda intacto (nivel
  // promedio global verificado con simulación: 55.37 antes vs 55.83 después, diferencia dentro
  // del ruido estadístico) — solo se reordena qué edad le toca a cada nivel.
  let edad;
  if(forceYoung){
    edad = 15+Math.floor(Math.random()*2);
  } else {
    const edadMin = nivel>=85 ? 21 : nivel>=70 ? 18 : 15;
    edad = edadMin + Math.floor(Math.random()*(33-edadMin));
  }
  return {
    id:idPrefix+idx, nombre, pais,
    edad,
    nivel,
    puntos:0, retirado:false, esEstrella:isEstrella,
  };
}

// Tamaño del pool de NPCs, ATADO a la cantidad de países en juego (ANTES era un 499 fijo). Con 48
// países el promedio histórico fue ~10.4 jugadores activos por país — este cálculo mantiene esa
// misma densidad aunque se sumen más países, para no diluir la cantidad de jugadores por selección
// (ver sesión de "expansión a 64 países": con 499 fijo y 64 países, la simulación mostraba ~1 país
// por debajo de 3 jugadores activos en cualquier momento; escalando el pool así, vuelve a ~0.1-0.2,
// igual que con 48 países). Si en el futuro se suman más países, este número escala solo.
const CIRCUIT_POOL_SIZE = Math.round(COUNTRY_CODES.length * 10.4);
// "Red de seguridad" (piso de 3 jugadores activos por país, sesión de "expansión a 64 países" +
// Grupos Mundiales): aunque CIRCUIT_POOL_SIZE escala con la cantidad de países para mantener la
// densidad de siempre (~10.4 jugadores/país), la asignación de país de cada NPC sigue siendo
// uniforme al azar (ver makeNPC), así que por pura variancia estadística algún país puede quedar
// ocasionalmente por debajo de 3 jugadores activos — insuficiente para convocar un equipo de Copa
// Davis (validado con simulación: ~0.13 países/temporada en el peor caso, picos de hasta 2 países
// en una misma temporada sobre 450 simuladas). Esta función revisa TODOS los países y genera
// debutantes ADICIONALES, forzados a ese país puntual (parámetro forcedPais de makeNPC), hasta
// llegar al piso de 3. Son debutantes normales (forceYoung=true, mismo potencial que cualquier
// otro debutante) — no se les regala nivel extra por ser "de relleno", solo garantizan que el país
// tenga plantel mínimo para competir. Se llama tanto en el pool inicial (genPool, vía la creación
// de personaje) como al final de cada replenishPool anual.
function ensureMinRosterPerCountry(pool){
  COUNTRY_CODES.forEach(pais=>{
    const activosPais = pool.filter(p=>!p.retirado && p.pais===pais).length;
    const faltanPais = Math.max(0, 3 - activosPais);
    for(let i=0;i<faltanPais;i++){
      npcCounter++;
      const relleno = makeNPC("relleno", npcCounter, true, pais);
      relleno.puntos = Math.max(0, Math.round(relleno.nivel*10 + randNormal(0,60)));
      pool.push(relleno);
    }
  });
}

function genPool(n){
  const pool = [];
  for(let i=0;i<n;i++){
    pool.push(makeNPC("npc",i,false));
  }
  gsSlotsRestantes = 4;
  pool.forEach(p => p.puntos = estimateNPCPoints(p));
  ensureMinRosterPerCountry(pool);
  return pool;
}

let npcCounter = 100000;
function replenishPool(pool){
  const activos = pool.filter(p=>!p.retirado).length;
  // el circuito tiene que tener ~CIRCUIT_POOL_SIZE activos + vos en el ranking (ver definición de
  // CIRCUIT_POOL_SIZE más arriba — ya no es un 499 fijo, escala con la cantidad de países)
  const objetivo = CIRCUIT_POOL_SIZE;
  const faltantes = Math.max(0, objetivo - activos);
  const nuevos = faltantes + Math.floor(Math.random()*6); // un poco de margen extra, como entradas de qualy
  for(let i=0;i<nuevos;i++){
    npcCounter++;
    const npc = makeNPC("debut", npcCounter, true);
    npc.puntos = Math.max(0, Math.round(npc.nivel*10 + randNormal(0,60))); // recién llegan, pocos puntos
    pool.push(npc);
  }
  ensureMinRosterPerCountry(pool);
}

// Reparte el "efecto total" de una mejora de tienda entre la cantidad de niveles disponibles,
// así extender a más niveles no significa más efecto total, solo más granularidad (y más caro llegar al tope).
function shopCumulativeEffect(totalEffect, numLevels, level){
  return level<=0 ? 0 : (totalEffect * level / numLevels);
}
function shopLevelGain(totalEffect, numLevels, level){
  return Math.round(shopCumulativeEffect(totalEffect,numLevels,level)) - Math.round(shopCumulativeEffect(totalEffect,numLevels,level-1));
}

// El fisioterapeuta de planta ahora reduce el riesgo de lesión (pretemporada, entrenamiento y
// en plena temporada), en vez de la recuperación de físico (que pasó a ser parte del nutricionista).
// Devuelve una fracción 0..0.5: multiplicamos cada probabilidad de lesión por (1 - esto).
function fisioInjuryReduction(p){
  const lvl = (p.itemLevels && p.itemLevels.fisio) || 0;
  return shopCumulativeEffect(0.5, 10, lvl);
}
// Protección extra por tener buen físico (a pedido del usuario: "sentís que el riesgo de lesión es
// alto apenas baja un poco el físico"). A partir de 80 de físico, el riesgo de CUALQUIER lesión baja
// un poco más, hasta -12% con el físico al tope (100) — cambio intencionalmente sutil, no reemplaza
// al Fisioterapeuta de la tienda, se combina multiplicando ambos factores. Con físico 80 o menos no
// hace nada (factor 1, sin cambios) — la reducción es un premio por estar MUY bien, no algo que ya
// tengas con un físico apenas decente.
function highFisicoProtection(fisico){
  return clamp(1 - Math.max(0, fisico-80)*0.006, 0.88, 1);
}

function diminish(gain, currentStat, edad){
  // cuanto más cerca del techo (99), menos rinde cada punto de mejora — pero nunca a cero
  // Piso bajado apenas (0.09→0.075, a pedido del usuario: "sigue siendo un poco exagerado llegar a
  // 99") — solo afecta stats por encima de ~88, donde el piso ya estaba entrando en juego; no toca
  // nada por debajo de eso.
  if(gain<=0) return gain;
  const statFactor = clamp((95-currentStat)/74, 0.075, 1);
  const ageFactor = edad!==undefined ? clamp(1 - Math.max(0,edad-22)*0.022, 0.55, 1.15) : 1;
  return gain*statFactor*ageFactor;
}
// Extrae SOLO el factor de edad de diminish() (sin el de cercanía al techo/statFactor), para poder
// aplicárselo al bonus del "Entrenador personal" sin que ese bonus se diluya cerca del cap de la
// stat — ver el comentario largo en renderTrainingChoice() sobre por qué se separó.
function ageFactorOnly(edad){
  return edad!==undefined ? clamp(1 - Math.max(0,edad-22)*0.022, 0.55, 1.15) : 1;
}
// Versión propia del "castigo por cercanía al techo" para el bonus del Entrenador personal — misma
// curva que statFactor dentro de diminish(), pero con un PISO mucho más alto (0.33 en vez de 0.09):
// a pedido del usuario, el entrenador tiene que seguir rindiendo menos cuanto más alta ya esté la
// stat (no queremos que sea plano/infinito como quedó en la sesión anterior), pero sin desplomarse
// a +1 cerca del 90+ como pasaba con el statFactor original (ver sesión "entrenador se diluye").
function coachStatFactor(currentStat){
  return clamp((95-currentStat)/74, 0.33, 1);
}

function applyAgingToPlayer(p){
  let drift;
  if(p.edad <= 20) drift = 1.1;       // margen de mejora natural del cuerpo/juego en la juventud, además de lo que entrenes
  else if(p.edad <= 25) drift = 0.4;  // sigue mejorando de a poco, plenitud
  else if(p.edad <= 29) drift = 0;    // meseta
  else if(p.edad <= 33) drift = -1.3;
  else if(p.edad <= 36) drift = -2.6;
  else drift = -4;
  ["saque","potencia","movilidad","tecnica","mental"].forEach(k=>{
    const d = drift>0 ? diminish(drift,p[k],p.edad) : drift;
    p[k] = clamp(Math.round(p[k] + d + randNormal(0,0.8)), 12, 99);
  });
  recalcNivel(p);
  // el techo de físico también baja con la edad, sobre todo pasados los 30
  p.fisicoMax = clamp(Math.round(100 - Math.max(0,p.edad-28)*2.2), 45, 100);
  p.fisico = Math.min(p.fisico, p.fisicoMax);
}

function simRondaPorTorneo(nivel, tier){
  const toughness = TIER_TOUGHNESS[tier.weight];
  const totalRounds = tier.points.length;
  let ronda = 0;
  while(ronda < totalRounds){
    const base = 0.5 + (nivel - toughness)/34;
    const roundPenalty = ronda*0.015;
    const chance = clamp(base - roundPenalty, 0.05, 0.87);
    if(Math.random() < chance){ ronda++; } else { break; }
  }
  return ronda>0 ? tier.points[ronda-1] : 0;
}

// Solo puede haber 4 campeones de Grand Slam por año en TODO el circuito (vos + los ~CIRCUIT_POOL_SIZE NPCs),
// como en la realidad. Sin este cupo, cada NPC "ganaba" su propia simulación de forma
// independiente y sin coordinación con los demás, generando muchos más campeones de los que
// deberían existir en un año. Se resetea en finishYear(), descontando los que ya ganaste vos.
let gsSlotsRestantes = 4;
function simRondaGSConCupo(nivel, tier){
  const toughness = TIER_TOUGHNESS[tier.weight];
  const totalRounds = tier.points.length;
  let ronda = 0;
  while(ronda < totalRounds){
    const base = 0.5 + (nivel - toughness)/34;
    const roundPenalty = ronda*0.015;
    const chance = clamp(base - roundPenalty, 0.05, 0.87);
    if(Math.random() < chance){ ronda++; } else { break; }
  }
  if(ronda === totalRounds){
    if(gsSlotsRestantes > 0){
      gsSlotsRestantes--;
      return tier.points[ronda-1]; // campeón: todavía quedaba cupo
    }
    return tier.points[ronda-2]; // llegó a la final pero el título ya estaba entregado ese año
  }
  return ronda>0 ? tier.points[ronda-1] : 0;
}

function estimateNPCPoints(npc){
  let total = 0;
  if(npc.nivel >= 62){
    // los jugadores de nivel alto arman un calendario mixto real: varios Slams, varios Masters, algún 500,
    // no repiten solo "su" categoría — pero igual que el jugador, el año tiene 8 torneos como máximo
    // (antes se rellenaba hasta 9, dándoles una fecha extra que el jugador nunca puede tener).
    const calendario = [];
    const gsCount = npc.nivel>=76 ? 4 : npc.nivel>=70 ? 2+Math.floor(Math.random()*3) : Math.floor(Math.random()*2);
    for(let i=0;i<gsCount;i++) calendario.push(TIER_BY_ID.gs);
    const m1000MaxSlots = Math.max(0, 8 - gsCount);
    const m1000Count = Math.min(m1000MaxSlots, 2+Math.floor(Math.random()*4));
    for(let i=0;i<m1000Count;i++) calendario.push(TIER_BY_ID.m1000);
    while(calendario.length<8) calendario.push(TIER_BY_ID.atp500);
    calendario.forEach(tier=>{ total += (tier.id==='gs' ? simRondaGSConCupo(npc.nivel, tier) : simRondaPorTorneo(npc.nivel, tier)); });
  } else {
    // el torneo "hogar" del jugador: la categoría donde su nivel está más parejo con la exigencia
    let best = TIERS[0], bestDiff = Infinity, bestIdx = 0;
    TIERS.forEach((t,i)=>{
      const diff = Math.abs(npc.nivel - TIER_TOUGHNESS[t.weight]);
      if(diff < bestDiff){ bestDiff = diff; best = t; bestIdx = i; }
    });
    const torneosJugados = 6 + Math.floor(Math.random()*3);
    for(let i=0;i<torneosJugados;i++){
      const tier = Math.random()<0.25 ? TIERS[Math.max(0,bestIdx-1)] : best;
      total += simRondaPorTorneo(npc.nivel, tier);
    }
  }
  return Math.max(0, Math.round(total));
}

// Freno al crecimiento de los NPCs cerca del techo. SUAVIZADO esta sesión: la versión anterior
// (arrancaba en 85, piso 0.12 pasado 92) resultó DEMASIADO dura combinada con la base más baja de
// makeNPC() — el usuario reportó que el nivel general del circuito (y el puntaje del ranking) había
// bajado más de la cuenta. Ahora el freno arranca más tarde (88 en vez de 85) y el tramo duro
// (pasado 92) es más permisivo — piso 0.18 en vez de 0.12, con una pendiente más suave. Sigue
// existiendo el freno (no queremos volver a la sobrepoblación de 90+/95+ de antes), pero deja
// crecer un poco más a los NPCs que ya están cerca del techo.
function npcGrowthFactor(nivel){
  if(nivel<=88) return 1;
  if(nivel<=92) return clamp(1 - (nivel-88)*0.09, 0.45, 1);
  return clamp(0.45 - (nivel-92)*0.028, 0.18, 0.45);
}
function simulateNPCSeason(npc){
  if(npc.retirado) return;
  npc.puntos = estimateNPCPoints(npc);
  npc.edad++;
  // Meseta extendida hasta los 34, declive suave entre 34-38, y recién fuerte pasados los 38
  // (antes: meseta hasta 31 y declive fuerte -2.2/año desde ahí) — sostiene más tiempo a los
  // jugadores de nivel alto en el circuito, en línea con la cantera reforzada de debutantes.
  let drift = npc.edad < 23 ? randNormal(1.6,2) : npc.edad < 27 ? randNormal(0.6,1.5) : npc.edad < 32 ? randNormal(0,1.5) : npc.edad < 36 ? randNormal(-0.8,1.8) : randNormal(-2.0,2);
  // El freno de npcGrowthFactor solo aplica al drift POSITIVO (mejora) — el declive por edad sigue
  // exactamente igual que antes, no hay motivo para suavizar la caída de un jugador viejo.
  if(drift>0) drift *= npcGrowthFactor(npc.nivel);
  npc.nivel = clamp(Math.round(npc.nivel + drift), 15, 99);
  if(npc.edad > 32){
    const retireChance = (npc.edad-32)*0.04 + (npc.nivel<40?0.12:0);
    if(Math.random() < retireChance) npc.retirado = true;
  }
}

function buildRankingList(player, pool){
  const active = pool.filter(p=>!p.retirado);
  const all = [...active, {id:"player", nombre: player.nombre+" (vos)", pais: player.pais, puntos: player.puntos, edad: player.edad, nivel: player.nivel, esJugador:true}];
  all.sort((a,b)=>b.puntos-a.puntos);
  const idx = all.findIndex(p=>p.esJugador);
  return { ranking: idx+1, total: all.length, list: all };
}

// Devuelve el detalle de los 3 mejores tenistas ACTIVOS de un país (nivel promedio Y sumatoria),
// para medir qué tan fuerte es ese equipo de cara a la Copa Davis. Si "player" corresponde a ese
// país, se lo incluye en la cuenta (compite en igualdad de condiciones junto a los NPCs).
function paisTop3Detalle(codigo, player){
  const niveles = G.pool.filter(x=>!x.retirado && x.pais===codigo).map(x=>x.nivel);
  if(player && player.pais===codigo) niveles.push(player.nivel);
  niveles.sort((a,b)=>b-a);
  const top3 = niveles.slice(0,3);
  const suma = top3.reduce((s,n)=>s+n,0);
  const avg = top3.length ? suma/top3.length : 45;
  return { top3, suma, avg };
}
function paisTop3NivelFull(codigo, player){
  return paisTop3Detalle(codigo, player).avg;
}

// Los 3 tenistas concretos (nombre + si es el jugador) que integran el equipo de Copa Davis de un
// país: SIEMPRE los 3 de mayor nivel, sin depender de puntos de ranking ni de ninguna otra condición.
function paisConvocadosTop3(codigo, player){
  const candidatos = G.pool.filter(x=>!x.retirado && x.pais===codigo).map(x=>({ id:x.id, nombre:x.nombre, nivel:x.nivel, esJugador:false }));
  if(player && player.pais===codigo) candidatos.push({ id:"player", nombre:player.nombre, nivel:player.nivel, esJugador:true });
  candidatos.sort((a,b)=>b.nivel-a.nivel);
  return candidatos.slice(0,3);
}

// Los 16 equipos que clasifican a la Copa Davis del año: los 8 países más fuertes (por nivel real)
// entran directo, y los otros 8 cupos se sortean al azar entre los países en los puestos 9º a 24º
// (16 candidatos para 8 lugares) — así el bracket sigue siendo de 16 equipos "de verdad", pero sin
// ser SIEMPRE los 16 más fuertes a rajatabla (eso hacía que todas las rondas, incluida la primera,
// fueran contra rivales durísimos, y los títulos se volvían demasiado raros). Devuelve los dos
// grupos POR SEPARADO (antes se devolvía todo mezclado en un Set) para que buildDavisCupBracket()
// pueda sembrar el cuadro: los 8 directos SIEMPRE quedan emparejados contra uno de estos 8 de
// sorteo en Octavos, nunca entre sí — ver el seeding ahí mismo.
function computeDavisTop16(player){
  const scored = COUNTRY_CODES.map(code => ({ code, nivel: paisTop3NivelFull(code, player) }));
  scored.sort((a,b)=>b.nivel-a.nivel);
  const top8 = scored.slice(0,8).map(s=>s.code);
  const candidatos9a24 = scored.slice(8,24).map(s=>s.code); // puestos 9º a 24º
  const otros8 = shuffle(candidatos9a24).slice(0,8);
  return { top8, otros8 };
}

// Ranking ordenado de todos los países (COUNTRY_CODES) por nivel real (promedio Y puntaje/sumatoria de sus 3 mejores
// tenistas activos), para la pantalla "Ranking de Selecciones". A diferencia de computeDavisTop16(),
// esta función NO sortea los 8 cupos aleatorios entre los puestos 9º-24º — devuelve el orden puro
// por nivel, así la pantalla es estable entre visitas (el sorteo real solo se resuelve en finishYear()).
function computeCountryLevelRanking(player){
  const scored = COUNTRY_CODES.map(code => {
    const d = paisTop3Detalle(code, player);
    return { code, nivel: d.avg, puntaje: Math.round(d.suma) };
  });
  scored.sort((a,b)=>b.nivel-a.nivel);
  return scored;
}

// Probabilidad de que el equipo A le gane la serie al equipo B en una ronda de Copa Davis.
// CAMBIO: antes dividía la diferencia de nivel por 38 y restaba 0.04 por ronda — con las
// diferencias de nivel típicas entre selecciones del top 16 (a menudo de un solo dígito), eso
// dejaba casi todas las series cerca de un 50/50 sin importar cuánto mejor fuera tu equipo. Ahora
// la diferencia de nivel pesa bastante más (÷25) y la penalización por ronda es más chica (0.015),
// así que ser una selección de verdad top del año se nota en el % real de series ganadas.
function davisMatchChance(levelA, levelB, roundIdx){
  return clamp(0.5 + (levelA-levelB)/25 - roundIdx*0.015, 0.15, 0.88);
}

// Genera un resultado de serie plausible (al mejor de 3 puntos, formato real de Copa Davis):
// 3-0 o 2-1 para el ganador. Cuanto más pareja fue la chance (cerca de 50/50), más probable que
// el resultado sea 2-1; cuanto más lejos del 50/50 (favorito claro), más probable el 3-0.
function davisSeriesScore(chanceA){
  const closeness = Math.abs(chanceA-0.5)*2; // 0 (muy parejo) .. 1 (favorito claro)
  const sweepChance = 0.3 + closeness*0.5;
  const sweep = Math.random() < sweepChance;
  return sweep ? { ganador:3, perdedor:0 } : { ganador:2, perdedor:1 };
}

// Arma el cuadro COMPLETO de la Copa Davis del año: 16 selecciones, resueltas ronda a ronda
// (Octavos → Cuartos → Semifinal → Final) hasta el campeón. Se simula todos los años, juegue el
// jugador o no, para poder mostrar el fixture completo en el resumen de temporada.
// SEEDING en Octavos (a pedido del usuario): los 8 países que clasificaron DIRECTO (los más
// fuertes) siempre quedan emparejados contra uno de los 8 que entraron por sorteo de los puestos
// 9º-24º — nunca dos de los 8 directos se cruzan en la primera ronda. A cuál de los 8 débiles le
// toca cada fuerte SÍ sigue siendo al azar (se sortea el orden de los 8 de sorteo y se empareja
// por posición). De Cuartos en adelante el avance sigue el mismo criterio de siempre (el ganador
// de cada cruce pasa a jugar contra el ganador del cruce siguiente en el orden del array, sin
// re-sembrar nada) — no se tocó nada de eso, solo la primera ronda.
function buildDavisCupBracket(player){
  const { top8, otros8 } = computeDavisTop16(player);
  const seeded = top8.map(code => ({ code, level: paisTop3NivelFull(code, player) }));
  const unseeded = shuffle(otros8).map(code => ({ code, level: paisTop3NivelFull(code, player) }));
  const teams = [];
  for(let i=0;i<8;i++){ teams.push(seeded[i], unseeded[i]); }
  const roundNames = ["Octavos de final","Cuartos de final","Semifinal","Final"];
  const rounds = [];
  let current = teams;
  for(let r=0; r<roundNames.length; r++){
    const matches = [];
    const next = [];
    for(let i=0; i<current.length; i+=2){
      const a = current[i], b = current[i+1];
      const chanceA = davisMatchChance(a.level, b.level, r);
      const aWins = Math.random() < chanceA;
      const winner = aWins ? a : b;
      const score = davisSeriesScore(chanceA);
      matches.push({ aCode:a.code, bCode:b.code, aLevel:a.level, bLevel:b.level, winner:winner.code, chanceA,
        scoreWinner: score.ganador, scoreLoser: score.perdedor });
      next.push(winner);
    }
    rounds.push({ name: roundNames[r], matches });
    current = next;
  }
  return { rounds, champion: current[0].code };
}

// Recorre un bracket ya resuelto y devuelve cómo le fue a un país puntual: cuántas rondas ganó,
// en qué ronda quedó eliminado (o null si fue campeón) y contra quién jugó cada cruce.
function findCountryDavisPath(bracket, code){
  let rondasGanadas = 0, eliminadoEnRonda = null;
  const rivales = [];
  for(let r=0; r<bracket.rounds.length; r++){
    const match = bracket.rounds[r].matches.find(m => m.aCode===code || m.bCode===code);
    if(!match) break;
    rivales.push(match.aCode===code ? match.bCode : match.aCode);
    if(match.winner===code){ rondasGanadas = r+1; }
    else { eliminadoEnRonda = r; break; }
  }
  return { rondasGanadas, eliminadoEnRonda, rivales };
}

function eligible(tier, player){
  return player.ranking <= tier.minRanking || player.nivel >= tier.minLevel || player.fama >= 82;
}

/* =========================================================
   CALENDARIO ANUAL
========================================================= */
function buildCalendar(strategy, player){
  const elig = TIERS.filter(t => eligible(t, player)).sort((a,b)=>b.weight-a.weight);
  if(elig.length===0) elig.push(TIER_BY_ID.m15);

  const calendario = [];
  const usedNames = {};
  function pickTierName(tier){
    usedNames[tier.id] = usedNames[tier.id] || new Set();
    const disponibles = tier.pool.filter(n=>!usedNames[tier.id].has(n));
    const nombre = disponibles.length ? disponibles[Math.floor(Math.random()*disponibles.length)] : tier.pool[Math.floor(Math.random()*tier.pool.length)];
    usedNames[tier.id].add(nombre);
    return nombre;
  }
  function capLeft(tier){
    const used = calendario.filter(c=>c.tierId===tier.id).length;
    return used < tier.cap;
  }

  // Elegimos el tier según qué tan competitivo es tu NIVEL contra la exigencia de cada categoría,
  // no según la lista de "elegibles" (que puede inflarse si tu ranking sube más rápido que tu nivel real).
  function toughnessOf(t){ return TIER_TOUGHNESS[t.weight]; }
  const eligOrdered = [...elig].sort((a,b)=>b.weight-a.weight); // de más difícil a más fácil
  function closestToGap(targetGap, list){
    list = list || eligOrdered;
    return list.reduce((best,t)=>
      Math.abs((player.nivel-toughnessOf(t))-targetGap) < Math.abs((player.nivel-toughnessOf(best))-targetGap) ? t : best
    , list[0]);
  }

  let topTarget;   // el tier más exigente donde todavía sos competitivo ("alto")
  let safeTarget;  // el tier donde estás claramente favorito, sin ser ridículamente fácil ("seguro")
  let balTarget;   // matchup parejo ("equilibrado")

  // "alto": el tier más difícil, entre los elegibles, donde no estás más de 6 puntos por debajo de la exigencia
  topTarget = eligOrdered.find(t => (player.nivel - toughnessOf(t)) >= -6) || eligOrdered[eligOrdered.length-1];
  // "equilibrado": el tier con el matchup más parejo posible (nivel - toughness lo más cercano a 0)
  balTarget = closestToGap(0);
  // "seguro": el tier donde tenés una ventaja cómoda (~12 puntos por encima de la exigencia), buscado
  // SOLO entre categorías más fáciles que "equilibrado" (nunca la misma ni una más difícil). BUG
  // CORREGIDO: antes se buscaba entre TODAS las categorías elegibles sin esta restricción, y con
  // nivel muy alto (~93+) la cuenta de "gap más cercano a 12" terminaba dando Grand Slam/Masters
  // 1000 igual que "alto" — el gap de GS también crece con el nivel del jugador, así que en algún
  // punto quedaba más cerca de 12 que cualquier categoría menor, aunque en términos absolutos siga
  // siendo la categoría más difícil que existe. Resultado: "jugar seguro" terminaba siendo un
  // calendario tan duro como "apuntar lo más alto posible" (4 GS + 4 M1000 en ambos), sin ninguna
  // diferencia real entre las 3 estrategias — justo en el tramo de nivel alto del juego.
  const safeCandidates = eligOrdered.filter(t => t.weight < balTarget.weight);
  safeTarget = safeCandidates.length
    ? closestToGap(12, safeCandidates)
    : eligOrdered[eligOrdered.length-1]; // no hay nada más fácil que "equilibrado" (nivel muy bajo): usamos la categoría más floja disponible

  // Para que un año no mezcle Grand Slams con ITF juveniles: el torneo más flojo del año
  // no puede estar a más de 3 categorías de distancia del más exigente que se planea jugar ese año.
  const topWeightThisYear = Math.max(topTarget.weight, balTarget.weight, safeTarget.weight, strategy==="alto"?topTarget.weight:0);
  const floorWeight = Math.max(1, (strategy==="alto"?topTarget.weight:strategy==="equilibrado"?balTarget.weight:safeTarget.weight) - 3);
  function clampFloor(t){
    if(t.weight >= floorWeight) return t;
    // subimos de categoría hasta cumplir el piso de este año
    return TIERS.slice().sort((a,b)=>a.weight-b.weight).find(x=>x.weight>=floorWeight) || t;
  }

  for(let i=0;i<8;i++){
    let tier;
    if(strategy==="equilibrado"){
      // Escalera gradual: mayormente el matchup parejo, con un par de torneos un escalón más
      // accesibles y uno dos escalones más accesible — en vez de saltar directo a "seguro"
      // (que podía quedar 2-3 categorías más abajo sin nada intermedio). Como efecto colateral
      // bueno: cuando el nivel es tan alto que "parejo" y "el techo" coinciden en Grand Slam,
      // el tope de cupo de Slams (4) hace que el resto baje un escalón solo, distinguiéndose
      // de "alto" (4 GS + 4 M1000) de forma natural, sin lógica especial.
      const balIdx = TIERS.findIndex(t=>t.id===balTarget.id);
      const oneBelow = TIERS[Math.min(TIERS.length-1, balIdx+1)];
      const twoBelow = TIERS[Math.min(TIERS.length-1, balIdx+2)];
      tier = (i===7) ? twoBelow : (i===3||i===6) ? oneBelow : balTarget;
    } else if(strategy==="alto"){
      tier = (i===2||i===5||i===7) ? balTarget : topTarget; // mayormente el techo, con algún respiro
    } else {
      // "seguro": mayormente el escalón seguro para las 8 fechas, salvo el último torneo del año,
      // que SIEMPRE baja un escalón más — y el anteúltimo, que baja también con 45% de chance (a
      // pedido del usuario: jugando seguro con niveles bajos, donde el escalón "seguro" ya cae en
      // ITF M25, el ITF M15 no aparecía NUNCA en el calendario). Así, en ese tramo de nivel bajo,
      // el año trae como mínimo 1 ITF M15 (a veces 2), sin que sea la norma. Con niveles más altos,
      // donde "seguro" ya es una categoría grande (Challenger para arriba), este cambio no se nota
      // en la práctica: clampFloor() más abajo puede volver a subir el torneo si el año quedaría
      // demasiado disparejo.
      const safeIdx = TIERS.findIndex(t=>t.id===safeTarget.id);
      const oneBelowSafe = TIERS[Math.min(TIERS.length-1, safeIdx+1)];
      tier = (i===7) ? oneBelowSafe : (i===6 && Math.random()<0.45) ? oneBelowSafe : safeTarget;
    }
    tier = clampFloor(tier);
    // bajar de categoría si se acabó el cupo real de ese torneo
    let safety = 0;
    while(!capLeft(tier) && safety < TIERS.length){
      const pos = TIERS.findIndex(t=>t.id===tier.id);
      tier = TIERS[Math.min(TIERS.length-1,pos+1)];
      safety++;
    }
    calendario.push({ tierId: tier.id, tier, nombre: pickTierName(tier) });
  }

  // Si jugás "a lo más alto" y tenés nivel de sobra para pelear la clasificación, garantizamos
  // al menos un intento de Grand Slam en el año — en la realidad, jugadores de ranking bajo
  // igual entran por qualy y tienen (poca) chance de dar la sorpresa.
  if(strategy==="alto" && player.nivel>=65 && !calendario.some(c=>c.tierId==="gs")){
    calendario[calendario.length-1] = { tierId:"gs", tier:TIER_BY_ID.gs, nombre: pickTierName(TIER_BY_ID.gs) };
  }

  // GARANTÍA "Dueño de los Masters" (a pedido del usuario): si el calendario de este año trae 4 o
  // más Masters 1000, forzamos que al menos uno sea de una sede donde el jugador TODAVÍA no ganó
  // título — así avanzar hacia ganar los 9 Masters 1000 de la carrera no depende 100% de que el
  // sorteo de pickTierName() te toque justo una sede pendiente. Si ya ganaste TODAS las sedes
  // (o si ya había alguna pendiente entre las elegidas de por sí), no hace falta forzar nada.
  const m1000EnAnio = calendario.filter(c=>c.tierId==='m1000');
  if(m1000EnAnio.length>=4){
    const m1000Ganados = player.m1000Ganados || {};
    const yaHayPendiente = m1000EnAnio.some(c=>!m1000Ganados[c.nombre]);
    if(!yaHayPendiente){
      const usadasEsteAnio = new Set(m1000EnAnio.map(c=>c.nombre));
      const pendientes = TIER_BY_ID.m1000.pool.filter(n=>!m1000Ganados[n] && !usadasEsteAnio.has(n));
      if(pendientes.length){
        const nombreForzado = pendientes[Math.floor(Math.random()*pendientes.length)];
        const idxAPisar = calendario.findIndex(c=>c.tierId==='m1000');
        calendario[idxAPisar] = { tierId:'m1000', tier:TIER_BY_ID.m1000, nombre: nombreForzado };
      }
    }
  }

  return calendario;
}

/* =========================================================
   RESOLUCIÓN DE TORNEOS
========================================================= */
// Nivel de exigencia típico del campo de jugadores en cada categoría
const TIER_TOUGHNESS = {8:84, 7:78, 6:70, 5:62, 4:54, 3:47, 2:38, 1:29};
// Exigencia específica para VOS (el jugador), a pedido tuyo: 1 punto menos que TIER_TOUGHNESS en
// Grand Slam (84→83) y Masters 1000 (78→77), para subir un poco la chance de ganar esas dos
// categorías. IMPORTANTE: esta constante SOLO se usa en chanceForRound() (más abajo), que es la
// función que resuelve TUS partidos. Los NPCs (simRondaPorTorneo / simRondaGSConCupo, más abajo en
// este mismo archivo) siguen usando TIER_TOUGHNESS sin tocar, así que sus rivales no se ablandaron
// en nada — tampoco buildCalendar() ni pickPlausibleRival(), que también usan TIER_TOUGHNESS
// original (solo afectan a elegir categoría de torneo / nombrar un rival, no a ganar o perder).
const PLAYER_TIER_TOUGHNESS = { ...TIER_TOUGHNESS, 8:83, 7:77 };
function chanceForRound(player, tier, roundIdx){
  const toughness = PLAYER_TIER_TOUGHNESS[tier.weight];
  const base = 0.5 + (player.nivel - toughness)/38;
  const fisicoFactor = (player.fisico-50)/150;
  const roundPenalty = roundIdx*0.016;
  // Contra el "cayó en 1ra ronda con 98 de nivel": el techo de probabilidad por ronda era el mismo
  // 0.85 para cualquier nivel, así que con nivel muy alto (90+) y buen físico la chance quedaba
  // pegada a ese techo desde la primera ronda — perder en 1R/2R le pasaba igual de seguido a
  // alguien con 90 que a alguien con 99 de nivel. A pedido del usuario: un techo apenas más alto
  // (0.90 en vez de 0.85), SOLO en 1ra/2da ronda de Grand Slam y SOLO con nivel 90+ — no toca
  // semifinales/final ni ninguna otra categoría de torneo. Validado con simulación: para nivel
  // 96/físico 90, la chance de caer en 1ra ronda bajó de ~15% a ~9%, sin volverse un paseo (la
  // chance de ser campeón subió solo de ~28% a ~29%, la mayoría del efecto se nota en achicar las
  // caídas tempranas, no en inflar el título).
  const capMax = (tier.weight===8 && roundIdx<=1 && player.nivel>=90) ? 0.90 : 0.85;
  return clamp(base + fisicoFactor - roundPenalty, 0.05, capMax);
}

// Simula un torneo. Si llega a semifinal (ronda = length-2 superada) y aún no se usó
// la decisión interactiva del año, devuelve {pending:true,...} para resolver la final a mano.
function simulateTournament(player, entry, interactiveAvailable){
  const tier = entry.tier;
  const totalRounds = tier.points.length;
  let ronda = 0;
  while(ronda < totalRounds){
    const esFinal = (ronda === totalRounds-1);
    if(esFinal && interactiveAvailable){
      return { pending:true, entry, roundsWon: ronda, tier };
    }
    const chance = chanceForRound(player, tier, ronda);
    const nutriLevel = (player.itemLevels && player.itemLevels.nutri) || 0;
    const nutriDiscount = 1 - shopCumulativeEffect(0.5, 10, nutriLevel);
    player.fisico = clamp(player.fisico - tier.fisicoCost*0.32*nutriDiscount);
    if(Math.random() < chance){ ronda++; } else { break; }
  }
  return finalizeTournamentResult(player, entry, ronda);
}

// Gasto de gira/equipo por categoría — proporcional a lo que se puede ganar en cada una,
// para que jugar un M15/M25/Challenger no te deje en números rojos.
const GASTO_GIRA = {gs:3000, m1000:1000, atp500:400, atp250:140, ch175:50, ch125:30, m25:8, m15:3};

function finalizeTournamentResult(player, entry, ronda, forcedRival){
  unlockAchievement(player, 'jugador_profesional'); // se llama siempre que se juega (y resuelve) un torneo, sea cual sea el resultado
  const rachaPrevia = player.torneosSinGanarRonda || 0; // racha de primeras rondas ANTES de resolver este torneo (para el logro Remontada)
  const tier = entry.tier;
  let puntos=0, premio=0;
  if(ronda>0){ puntos = tier.points[ronda-1]; premio = tier.prize[ronda-1]; }
  const gastoGira = GASTO_GIRA[tier.id] || 0;
  player.puntos += puntos;
  player.dinero = Math.max(0, player.dinero + premio - gastoGira);
  if(premio>0){
    player.dineroTotalGanado = (player.dineroTotalGanado||0) + premio;
    checkMoneyAchievements(player);
  }
  if(ronda===0){
    player.fama = clamp(player.fama - tier.weight*0.5, 0, 100); // caer en primera ronda de un torneo grande te cuesta algo de fama
    player.torneosSinGanarRonda = rachaPrevia + 1;
  } else {
    player.fama = clamp(player.fama + ronda*0.6*(tier.weight/5), 0, 100);
    player.torneosSinGanarRonda = 0;
  }
  const campeon = ronda === tier.points.length;
  // Registro para la pantalla "Torneos disputados". GS/M1000/ATP500/ATP250 se guardan cada uno
  // bajo su propio id de categoría; Challenger 175+125 se fusionan bajo 'challenger' y M25+M15 bajo
  // 'itf' (esa pantalla no distingue la subcategoría, solo la sede — ver renderTorneosDisputados).
  const categoriaTD = (tier.id==='ch175'||tier.id==='ch125') ? 'challenger' : (tier.id==='m25'||tier.id==='m15') ? 'itf' : tier.id;
  if(['gs','m1000','atp500','atp250','challenger','itf'].includes(categoriaTD)){
    registrarTorneoAnio(player, player.edad, categoriaTD, entry.nombre, roundCodeAbbrev(ronda, tier.points.length, campeon));
  }
  if(campeon){
    if(rachaPrevia >= 4) unlockAchievement(player, 'remontada');
    player.titulos++;
    unlockAchievement(player, 'primer_titulo');
    checkTitleCountAchievements(player);
    checkAgeTitleAchievements(player, player.edad);
    player.categoriasTitulo = player.categoriasTitulo || {};
    player.categoriasTitulo[tier.id] = true;
    if(COLECCION_COMPLETA_TIER_IDS.every(id=>player.categoriasTitulo[id])) unlockAchievement(player, 'coleccion_completa');
    // Registro de títulos ganados por combinación categoría+sede (torneo+ciudad), para el logro
    // dinámico "Rey de <ciudad>": se desbloquea la primera vez que se llega a 5 títulos en la
    // MISMA sede de la MISMA categoría (ej. 5 veces el Masters 1000 de Shanghái, o 5 veces el
    // Challenger 175 de Bendigo). La dificultad del logro escala con el peso de la categoría en
    // vez de ser fija para todas las sedes (una categoría chica es más fácil de repetir 5 veces).
    player.titulosPorSede = player.titulosPorSede || {};
    const sedeKey = tier.id + '::' + entry.nombre;
    player.titulosPorSede[sedeKey] = (player.titulosPorSede[sedeKey]||0) + 1;
    if(player.titulosPorSede[sedeKey] === 4){
      const dynTier = tier.weight>=7 ? 3 : tier.weight>=4 ? 2 : 1;
      unlockDynamicAchievement(player, 'rey_'+sedeKey.replace(/[^a-zA-Z0-9]+/g,'_'), {
        icon:'🤴', name:`Rey de ${entry.nombre}`,
        desc:`Ganaste el título de ${tier.name} en ${entry.nombre} 4 veces a lo largo de tu carrera.`,
        tier: dynTier
      });
    }
    if(tier.id==='m1000'){
      unlockAchievement(player, 'ganar_m1000');
      checkBigFour(player);
      player.m1000Ganados = player.m1000Ganados || {};
      player.m1000Ganados[entry.nombre] = true;
      if(TIER_BY_ID.m1000.pool.every(nombre=>player.m1000Ganados[nombre])) unlockAchievement(player, 'ganar_m1000_todos');
    }
    if(tier.id==='gs'){
      unlockAchievement(player, 'ganar_gs');
      if(!player.etiquetaInicio) unlockAchievement(player, 'cenicienta'); // arrancó "normal", sin ninguna etiqueta especial
      player.gsGanados = player.gsGanados || {};
      player.gsGanados[entry.nombre] = true;
      if(TIER_BY_ID.gs.pool.every(nombre=>player.gsGanados[nombre])) unlockAchievement(player, 'golden_slam_carrera');
      checkBigFour(player);
      checkSuperSlam(player);
      checkSuperCareerSlam(player);
    }
  }
  if(ronda === tier.points.length-1 || campeon){
    player.finales += campeon?0:1;
    unlockAchievement(player, 'primera_final');
  }
  const totalR = tier.points.length;
  function roundLabel(r){
    const distFromFinal = totalR - (r+1);
    if(distFromFinal===0) return "la Final";
    if(distFromFinal===1) return "Semifinales";
    if(distFromFinal===2) return "Cuartos de final";
    if(distFromFinal===3) return "Octavos de final";
    return `la Ronda ${r+1}`;
  }
  let etiqueta;
  if(campeon) etiqueta = "🏆 Campeón";
  else if(ronda===0) etiqueta = "Cayó en primera ronda";
  else etiqueta = "Eliminado en " + roundLabel(ronda);

  // en las finales (ganadas o perdidas) nombramos a un rival plausible del circuito — en Grand
  // Slam, este rival sale de un sorteo restringido a candidatos que realmente podrían haber
  // ganado el torneo (pickGrandSlamRival), no de cualquier NPC de nivel parecido (para el resto
  // de las categorías se sigue usando pickPlausibleRival, sin cambios).
  let rivalUsado = null;
  if(campeon || ronda === totalR-1){
    rivalUsado = forcedRival || (tier.id==='gs' ? pickGrandSlamRival() : pickPlausibleRival(TIER_TOUGHNESS[tier.weight]));
    if(rivalUsado){
      etiqueta += campeon
        ? ` (le ganaste la final a ${rivalUsado.nombre}, ${flagImg(rivalUsado.pais,12)})`
        : ` (perdiste ante ${rivalUsado.nombre}, ${flagImg(rivalUsado.pais,12)})`;
    }
  }
  // Si perdiste la final de un Grand Slam, el rival que te ganó QUEDA RESERVADO como campeón
  // oficial de esa sede para el historial (ver assignGrandSlamChampions) — nunca puede haber
  // contradicción entre "perdiste contra Fulano" y "el campeón de esta sede fue Mengano".
  if(!campeon && ronda === totalR-1 && tier.id==='gs' && rivalUsado){
    yearState.gsFinalLosses = yearState.gsFinalLosses || {};
    yearState.gsFinalLosses[entry.nombre] = rivalUsado;
  }
  if(campeon){
    player.titulosList = player.titulosList || [];
    player.titulosList.push({ edad: player.edad, tier: tier.name, tierWeight: tier.weight, sede: entry.nombre, rivalNombre: rivalUsado?rivalUsado.nombre:null, rivalPais: rivalUsado?rivalUsado.pais:null });
  }
  return { entry, ronda, puntos, premio, campeon, etiqueta, tierWeight: tier.weight };
}

function pickPlausibleRival(nivelObjetivo){
  const candidatos = G.pool.filter(x=>!x.retirado && Math.abs(x.nivel-nivelObjetivo)<12);
  const pool = candidatos.length ? candidatos : G.pool.filter(x=>!x.retirado);
  if(!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

// Sortea un rival PLAUSIBLE específicamente para una final de GRAND SLAM — a diferencia de
// pickPlausibleRival (que solo mira nivel parecido, usado para el resto de las categorías), acá
// el candidato tiene que ser alguien que REALMENTE podría haber ganado el torneo: mismo criterio
// de elegibilidad que usa assignGrandSlamChampions() para repartir las sedes vacantes (+2000
// puntos, ponderado fuerte por puntos^2.2 y nivel^1.6, favoreciendo casi siempre a los
// "estrella"). Esto es a propósito: si el jugador termina perdiendo la final contra este rival,
// esa misma persona pasa a ser el campeón oficial de la sede en el historial (ver
// yearState.gsFinalLosses en finalizeTournamentResult y assignGrandSlamChampions) — así el rival
// que aparece en pantalla SIEMPRE es alguien coherente con quien figura después como campeón real,
// nunca un NPC cualquiera al que se le "regalan" puntos sin sentido.
function pickGrandSlamRival(){
  const campeonPts = TIER_BY_ID.gs.points[TIER_BY_ID.gs.points.length-1];
  let elegibles = G.pool.filter(x=>!x.retirado && x.puntos>=campeonPts);
  if(!elegibles.length) elegibles = G.pool.filter(x=>!x.retirado && x.nivel>=76); // fallback: al menos nivel de "estrella"
  if(!elegibles.length) elegibles = G.pool.filter(x=>!x.retirado);
  if(!elegibles.length) return null;
  const pesos = elegibles.map(c=>Math.pow(c.puntos+1,2.2)*Math.pow(c.nivel,1.6));
  const totalPeso = pesos.reduce((a,b)=>a+b,0);
  let roll = Math.random()*totalPeso;
  for(let i=0;i<elegibles.length;i++){
    roll -= pesos[i];
    if(roll<=0) return elegibles[i];
  }
  return elegibles[elegibles.length-1];
}

/* =========================================================
   TARJETAS DE EVENTO ANUAL (entrenamiento / descanso / etc)
========================================================= */
function buildEventPool(player){
  const events = [
    { tag:"Imprevisto", title:"Molestia física en pretemporada", text:"Sentís una sobrecarga muscular. El cuerpo médico te da dos caminos.",
      choices:[
        {label:"Parar y tratarte a fondo", sub:"Físico +18, Nivel general -1", resolve:p=>{p.fisico=clamp(p.fisico+18,0,p.fisicoMax);["saque","potencia","movilidad","tecnica","mental"].forEach(k=>p[k]=clamp(p[k]-1));return{text:"Te cuidás. Vas a arrancar el año algo atrasado en ritmo, pero sano.",tone:"good"};}},
        {label:"Jugar igual, con precaución", sub:"riesgo real de lesión más seria", resolve:p=>{
            // Riesgo bajado ~15% (0.25→0.21) a pedido del usuario, sesión de "menos frustrante" —
            // mismo criterio aplicado a los otros dos puntos donde se calcula riesgo de lesión
            // (STAT_TRAINING_OPTIONS y checkMidSeasonInjuryThenPlay). No es un cambio grande, solo
            // afloja un poco la frecuencia general de lesiones en las tres fuentes.
            if(Math.random()<0.21*(1-fisioInjuryReduction(p))*highFisicoProtection(p.fisico)){
              p.fisico=clamp(p.fisico-22,0,p.fisicoMax);
              if(yearState) yearState.hadInjury = true;
              if(Math.random()<0.4){
                return{text:"La molestia se agravó. Vas a arrancar la temporada con el físico bastante resentido, pero nada más grave que eso.",tone:"bad"};
              }
              const severidad = Math.random();
              const jugados = severidad<0.55 ? 6+Math.floor(Math.random()*2) : severidad<0.85 ? 4+Math.floor(Math.random()*2) : 2+Math.floor(Math.random()*2);
              if(yearState && yearState.calendario.length>jugados){
                yearState.calendario = yearState.calendario.slice(0, jugados);
                yearState.injuryNote = `La molestia te complicó el arranque de temporada: jugaste ${jugados} de 8 torneos previstos.`;
                return{text:"La molestia se agravó en pleno partido y tuviste que bajarte de parte de la temporada.",tone:"bad"};
              }
              return{text:"La molestia se agravó. Vas a arrancar la temporada con el físico bastante resentido.",tone:"bad"};
            }
            if(yearState) yearState.cuidadoExtraPretemporada = true;
            return{text:"Por suerte, esta vez no pasó a mayores. Igual vas a arrancar la temporada con más cuidado que de costumbre.",tone:"neutral"};
        }},
      ]},
    { tag:"Fuera de la cancha", title:"Contrato con una marca de indumentaria", text:"Te ofrecen ropa y calzado gratis a cambio de usar su marca en cámara, sin gran pago de por medio.",
      choices:[
        {label:"Aceptar", sub:"Fama +4", resolve:p=>{p.fama=clamp(p.fama+4);return{text:"Nada del otro mundo, pero suma visibilidad.",tone:"neutral"};}},
        {label:"Rechazar y seguir con tu equipo de siempre", sub:"Mental +1", resolve:p=>{p.mental=clamp(p.mental+1);return{text:"Preferís no distraerte con compromisos comerciales chicos.",tone:"neutral"};}},
      ]},
    // Costo subido un 10% (1500+(edad-15)*900 → 1650+(edad-15)*990) y beneficio reducido
    // (Físico +10→+6, Potencia +4→+3) a pedido del usuario: quedaba muy barato para lo que daba.
    { tag:"Entorno", title:"Cambio de entrenador", text:"Te ofrecen sumar a un preparador físico de renombre al equipo, pero cuesta dinero mantenerlo durante el año.",
      choices:[
        {label:p=>`Contratarlo (${fmt(1650+(p.edad-15)*990)})`, sub:"Físico +6, Potencia +3", cost:p=>1650+(p.edad-15)*990, resolve:p=>{
            const costo = 1650+(p.edad-15)*990;
            p.dinero-=costo;p.fisico=clamp(p.fisico+6,0,p.fisicoMax);p.potencia=clamp(p.potencia+3);return{text:"Se nota la diferencia en cada sesión. Inversión que rinde.",tone:"good"};
        }},
        {label:"Seguir solo por ahora", sub:"Mental +2", resolve:p=>{p.mental=clamp(p.mental+2);return{text:"Preferís no gastar todavía. Te hacés más autosuficiente.",tone:"neutral"};}},
      ]},
  ];
  // Evento condicional (a pedido del usuario): invitación a un partido de exhibición. Solo se
  // ofrece a carreras ya consolidadas (nivel Y fama altos) — se filtra ACÁ, al construir el pool,
  // en vez de agregar una condición de elegibilidad dentro de renderEventCard() (que no conoce el
  // contenido de cada carta, solo hace shift() sobre la cola). Como el pool se reconstruye recién
  // cuando se vacía la cola (no todos los años), la condición se vuelve a evaluar en cada
  // reconstrucción, no en cada año — aproximación razonable, mismo criterio simple que el resto
  // de este pool (que ya es estático). `player` es opcional: si no se pasa (no debería pasar en la
  // práctica, ver call sites), el evento simplemente no se ofrece ese ciclo.
  if(player && player.nivel>=75 && player.fama>=75){
    events.push({ tag:"Fuera de la cancha", title:"Invitación a un partido de exhibición",
      text:"Fuiste invitado a un partido de exhibición previo al comienzo de un Grand Slam.",
      choices:[
        {label:"Aceptar", sub:p=>`Fama +15, Dinero +${fmt(Math.round((p.dineroTotalGanado||0)*0.08/10000)*10000)}, Físico -10 · riesgo leve de lesión`, resolve:p=>{
            const monto = Math.round((p.dineroTotalGanado||0)*0.08/10000)*10000;
            p.fama = clamp(p.fama+15);
            p.dinero += monto; p.dineroTotalGanado = (p.dineroTotalGanado||0) + monto;
            checkMoneyAchievements(p);
            p.fisico = clamp(p.fisico-10, 0, p.fisicoMax);
            // Riesgo LEVE (5%, antes de aplicarle los mismos factores de fisioterapeuta/físico alto
            // que el resto de los eventos con riesgo de lesión) de que el partido de exhibición
            // termine costando un poco más caro de lo esperado — un golpe extra de físico, sin
            // llegar a recortar el calendario (es "leve" a propósito, no un evento de lesión grande
            // como los de pretemporada/mitad de temporada).
            if(Math.random()<0.05*(1-fisioInjuryReduction(p))*highFisicoProtection(p.fisico)){
              p.fisico = clamp(p.fisico-15, 0, p.fisicoMax);
              if(yearState) yearState.hadInjury = true;
              return{text:`Jugás la exhibición, sumás fama y cobrás ${fmt(monto)}, pero te llevás una molestia física que te va a complicar un poco el arranque de temporada.`, tone:"bad"};
            }
            return{text:`Jugás una linda exhibición ante buen público. Sumás fama y cobrás ${fmt(monto)}.`, tone:"good"};
        }},
        {label:"Rechazar la invitación", sub:"Fama -2", resolve:p=>{p.fama=clamp(p.fama-2);return{text:"Preferís no sumar un compromiso extra al calendario. Los organizadores se lo toman a mal.",tone:"neutral"};}},
      ]});
  }
  return events;
}

/* =========================================================
   RENDER: helpers de layout
========================================================= */
const root = document.getElementById('root');
function setScreen(html){ root.innerHTML = html; }

function trendArrow(curr, prev){
  if(prev===undefined || prev===null) return '';
  if(curr>prev) return ' <span style="color:#4ADE80;font-size:11px;">▲</span>';
  if(curr<prev) return ' <span style="color:#F87171;font-size:11px;">▼</span>';
  return ' <span style="color:#7DD3FC;font-size:11px;">▬</span>';
}

function scoreboardHtml(p, prev){
  prev = prev || p.prevSnapshot || null;
  return `<div class="scoreboard">
    <div class="tile"><span class="label">Nivel</span><span class="value">${p.nivel}${prev?trendArrow(p.nivel,prev.nivel):''}</span></div>
    <div class="tile"><span class="label">Físico</span><span class="value" style="font-size:15px">${Math.round(p.fisico)}/${p.fisicoMax}</span></div>
    <div class="tile"><span class="label">Fama</span><span class="value">${Math.round(p.fama)}${prev?trendArrow(Math.round(p.fama),Math.round(prev.fama)):''}</span></div>
    <div class="tile"><span class="label">💰 Dinero</span><span class="value" style="font-size:13px">${fmt(p.dinero)}</span></div>
  </div>
  <div class="subrow">
    <div class="subchip">Saque<br><b>${p.saque}</b>${prev?trendArrow(p.saque,prev.saque):''}</div>
    <div class="subchip">Potencia<br><b>${p.potencia}</b>${prev?trendArrow(p.potencia,prev.potencia):''}</div>
    <div class="subchip">Movilidad<br><b>${p.movilidad}</b>${prev?trendArrow(p.movilidad,prev.movilidad):''}</div>
    <div class="subchip">Técnica<br><b>${p.tecnica}</b>${prev?trendArrow(p.tecnica,prev.tecnica):''}</div>
    <div class="subchip">Mental<br><b>${p.mental}</b>${prev?trendArrow(p.mental,prev.mental):''}</div>
  </div>`;
}

function snapshotStats(p){
  return { nivel:p.nivel, fama:p.fama, saque:p.saque, potencia:p.potencia, movilidad:p.movilidad, tecnica:p.tecnica, mental:p.mental };
}

/* =========================================================
   PANTALLA: INTRO / CREACIÓN DE PERSONAJE
========================================================= */
function renderIntro(){
  const flagsHtml = [...COUNTRY_CODES].sort((a,b)=>COUNTRY_NAMES[a].localeCompare(COUNTRY_NAMES[b],'es')).map(code => `
    <button class="flag-opt ${G.selectedCountry===code?'selected':''}" data-country="${code}">
      ${flagImg(code,26)}<small>${COUNTRY_NAMES[code]}</small>
    </button>`).join('');
  setScreen(`
    <div class="card">
      <span class="tag">Creación de personaje</span>
      <h2>Arrancá tu carrera</h2>
      <p>Tenés 15 años y todo el circuito ATP por delante. Elegí tu nombre y país, y empezá a jugar.</p>
      <input type="text" class="nameinput" id="nameInput" placeholder="Tu nombre de jugador/a" maxlength="24" value="${(G.tempName||'').replace(/"/g,'&quot;')}">
      <h3>Nacionalidad</h3>
      <div class="flags-grid" id="flagsGrid">${flagsHtml}</div>
      <div class="checkrow">
        <input type="checkbox" id="minijuegosCheck" ${G.tempMinijuegos?'checked':''}>
        <label for="minijuegosCheck">Jugar con mini-juegos
          <small>Tildá esta opción si querés definir algunos torneos con mini-juegos.</small>
        </label>
      </div>
      <div class="checkrow">
        <input type="checkbox" id="nightModeCheck" ${G.tempNightMode?'checked':''}>
        <label for="nightModeCheck">🌙 Modo nocturno
          <small>Colores más suaves para jugar de noche o con poca luz.</small>
        </label>
      </div>
      <button class="primary" id="startBtn">Empezar carrera</button>
    </div>
  `);
  document.getElementById('nameInput').addEventListener('input', (e)=>{ G.tempName = e.target.value; });
  document.getElementById('minijuegosCheck').addEventListener('change', (e)=>{ G.tempMinijuegos = e.target.checked; });
  document.getElementById('nightModeCheck').addEventListener('change', (e)=>{
    G.tempNightMode = e.target.checked;
    document.body.classList.toggle('night-mode', G.tempNightMode);
  });
  document.querySelectorAll('.flag-opt').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      G.tempName = document.getElementById('nameInput').value;
      G.selectedCountry = btn.dataset.country;
      renderIntro();
    });
  });
  document.getElementById('startBtn').addEventListener('click', ()=>{
    if(G.player && G.screen!=="intro"){ return; } // ya hay una carrera en curso, ignoramos un click fantasma
    const name = document.getElementById('nameInput').value.trim();
    if(name.length < 3){ alert("Ingresá un nombre de al menos 3 letras para tu jugador."); return; }
    if(!G.selectedCountry){ alert("Elegí una nacionalidad para tu jugador."); return; }
    G.minijuegosOn = !!G.tempMinijuegos;
    G.nightMode = !!G.tempNightMode;
    document.body.classList.toggle('night-mode', G.nightMode);
    resetUsedFullNames();
    // Reseteamos el país recordado de "Ranking de Selecciones > Jugadores por país": es una
    // variable de módulo que sobrevive a G (no se recrea con la carrera), así que sin este reset
    // una carrera nueva heredaba el último país consultado en la carrera anterior en vez de
    // arrancar mostrando el país del jugador nuevo.
    countryRankPlayersCountry = null;
    G.player = newPlayer(name, G.selectedCountry);
    G.pool = genPool(CIRCUIT_POOL_SIZE);
    G.yearEvents = shuffle(buildEventPool(G.player));
    const rk = buildRankingList(G.player, G.pool);
    G.player.ranking = rk.ranking;
    G.screen = "hub";
    renderHub();
  });
}
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

/* =========================================================
   PANTALLA: HUB ANUAL
========================================================= */
function renderHub(){
  const p = G.player;
  const mejorRankingTxt = p.bestRanking && p.bestRanking < p.ranking ? ` (mejor: #${p.bestRanking})` : '';
  const badgeInicio = p.etiquetaInicio==='maestro'?'👑 Maestro del tenis':p.etiquetaInicio==='prodigio'?'🌟 Prodigio':p.etiquetaInicio==='promesa'?'✨ Promesa':p.etiquetaInicio==='destacado'?'📈 Destacado':'';
  setScreen(`
    <div class="card fade-screen">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="tag">${flagImg(p.pais,18)} ${p.nombre} · ${p.edad} años</span>
        ${badgeInicio?`<span class="tag" style="font-weight:700;">${badgeInicio}</span>`:''}
      </div>
      <h2>Temporada ${p.edad - 14}</h2>
      ${scoreboardHtml(p)}
      <p class="small">Ranking ATP: <b style="color:var(--purple-dark)">#${p.ranking}</b>${mejorRankingTxt} · Títulos: ${p.titulos} · Finales: ${p.finales}${p.sponsors.length?` · Sponsors: ${p.sponsors.map(s=>s.brand.name).join(', ')}`:''}</p>
      <div class="toprow">
        <button class="linkbtn" id="rankBtn">Ver ranking ATP</button>
        <button class="linkbtn" id="shopBtn">🛒 Tienda</button>
        <button class="linkbtn" id="histBtn">Historial</button>
      </div>
      <h3>¿Qué calendario buscás este año?</h3>
      <div class="choices">
        <button class="choice" data-strat="alto">Apuntar lo más alto posible<small>Más premios y puntos si te va bien, pero más riesgo de perder físico y caer rápido.</small></button>
        <button class="choice" data-strat="equilibrado">Calendario equilibrado<small>Mezclás torneos grandes con otros más accesibles.</small></button>
        <button class="choice" data-strat="seguro">Jugar seguro<small>Menos premio y fama, pero más chances de ganar y progresar de a poco.</small></button>
      </div>
      <button class="primary ghost" id="retireHubBtn" style="margin-top:14px;border-color:var(--alert);color:var(--alert);">Retirarme de la carrera</button>
      <div style="text-align:center;margin-top:18px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <button class="tourinfo-launch" id="tourInfoBtn">📖 Información de torneos</button>
        <button class="tourinfo-launch" id="countryRankBtn">🌍 Ranking de Selecciones</button>
        <button class="tourinfo-launch" id="logrosBtn">🏅 Logros</button>
        <button class="tourinfo-launch" id="reglamentoBtn">📜 Reglamento</button>
      </div>
    </div>
  `);
  document.getElementById('rankBtn').addEventListener('click', ()=>renderRanking('hub'));
  document.getElementById('shopBtn').addEventListener('click', ()=>renderShop());
  document.getElementById('histBtn').addEventListener('click', ()=>renderTitulos());
  document.getElementById('retireHubBtn').addEventListener('click', ()=>renderConfirmRetiro());
  document.getElementById('tourInfoBtn').addEventListener('click', ()=>renderTournamentInfo());
  document.getElementById('countryRankBtn').addEventListener('click', ()=>renderCountryRanking());
  document.getElementById('logrosBtn').addEventListener('click', ()=>renderLogros());
  document.getElementById('reglamentoBtn').addEventListener('click', ()=>renderReglamento());
  document.querySelectorAll('[data-strat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ startYear(btn.dataset.strat); });
  });
}

function renderConfirmRetiro(){
  const p = G.player;
  setScreen(`
    <div class="card">
      <span class="tag">Retiro</span>
      <h2>¿Seguro que querés retirarte?</h2>
      <p>Vas a cerrar tu carrera acá, a los ${p.edad} años. Esta acción no se puede deshacer.</p>
      <div class="choices">
        <button class="choice" id="confirmRetireBtn">Sí, retirarme ahora</button>
        <button class="choice" id="cancelRetireBtn">No, seguir jugando</button>
      </div>
    </div>
  `);
  document.getElementById('confirmRetireBtn').addEventListener('click', renderEpilogue);
  document.getElementById('cancelRetireBtn').addEventListener('click', renderHub);
}

/* =========================================================
   PANTALLA: INFORMACIÓN DE TORNEOS (historia + fotos reales)
========================================================= */
let tourInfoTab = 'finals';
let tourInfoVenueIdx = {}; // recuerda qué sede quedó elegida en cada pestaña, por id de categoría
function renderTournamentInfo(){
  const tabsHtml = Object.entries(TOURNAMENT_INFO).map(([id,cat])=>
    `<button class="tourinfo-tab ${tourInfoTab===id?'active':''}" data-tab="${id}">${cat.label}</button>`
  ).join('');
  const cat = TOURNAMENT_INFO[tourInfoTab];
  const multi = cat.venues.length > 1;
  const selIdx = multi ? (tourInfoVenueIdx[tourInfoTab] || 0) : 0;
  const v = cat.venues[selIdx];
  const selectHtml = multi ? `
    <select class="venue-select" id="venueSelect">
      ${cat.venues.map((vv,i)=>`<option value="${i}" ${i===selIdx?'selected':''}>${vv.name}</option>`).join('')}
    </select>` : '';
  const venueHtml = `
    <div class="venue-card">
      ${v.img ? `<img src="${wikiImg(v.img,600)}" alt="${v.name}" loading="lazy" onerror="this.style.display='none'">` : ''}
      <div class="venue-body">
        <h4>${v.name}</h4>
        <p>${v.text}</p>
      </div>
    </div>`;
  setScreen(`
    <div class="card">
      <span class="tag">Información de torneos</span>
      <h2>${cat.label}</h2>
      <div class="tourinfo-tabs">${tabsHtml}</div>
      <p class="small">${cat.intro}</p>
      ${selectHtml}
      ${venueHtml}
      <button class="primary ghost" id="backBtn" style="margin-top:8px;">Volver</button>
    </div>
  `);
  document.querySelectorAll('.tourinfo-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{ tourInfoTab = btn.dataset.tab; renderTournamentInfo(); });
  });
  const sel = document.getElementById('venueSelect');
  if(sel) sel.addEventListener('change', ()=>{ tourInfoVenueIdx[tourInfoTab] = parseInt(sel.value); renderTournamentInfo(); });
  document.getElementById('backBtn').addEventListener('click', ()=>{ G.gameEnded ? renderEpilogue() : renderHub(); });
}

/* =========================================================
   PANTALLA: RANKING DE SELECCIONES (fuerza por país, Copa Davis)
========================================================= */
let countryRankTab = 'fuerza';
let countryRankPlayersCountry = null;
function renderCountryRanking(){
  const p = G.player;
  if(!countryRankPlayersCountry) countryRankPlayersCountry = p.pais;
  const tabsHtml = `
    <div class="tourinfo-tabs">
      <button class="tourinfo-tab ${countryRankTab==='fuerza'?'active':''}" data-crtab="fuerza">Fuerza de selecciones</button>
      <button class="tourinfo-tab ${countryRankTab==='jugadores'?'active':''}" data-crtab="jugadores">Jugadores por país</button>
      <button class="tourinfo-tab ${countryRankTab==='historial'?'active':''}" data-crtab="historial">Historial de Copa Davis</button>
    </div>`;
  let bodyHtml;
  if(countryRankTab === 'fuerza'){
    const ranked = computeCountryLevelRanking(p);
    const rowsHtml = ranked.map((r,i)=>{
      const rank = i+1;
      const zona = rank<=8 ? 'davis-classified' : rank<=24 ? 'davis-possible' : '';
      const esMiPais = r.code === p.pais;
      return `<tr class="${zona}${esMiPais?' davis-me':''}"><td>#${rank}</td><td>${flagImg(r.code,16)}</td><td>${COUNTRY_NAMES[r.code]||r.code}</td><td>${r.puntaje}</td></tr>`;
    }).join('');
    bodyHtml = `
      <div class="rank-scroll"><table class="rank-table"><tr><th>#</th><th></th><th>País</th><th>Puntaje</th></tr>${rowsHtml}</table></div>
      <div class="davis-legend">
        <span><span class="legend-dot classified"></span>Clasificado a la Copa Davis</span>
        <span><span class="legend-dot possible"></span>Posible clasificación a la Copa Davis</span>
      </div>`;
  } else if(countryRankTab === 'jugadores'){
    const selectOptionsHtml = [...COUNTRY_CODES].sort((a,b)=>COUNTRY_NAMES[a].localeCompare(COUNTRY_NAMES[b],'es'))
      .map(code=>`<option value="${code}" ${code===countryRankPlayersCountry?'selected':''}>${COUNTRY_NAMES[code]}</option>`).join('');
    const rk = buildRankingList(p, G.pool);
    const paisList = rk.list.filter(x=>x.pais===countryRankPlayersCountry);
    const convocadosIds = new Set(paisConvocadosTop3(countryRankPlayersCountry, p).map(c=>c.id));
    const rowsHtml = paisList.map(x=>{
      const globalIdx = rk.list.indexOf(x)+1;
      const convocado = convocadosIds.has(x.esJugador ? "player" : x.id);
      return `<tr class="${x.esJugador?'me':''}${convocado?' davis-called-row':''}">
        <td>#${globalIdx}</td><td>${x.esJugador?'⭐':flagImg(x.pais,16)}</td>
        <td>${x.nombre}</td><td>${x.edad}</td><td>${x.nivel}</td><td>${x.puntos}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" class="small">No hay jugadores activos de este país en el circuito.</td></tr>`;
    bodyHtml = `
      <select class="venue-select" id="crCountrySelect">${selectOptionsHtml}</select>
      <div class="rank-scroll"><table class="rank-table"><tr><th>#</th><th></th><th>Jugador</th><th>Edad</th><th>Nivel</th><th>Pts</th></tr>${rowsHtml}</table></div>
      <div class="davis-legend">
        <span><span class="legend-dot classified"></span>Convocado al Equipo de Copa Davis</span>
      </div>`;
  } else {
    // Historial de Copa Davis: un registro por temporada jugada (se llena en finishYear(), ver
    // p.copaDavisHistorial), más reciente primero — mismo patrón que renderHistorial() del jugador.
    // Semifinalistas = los 2 perdedores de semifinales (no hay partido por el 3er puesto en Copa
    // Davis, quedan empatados en ese lugar, igual que en la realidad). Tabla real (no recuadros
    // sueltos, a pedido del usuario — los recuadros se deformaban según el largo de cada nombre y
    // no alineaban año con año). Bronce aclarado respecto al primer intento para poder usar texto
    // negro en vez de blanco (mejor contraste y más prolijo visualmente).
    const historial = [...(p.copaDavisHistorial||[])].reverse();
    // Resaltar el país del jugador cuando aparece en cualquiera de las 4 columnas — versión final,
    // más sutil que el intento anterior (anillo + estrella quedaba "demasiado exagerado" a pedido
    // del usuario): ahora es solo un subrayado violeta bajo el nombre, sin tocar nada más de la celda.
    const paisCelda = (code)=>{
      const esMiPais = code === p.pais;
      const subrayado = esMiPais ? 'border-bottom:2px solid var(--purple-dark);' : '';
      return `<span style="display:inline-flex;align-items:center;gap:3px;${subrayado}">${flagImg(code,14)} ${COUNTRY_NAMES[code]||code}</span>`;
    };
    const rowsHtml = historial.map(h=>`
      <tr>
        <td class="davis-hist-anio" data-anio="${h.anio}" style="cursor:pointer;font-family:'JetBrains Mono',monospace;text-decoration:underline;text-decoration-color:var(--purple);text-underline-offset:2px;">${h.anio}</td>
        <td style="background:var(--gold);color:var(--green-deep);font-weight:700;">${paisCelda(h.campeon)}</td>
        <td style="background:#C0C0C0;color:#333;">${paisCelda(h.subcampeon)}</td>
        <td style="background:#E8C39E;color:#000;">${paisCelda(h.semifinalistas[0])}</td>
        <td style="background:#E8C39E;color:#000;">${paisCelda(h.semifinalistas[1])}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="small">Todavía no se jugó ninguna Copa Davis.</td></tr>`;
    bodyHtml = `
      <div class="rank-scroll"><table class="rank-table">
        <tr><th>Año</th><th>Campeón</th><th>Subcampeón</th><th>Semifinalista</th><th>Semifinalista</th></tr>
        ${rowsHtml}
      </table></div>
      <p class="small">Tocá el año para ver el fixture completo de esa Copa Davis.</p>
      <button class="tourinfo-launch" id="palmaresBtn" style="margin-bottom:2px;">🏆 Palmarés</button>`;
  }
  setScreen(`
    <div class="card">
      <span class="tag">Ranking de Selecciones</span>
      <h2>Clasificación a la Copa Davis</h2>
      ${tabsHtml}
      ${bodyHtml}
      <button class="primary" id="backBtn">Volver</button>
    </div>
  `);
  document.querySelectorAll('[data-crtab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ countryRankTab = btn.dataset.crtab; renderCountryRanking(); });
  });
  const crSel = document.getElementById('crCountrySelect');
  if(crSel) crSel.addEventListener('change', ()=>{ countryRankPlayersCountry = crSel.value; renderCountryRanking(); });
  const palmaresBtn = document.getElementById('palmaresBtn');
  if(palmaresBtn) palmaresBtn.addEventListener('click', ()=>renderDavisPalmares());
  // Solo la celda del año es clickeable (a pedido del usuario: antes toda la fila lo era, y
  // clickear un país por error también abría el fixture) — el resto de las celdas de la fila
  // (campeón/subcampeón/semifinalistas) no tienen ningún listener, no hacen nada al tocarlas.
  document.querySelectorAll('.davis-hist-anio').forEach(celda=>{
    celda.addEventListener('click', ()=>{
      const anio = parseInt(celda.dataset.anio);
      const record = (p.copaDavisHistorial||[]).find(h=>h.anio===anio);
      if(record && record.fixture){
        renderDavisCupFixture(record.fixture, ()=>{ countryRankTab='historial'; renderCountryRanking(); }, anio);
      }
    });
  });
  document.getElementById('backBtn').addEventListener('click', ()=>{ G.gameEnded ? renderEpilogue() : renderHub(); });
}

/* =========================================================
   PANTALLA: PALMARÉS DE COPA DAVIS
   Cuenta cuántas veces salió campeón cada selección en ESTA partida (p.copaDavisHistorial),
   ordenado de mayor a menor cantidad de títulos, sin ninguna aclaración/descripción en pantalla —
   a pedido del usuario. El botón "Incluir títulos previos a 2026" sirve para sumarle, encima de
   los títulos ganados dentro del juego, el palmarés REAL de Copa Davis (ver REAL_DAVIS_TITLES) —
   es un toggle: al tocarlo de nuevo, vuelve a mostrar solo los títulos ganados dentro de la partida.
========================================================= */
// Palmarés REAL de Copa Davis (títulos ganados en la vida real hasta la fecha), usado únicamente
// para la opción "Incluir títulos previos a 2026" del Palmarés in-game. Todos los códigos de país
// de esta lista ya existen en COUNTRY_CODES/COUNTRY_NAMES, no hace falta agregar ninguno nuevo.
const REAL_DAVIS_TITLES = {
  US:32, AU:28, GB:10, FR:10, SE:7, ES:6, IT:4, CZ:3, DE:3, RU:3,
  HR:2, AR:1, ZA:1, RS:1, CH:1, CA:1,
};
let palmaresIncludeReal = false;
function computeDavisPalmares(p, includeReal){
  const counts = {};
  (p.copaDavisHistorial||[]).forEach(h=>{ counts[h.campeon] = (counts[h.campeon]||0) + 1; });
  if(includeReal){
    Object.keys(REAL_DAVIS_TITLES).forEach(code=>{ counts[code] = (counts[code]||0) + REAL_DAVIS_TITLES[code]; });
  }
  return Object.entries(counts)
    .filter(([,count])=>count>0)
    .map(([code,count])=>({code,count}))
    .sort((a,b)=> b.count-a.count || (COUNTRY_NAMES[a.code]||a.code).localeCompare(COUNTRY_NAMES[b.code]||b.code,'es'));
}
function renderDavisPalmares(){
  const p = G.player;
  const lista = computeDavisPalmares(p, palmaresIncludeReal);
  const rowsHtml = lista.map((r,i)=>`
    <tr><td>#${i+1}</td><td>${flagImg(r.code,16)}</td><td>${COUNTRY_NAMES[r.code]||r.code}</td><td>${r.count}</td></tr>
  `).join('') || `<tr><td colspan="4" class="small">Todavía no se coronó ningún campeón.</td></tr>`;
  setScreen(`
    <div class="card">
      <span class="tag">Copa Davis</span>
      <h2>Palmarés</h2>
      <div class="rank-scroll"><table class="rank-table"><tr><th>#</th><th></th><th>Selección</th><th>Títulos</th></tr>${rowsHtml}</table></div>
      <div class="checkrow">
        <input type="checkbox" id="toggleRealCheck" ${palmaresIncludeReal?'checked':''}>
        <label for="toggleRealCheck">Incluir títulos previos a 2026
          <small>Suma el palmarés real de Copa Davis al de esta partida.</small>
        </label>
      </div>
      <button class="primary" id="backBtn">Volver</button>
    </div>
  `);
  document.getElementById('toggleRealCheck').addEventListener('change', (e)=>{ palmaresIncludeReal = e.target.checked; renderDavisPalmares(); });
  document.getElementById('backBtn').addEventListener('click', ()=>{ countryRankTab='historial'; renderCountryRanking(); });
}

/* =========================================================
   PANTALLA: RANKING
========================================================= */
function renderRanking(returnTo){
  const p = G.player;
  const rk = buildRankingList(p, G.pool);
  const top = rk.list.slice(0,40);
  const myIdx = rk.list.findIndex(x=>x.esJugador);
  const around = rk.list.slice(Math.max(0,myIdx-4), Math.min(rk.list.length,myIdx+5));
  function rowsHtml(list){
    return list.map((x,i)=>{
      const globalIdx = rk.list.indexOf(x)+1;
      return `<tr class="${x.esJugador?'me':''}"><td>#${globalIdx}</td><td>${x.esJugador?'⭐':flagImg(x.pais,16)}</td><td>${x.nombre}</td><td>${x.edad}</td><td>${x.puntos}</td></tr>`;
    }).join('');
  }
  setScreen(`
    <div class="card">
      <span class="tag">Ranking ATP</span>
      <h2>Circuito mundial — ${rk.total} jugadores activos</h2>
      <p class="small">Tu posición: <b style="color:var(--purple-dark)">#${rk.ranking}</b> con ${p.puntos} puntos.</p>
      <div class="toprow">
        <button class="linkbtn" id="gsHistBtn">🎾 Campeones GS</button>
        <button class="linkbtn" id="backBtn">Volver</button>
      </div>
      <h3>Top 40</h3>
      <div class="rank-scroll" style="max-height:260px;"><table class="rank-table"><tr><th>#</th><th></th><th>Jugador</th><th>Edad</th><th>Pts</th></tr>${rowsHtml(top)}</table></div>
      ${rk.ranking>40 ? `<h3>Tu entorno</h3><div class="rank-scroll" style="max-height:180px;"><table class="rank-table"><tr><th>#</th><th></th><th>Jugador</th><th>Edad</th><th>Pts</th></tr>${rowsHtml(around)}</table></div>` : ''}
    </div>
  `);
  document.getElementById('gsHistBtn').addEventListener('click', ()=>renderGrandSlamHistorial(returnTo));
  document.getElementById('backBtn').addEventListener('click', ()=>{ returnTo==='hub' ? renderHub() : renderYearSummary(); });
}

/* =========================================================
   PANTALLA: CAMPEONES DE GRAND SLAM (historial año a año)
========================================================= */
function renderGrandSlamHistorial(returnTo){
  const sedesPool = TIER_BY_ID.gs.pool;
  const historial = [...(G.grandSlamHistorial||[])].reverse();
  const headerHtml = `<th>Año</th>` + sedesPool.map(s=>`<th>${s.split(' (')[0]}</th>`).join('');
  const rowsHtml = historial.map(h=>{
    const celdas = (h.campeones||[]).map(c=>{
      if(!c) return `<td class="small">—</td>`;
      const estilo = c.esJugador ? 'font-weight:800;color:var(--purple-dark);' : '';
      return `<td style="${estilo}"><span style="display:inline-flex;align-items:center;gap:3px;">${flagImg(c.pais,14)} ${c.nombre}</span></td>`;
    }).join('');
    return `<tr>
      <td style="font-family:'JetBrains Mono',monospace;">${h.anio}</td>
      ${celdas}
    </tr>`;
  }).join('') || `<tr><td colspan="${sedesPool.length+1}" class="small">Todavía no se jugó ningún Grand Slam.</td></tr>`;
  setScreen(`
    <div class="card">
      <span class="tag">Ranking ATP</span>
      <h2>Campeones de Grand Slam</h2>
      <div class="rank-scroll"><table class="rank-table"><tr>${headerHtml}</tr>${rowsHtml}</table></div>
      <button class="primary" id="backBtn">Volver</button>
    </div>
  `);
  document.getElementById('backBtn').addEventListener('click', ()=>renderRanking(returnTo));
}

/* =========================================================
   PANTALLA: HISTORIAL DE TEMPORADAS
========================================================= */
function renderHistorial(){
  const p = G.player;
  const items = [...p.historial].reverse().map((h,i)=>{
    const torneosHtml = h.torneos.map(t=>`<div style="font-size:11.5px;opacity:0.85;">• ${t.tier} (${t.sede}): ${t.etiqueta}</div>`).join('');
    const injuryHtml = h.injuryNote ? `<div style="font-size:11.5px;color:var(--alert);margin-top:4px;">🩹 ${h.injuryNote}</div>` : '';
    const bonusHtml = (h.bonusEvents||[]).map(b=>`<div style="font-size:11.5px;color:var(--purple-dark);margin-top:2px;">${b}</div>`).join('');
    return `<div class="log-item" style="animation:none;opacity:1;padding:0;overflow:hidden;">
      <button class="hist-toggle" data-hidx="${i}" style="width:100%;text-align:left;background:transparent;border:none;padding:8px 10px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--green-deep);font-size:13px;">
        <b>${h.edad} años</b> — Ranking #${h.rankingPrev} → #${h.ranking} · Nivel ${h.nivel} <span style="float:right;">▾</span>
      </button>
      <div class="hist-detail" data-hdetail="${i}" style="display:none;padding:0 10px 10px;">
        ${torneosHtml}
        ${injuryHtml}${bonusHtml}
      </div>
    </div>`;
  }).join('') || `<p class="small">Todavía no jugaste ninguna temporada.</p>`;
  setScreen(`
    <div class="card">
      <span class="tag">Historial</span>
      <h2>Temporada por temporada</h2>
      <p class="small">Tocá un año para ver el detalle.</p>
      <div class="shop-scroll">${items}</div>
      <button class="primary ghost" id="backBtn" style="margin-top:8px;">Volver a títulos</button>
    </div>
  `);
  document.querySelectorAll('.hist-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = btn.dataset.hidx;
      const detail = document.querySelector(`[data-hdetail="${idx}"]`);
      if(detail) detail.style.display = detail.style.display==='none' ? 'block' : 'none';
    });
  });
  document.getElementById('backBtn').addEventListener('click', renderTitulos);
}

/* =========================================================
   PANTALLA: LOGROS
========================================================= */
// Solo se muestran los logros YA desbloqueados (a diferencia de otras listas del juego, acá no
// hay entradas bloqueadas/grisadas visibles) — un logro aparece en esta pantalla recién cuando
// se consigue. Dos formas de ordenar los ya conseguidos, igual patrón que titulosOrden en
// renderTitulos(): por dificultad (tier más alto primero) o por edad a la que se lograron.
let logrosOrden = 'tier';
function renderLogros(){
  const p = G.player;
  p.logros = p.logros || {};
  // Combina logros fijos (definidos en ACHIEVEMENTS, buscados por id) con logros dinámicos (como
  // "Rey de <ciudad>", que guardan su propio icon/name/desc/tier directo en p.logros[id] porque no
  // tienen una entrada fija en ACHEVEMENTS — ver unlockDynamicAchievement).
  const desbloqueados = Object.keys(p.logros).map(id=>{
    const info = p.logros[id];
    if(info.dynamic) return { id, icon:info.icon, name:info.name, desc:info.desc, tier:info.tier };
    const base = ACHIEVEMENTS.find(a=>a.id===id);
    return base ? { ...base } : null;
  }).filter(Boolean);
  let itemsHtml;
  if(!desbloqueados.length){
    itemsHtml = `<p class="small">Todavía no tenés logros :(</p>`;
  } else {
    const ordenados = [...desbloqueados];
    if(logrosOrden==='tier'){
      ordenados.sort((a,b)=> b.tier-a.tier || a.name.localeCompare(b.name,'es'));
    } else {
      ordenados.sort((a,b)=> p.logros[a.id].edad - p.logros[b.id].edad);
    }
    itemsHtml = ordenados.map((a,i)=>{
      const info = p.logros[a.id];
      return `<div class="log-item" style="animation:none;opacity:1;padding:0;overflow:hidden;">
        <button class="logro-toggle" data-lidx="${i}" style="width:100%;text-align:left;background:transparent;border:none;padding:8px 10px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--green-deep);font-size:13px;">
          <b>${a.icon} ${a.name}</b><span style="float:right;">▾</span>
        </button>
        <div class="logro-detail" data-ldetail="${i}" style="display:none;padding:0 10px 10px;">
          <div class="small">${a.desc}</div>
          <div class="small" style="margin-top:2px;color:var(--purple-dark);">Desbloqueado a los ${info.edad} años</div>
        </div>
      </div>`;
    }).join('');
  }
  setScreen(`
    <div class="card">
      <span class="tag">Logros</span>
      <h2>Logros (${desbloqueados.length})</h2>
      ${desbloqueados.length>1 ? `<div class="toprow">
        <button class="linkbtn" id="ordTier" style="${logrosOrden==='tier'?'background:var(--gold);color:var(--green-deep);':''}">Por dificultad</button>
        <button class="linkbtn" id="ordEdad" style="${logrosOrden==='edad'?'background:var(--gold);color:var(--green-deep);':''}">Por edad de logro</button>
      </div>` : ''}
      <div class="shop-scroll" style="margin-top:10px;">${itemsHtml}</div>
      <button class="primary ghost" id="backBtn" style="margin-top:8px;">Volver</button>
    </div>
  `);
  const ordTierBtn = document.getElementById('ordTier');
  if(ordTierBtn) ordTierBtn.addEventListener('click', ()=>{ logrosOrden='tier'; renderLogros(); });
  const ordEdadBtn = document.getElementById('ordEdad');
  if(ordEdadBtn) ordEdadBtn.addEventListener('click', ()=>{ logrosOrden='edad'; renderLogros(); });
  document.querySelectorAll('.logro-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = btn.dataset.lidx;
      const detail = document.querySelector(`[data-ldetail="${idx}"]`);
      if(detail) detail.style.display = detail.style.display==='none' ? 'block' : 'none';
    });
  });
  document.getElementById('backBtn').addEventListener('click', ()=>{ G.gameEnded ? renderEpilogue() : renderHub(); });
}

/* =========================================================
   PANTALLA: REGLAMENTO / RECOMENDACIONES
========================================================= */
// Primer borrador de contenido real (antes era un placeholder "en construcción"). Estructura
// pensada para calcar el patrón de pestañas de TOURNAMENT_INFO/renderTournamentInfo: cada sección
// tiene id (para la pestaña), label (texto corto de la pestaña) y body (HTML ya armado con los
// párrafos/subtítulos que hagan falta). Agregar una sección nueva es sumar un objeto más acá.
// Pensado para irse afinando con el usuario en sesiones futuras — el contenido actual es un
// primer pase razonable, no la versión final.
const RULEBOOK_SECTIONS = [
  { id:"objetivo", label:"Objetivo",
    body:`
      <p>ATP Race es un simulador de carrera de tenis: empezás a los 15 años, sin nada, y jugás temporada a temporada hasta el retiro (como muy tarde, a los 40). No hay una única forma de "ganar" — el objetivo es escribir tu propia historia dentro del circuito, con las herramientas que vayas consiguiendo.</p>
      <p>Algunas cosas por las que podés pelear a lo largo de la carrera:</p>
      <ul style="margin:0 0 14px;padding-left:18px;font-size:13.5px;line-height:1.6;">
        <li>Subir en el ranking ATP — llegar al Top 100, al Top 10, o incluso a ser el <b>#1 del mundo</b>.</li>
        <li>Ganar títulos, desde ITF chicos hasta los <b>4 Grand Slams</b>, el <b>ATP Finals</b>, la <b>Copa Davis</b> o el oro en los <b>Juegos Olímpicos</b> (se juegan cada 4 temporadas).</li>
        <li>Construir un patrimonio grande, invertir en vos mismo (y en tu selección) desde la Tienda.</li>
        <li>Desbloquear <b>logros</b> — hay más de 40, algunos fáciles y otros prácticamente imposibles.</li>
        <li>Simplemente sobrevivir en el circuito el mayor tiempo posible, sin lesiones graves, cuidando tu físico y tu cabeza.</li>
      </ul>
      <p class="small">No hay "final feliz" único: tu carrera puede ser la de una futura leyenda o la de alguien que peleó toda la vida en los Challengers sin llegar nunca a lo más alto — las dos son historias válidas, y el juego las cuenta igual de bien.</p>
    ` },
  { id:"como-jugar", label:"Cómo se juega" ,
    body:`
      <p>Cada temporada sigue siempre el mismo orden de pasos:</p>
      <h3>1. Pretemporada</h3>
      <p>Elegís en qué enfocarte: se te ofrecen 3 mejoras de stat (de un pool de 5, rotan cada año) más la opción de descansar. Cada una sube una stat, cuesta algo de físico, y tiene algo de riesgo de lesión si te pasás de rosca entrenando.</p>
      <h3>2. Evento de la temporada</h3>
      <p>La mayoría de los años no pasa nada especial. Con menos frecuencia puede tocarte una conferencia de prensa, o una propuesta de "zona gris" (doping o arreglar un partido) — ambas con consecuencias reales si elegís mal o tenés mala suerte.</p>
      <h3>3. Elegís el calendario</h3>
      <p>Con tu nivel actual, elegís una de 3 estrategias para armar tus 8 torneos del año: jugar seguro, equilibrado, o apuntar lo más alto posible. Cada una cambia qué categorías vas a jugar.</p>
      <h3>4. Se juegan los torneos</h3>
      <p>Cada torneo se resuelve ronda a ronda. Si llegás a una final importante y no se usó todavía el evento especial del año, se dispara el <b>match point</b>: una decisión (o un mini-juego, si lo tildaste al crear el personaje) que define si ganás o sos subcampeón.</p>
      <h3>5. Cierre de temporada</h3>
      <p>Se actualiza tu ranking, envejecés un año, y se resuelven los eventos de fin de año: si terminaste entre los 8 mejores jugás el <b>ATP Finals</b>; si sos de los 3 mejores de tu país, puede tocarte la <b>Copa Davis</b>; cada 4 temporadas se disputan los <b>Juegos Olímpicos</b> (ahí también alcanza con estar entre los 3 mejores de tu país); y pueden llegarte ofertas de sponsors.</p>
      <h3>6. ¿Seguir o retirarte?</h3>
      <p>Podés retirarte voluntariamente en cualquier momento desde el hub. A partir de los 33 años, si tu físico está muy bajo, el juego te va a preguntar si preferís parar ahí. Pasados los 38 con el físico muy resentido, el retiro pasa a ser obligatorio. A los 40, se acabó siempre.</p>
    ` },
  { id:"torneos", label:"Torneos y calendario",
    body:`
      <p>Jugás <b>siempre 8 torneos por año</b>, repartidos en 8 categorías, de mayor a menor exigencia y premio:</p>
      <ul style="margin:0 0 14px;padding-left:18px;font-size:13.5px;line-height:1.7;">
        <li>🏆 <b>Grand Slam</b> — los 4 torneos más importantes del año.</li>
        <li>🥇 <b>Masters 1000</b> — el escalón justo debajo, cuadros muy exigentes.</li>
        <li>🥈 <b>ATP 500</b></li>
        <li>🥉 <b>ATP 250</b> — la categoría más numerosa del calendario regular.</li>
        <li>🎖️ <b>Challenger 175</b> y <b>Challenger 125</b> — el escalón de transición hacia el circuito principal.</li>
        <li>🏅 <b>ITF M25</b> y <b>ITF M15</b> — la base de la pirámide, donde arrancan casi todos los profesionales.</li>
      </ul>
      <p>Las 3 estrategias de calendario ("jugar seguro" / "equilibrado" / "apuntar lo más alto") no dependen de si técnicamente podés anotarte a una categoría, sino de qué tan competitivo es tu <b>nivel real</b> contra la exigencia de cada una. Apuntar más alto da más puntos y premios si te va bien, pero también más desgaste físico y más riesgo si no estás a la altura.</p>
      <p>Cada categoría tiene su propio costo de físico por ronda jugada — las categorías grandes (Slams, Masters) desgastan mucho más que un Challenger o un ITF. Planificar el año pensando en tu físico, no solo en tu nivel, es tan importante como elegir bien la categoría.</p>
    ` },
  { id:"tienda", label:"Tienda y entrenamiento",
    body:`
      <p>Tu nivel es el promedio de 5 sub-stats: <b>saque, potencia, movilidad, técnica y mental</b>. Cuanto más cerca esté una stat de su techo (99), menos rinde cada entrenamiento nuevo — así que llegar a los 90+ de verdad cuesta.</p>
      <h3>Mejoras permanentes (por niveles)</h3>
      <p>En la Tienda podés invertir en vos: un entrenador personal (mejora el rendimiento de cada sesión de entrenamiento), un fisioterapeuta (baja el riesgo de lesión), un nutricionista (te desgastás menos jugando y recuperás más rápido), ítems específicos para cada sub-stat, y un representante (mejores y más frecuentes ofertas de sponsor).</p>
      <h3>Boosters repetibles y Vida de lujo</h3>
      <p>También hay compras repetibles (recuperar físico al instante, un empujón de fama) y artículos de puro estatus que no mejoran tu juego, pero suman algo de fama simbólica y le dan sabor a tu carrera.</p>
      <h3>Selección Nacional</h3>
      <p>Desde la Tienda también podés invertir en tu <b>país</b>, no en vos: becar nuevos talentos que van a debutar en el circuito, o financiar un predio de entrenamiento que mejora de una a los tenistas activos de tu selección. Son inversiones caras, pensadas para subir las chances de que tu país clasifique y le vaya bien en la Copa Davis.</p>
      <h3>Sponsors</h3>
      <p>Con fama alta te van a empezar a llegar ofertas de marcas ficticias — podés aceptarlas, rechazarlas, o intentar negociar (con riesgo de que se ofendan y retiren la oferta). Podés tener hasta 4 sponsors activos al mismo tiempo.</p>
    ` },
  { id:"recomendaciones", label:"Recomendaciones",
    body:`
      <ul style="margin:0 0 4px;padding-left:18px;font-size:13.5px;line-height:1.75;">
        <li><b>Cuidá el físico antes que el nivel.</b> Un jugador con nivel altísimo pero físico bajo rinde peor en la cancha (y arriesga lesión) que uno más parejo entre las dos cosas.</li>
        <li><b>El fisioterapeuta rinde temprano.</b> Reduce el riesgo de lesión en pretemporada, entrenamiento, y en plena temporada — cuanto antes lo compres, más años lo aprovechás.</li>
        <li><b>No siempre conviene "apuntar lo más alto".</b> Si tu nivel todavía no está a la altura de los Masters/Slams, vas a perder mucho físico por poco resultado — a veces "equilibrado" rinde más en puntos reales ganados.</li>
        <li><b>Doping y soborno son apuestas, no atajos gratis.</b> El riesgo de que te agarren en el doping sube cada vez que lo usás a lo largo de la carrera — usarlo seguido es cada vez más peligroso.</li>
        <li><b>Mental es una stat "barata" de entrenar</b> (no cuesta físico, incluso lo suma un poco), pero rinde algo menos que las demás por eso mismo — no la ignores, pero tampoco es la única opción.</li>
        <li><b>Prestale atención a la Copa Davis.</b> Si estás entre los 3 mejores de tu país, vas a ser convocado sin importar tu ranking — puede ser una fuente grande de plata, fama y hasta título, aunque tu carrera individual no esté en su mejor momento.</li>
        <li><b>Los logros de tier 4 son extremadamente difíciles a propósito.</b> No te frustres si tu carrera nunca los toca — están pensados como el techo absoluto, no como una meta esperable.</li>
      </ul>
    ` },
];
let reglamentoTab = 'objetivo';
function renderReglamento(){
  const tabsHtml = RULEBOOK_SECTIONS.length>1 ? `<div class="tourinfo-tabs">${RULEBOOK_SECTIONS.map(s=>
    `<button class="tourinfo-tab ${reglamentoTab===s.id?'active':''}" data-rtab="${s.id}">${s.label}</button>`
  ).join('')}</div>` : '';
  const sec = RULEBOOK_SECTIONS.find(s=>s.id===reglamentoTab) || RULEBOOK_SECTIONS[0];
  setScreen(`
    <div class="card">
      <span class="tag">Reglamento</span>
      <h2>Reglamento y recomendaciones</h2>
      ${tabsHtml}
      <div class="shop-scroll">${sec.body}</div>
      <button class="primary ghost" id="backBtn" style="margin-top:8px;">Volver</button>
    </div>
  `);
  document.querySelectorAll('[data-rtab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ reglamentoTab = btn.dataset.rtab; renderReglamento(); });
  });
  document.getElementById('backBtn').addEventListener('click', ()=>{ G.gameEnded ? renderEpilogue() : renderHub(); });
}

/* =========================================================
   PANTALLA: TÍTULOS GANADOS
========================================================= */
let titulosOrden = 'anio';
const TITULO_EMOJI = {"Grand Slam":"🏆","Masters 1000":"🥇","ATP 500":"🥈","ATP 250":"🥉","Challenger 175":"🎖️","Challenger 125":"🎖️","ITF M25":"🏅","ITF M15":"🏅","ATP Finals":"🏟️","Copa Davis":"🏳️","Juegos Olímpicos":"🥇"};
function renderTitulos(){
  const p = G.player;
  const lista = [...(p.titulosList||[])];
  let itemsHtml;
  if(titulosOrden==='tipo'){
    const grupos = {};
    lista.forEach(t=>{ grupos[t.tier] = grupos[t.tier] || {count:0, weight:t.tierWeight}; grupos[t.tier].count++; });
    const ordenados = Object.entries(grupos).sort((a,b)=>b[1].weight-a[1].weight);
    itemsHtml = ordenados.map(([tier,info])=>`
      <div class="log-item" style="animation:none;opacity:1;">
        <b>${TITULO_EMOJI[tier]||'🏆'} ${info.count}x ${tier}</b>
      </div>`).join('') || `<p class="small">Todavía no ganaste ningún título.</p>`;
  } else {
    if(titulosOrden==='anio') lista.sort((a,b)=>b.edad-a.edad);
    else lista.sort((a,b)=> b.tierWeight-a.tierWeight || a.sede.localeCompare(b.sede) || a.edad-b.edad);
    itemsHtml = lista.map(t=>`
      <div class="log-item" style="animation:none;opacity:1;">
        <b>${TITULO_EMOJI[t.tier]||'🏆'} ${t.tier}</b> — ${t.sede}<br>
        <span class="small">${t.edad} años ${t.rivalNombre?`· le ganaste la final a ${t.rivalNombre}${t.rivalPais?`, ${flagImg(t.rivalPais,12)}`:''}`:t.companeros?`· jugado junto a ${t.companeros}`:''}</span>
      </div>`).join('') || `<p class="small">Todavía no ganaste ningún título.</p>`;
  }
  setScreen(`
    <div class="card">
      <span class="tag">Vitrina de trofeos</span>
      <h2>Títulos ganados (${lista.length})</h2>
      <div class="toprow">
        <button class="linkbtn" id="ordAnio" style="${titulosOrden==='anio'?'background:var(--gold);color:var(--green-deep);':''}">Por año</button>
        <button class="linkbtn" id="ordImportancia" style="${titulosOrden==='importancia'?'background:var(--gold);color:var(--green-deep);':''}">Por importancia</button>
        <button class="linkbtn" id="ordTipo" style="${titulosOrden==='tipo'?'background:var(--gold);color:var(--green-deep);':''}">Por tipo</button>
      </div>
      <div class="shop-scroll" style="margin-top:10px;">${itemsHtml}</div>
      <div class="toprow" style="margin-top:10px;">
        <button class="linkbtn" id="histCompletoBtn">Ver historial completo</button>
      </div>
      <div class="toprow" style="margin-top:6px;">
        <button class="linkbtn" id="torneosDispBtn">📋 Torneos disputados</button>
      </div>
      <button class="primary ghost" id="backBtn" style="margin-top:8px;">Volver</button>
    </div>
  `);
  document.getElementById('histCompletoBtn').addEventListener('click', renderHistorial);
  document.getElementById('torneosDispBtn').addEventListener('click', renderTorneosDisputados);
  document.getElementById('backBtn').addEventListener('click', ()=>{ G.gameEnded ? renderEpilogue() : renderHub(); });
  document.getElementById('ordAnio').addEventListener('click', ()=>{ titulosOrden='anio'; renderTitulos(); });
  document.getElementById('ordImportancia').addEventListener('click', ()=>{ titulosOrden='importancia'; renderTitulos(); });
  document.getElementById('ordTipo').addEventListener('click', ()=>{ titulosOrden='tipo'; renderTitulos(); });
}

/* =========================================================
   PANTALLA: TORNEOS DISPUTADOS
   Historial COMPLETO de participación del jugador, separado por pestañas de categoría, con las
   filas siendo los años (edades) y las columnas los torneos de esa categoría — mismo patrón visual
   que renderGrandSlamHistorial(). El dato sale de p.torneosPorAnio, que se va llenando en tiempo
   real (ver registrarTorneoAnio(), llamado desde finalizeTournamentResult() para GS/M1000, y desde
   finishYear()/maybeRunOlympics() para ATP Finals/Copa Davis/JJOO). 500/250/Challengers/ITFs
   quedan como pestañas vacías por ahora (a pedido del usuario), para resolver en otra sesión.
========================================================= */
const CATEGORIA_TABS_TD = [
  {id:'nacional', label:'Selección Nacional'},
  {id:'atpFinals', label:'ATP Finals'},
  {id:'gs', label:'Grand Slams'},
  {id:'m1000', label:'ATP 1000'},
  {id:'atp500', label:'ATP 500'},
  {id:'atp250', label:'ATP 250'},
  {id:'challenger', label:'Challengers'},
  {id:'itf', label:'ITFs'},
];
let torneosDispTab = 'nacional';
// Toggle compartido entre TODAS las pestañas (destildado por default): oculta las filas (edades)
// donde no se jugó NINGÚN torneo de la categoría actual. Útil sobre todo en ATP 500/250, donde
// con frecuencia se juega mucho al principio/final de la carrera y poco en el medio (o al revés
// con Grand Slam) — clickearlo en cualquier pestaña lo activa/desactiva para todas.
let torneosDispOcultarVacios = false;
function renderTorneosDisputados(){
  const p = G.player;
  const tabsHtml = CATEGORIA_TABS_TD.map(t=>
    `<button class="tourinfo-tab ${torneosDispTab===t.id?'active':''}" data-tdtab="${t.id}">${t.label}</button>`
  ).join('');
  // Filas: una por cada temporada ya jugada, más reciente primero (mismo criterio que el resto de
  // las pantallas de historial). Se toma de p.historial (no de torneosPorAnio) porque una temporada
  // puede no haber generado NINGÚN registro en alguna categoría puntual, y aun así hay que mostrar
  // la fila (con "NP" en todas las columnas de esa pestaña) — salvo que el toggle de ocultar años
  // vacíos esté activado.
  const anios = [...p.historial].map(h=>h.edad).sort((a,b)=>b-a);
  function celda(edad, categoria, key){
    const val = p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad][categoria] && p.torneosPorAnio[edad][categoria][key];
    if(!val) return `<td class="small" style="opacity:0.4;">NP</td>`;
    return `<td>${val==='Campeón'?`<b>${val}</b>`:val}</td>`;
  }
  // Para las categorías "simples" (gs/m1000/atp500/atp250/atpFinals): un año tiene participación
  // si p.torneosPorAnio[edad][categoria] tiene al menos una clave cargada (nunca se registra "NP"
  // explícitamente, solo se guarda cuando el torneo se jugó de verdad).
  function tuvoParticipacion(edad, categoria){
    const cat = p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad][categoria];
    return !!(cat && Object.keys(cat).length);
  }
  // Selección Nacional es especial: Copa Davis registra un valor TODOS los años (incluso "No
  // convocado"/"No clasificó", que no son participación real), y JJOO solo en años de JJOO. Un año
  // cuenta como "con participación" únicamente si de verdad se jugó algún partido.
  const SIN_PARTICIPACION_NACIONAL = new Set(['No convocado','No clasificó']);
  function tuvoParticipacionNacional(edad){
    const cat = p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad].nacional;
    if(!cat) return false;
    const davisOk = cat.davis && !SIN_PARTICIPACION_NACIONAL.has(cat.davis);
    const jjooOk = cat.jjoo && !SIN_PARTICIPACION_NACIONAL.has(cat.jjoo);
    return !!(davisOk || jjooOk);
  }
  function aplicarFiltro(lista, checkFn){
    return torneosDispOcultarVacios ? lista.filter(checkFn) : lista;
  }
  // Referencia de abreviaturas (sede real detrás de cada código de 2 letras): ordenada
  // alfabéticamente por nombre de sede, en una grilla que envuelve prolijo en vez de una sola
  // línea larga con puntos separadores.
  function refListHtml(abbrMap, sedes){
    const ordenadas = [...sedes].sort((a,b)=>a.localeCompare(b,'es'));
    const itemsHtml = ordenadas.map(s=>`<span style="white-space:nowrap;"><b>${abbrMap[s]||s}</b> ${s}</span>`).join('');
    return `<div style="display:flex;flex-wrap:wrap;gap:5px 16px;font-family:'JetBrains Mono',monospace;font-size:10px;opacity:0.65;margin-top:8px;line-height:1.6;">${itemsHtml}</div>`;
  }
  const toggleHtml = `
    <div class="checkrow" style="margin-top:10px;margin-bottom:0;">
      <input type="checkbox" id="ocultarVaciosCheck" ${torneosDispOcultarVacios?'checked':''}>
      <label for="ocultarVaciosCheck">Ocultar años sin participación</label>
    </div>`;
  let bodyHtml;
  if(!anios.length){
    bodyHtml = `<p class="small">Todavía no jugaste ninguna temporada.</p>`;
  } else if(torneosDispTab==='nacional'){
    const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacionNacional(edad));
    if(!aniosFiltrados.length){
      bodyHtml = `<p class="small">No hay temporadas con participación en Selección Nacional (con el filtro activado).</p>`;
    } else {
      const rowsHtml = aniosFiltrados.map(edad=>{
        const davisRaw = (p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad].nacional && p.torneosPorAnio[edad].nacional.davis) || 'NP';
        const davisVal = davisRaw==='Campeón' ? `<b>${davisRaw}</b>` : davisRaw;
        const esOlyAge = OLYMPIC_AGES.includes(edad);
        const jjooVal = esOlyAge ? ((p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad].nacional && p.torneosPorAnio[edad].nacional.jjoo) || 'NP') : '—';
        return `<tr><td>${edad} años</td><td>${davisVal}</td><td>${jjooVal}</td></tr>`;
      }).join('');
      bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr><th>Edad</th><th>Copa Davis</th><th>Juegos Olímpicos</th></tr>${rowsHtml}</table></div>
        <p class="small">NP = no participó.</p>`;
    }
  } else if(torneosDispTab==='atpFinals'){
    const jugoAlgunaVez = anios.some(edad=>tuvoParticipacion(edad,'atpFinals'));
    if(!jugoAlgunaVez){
      bodyHtml = `<p class="small">Todavía no jugaste ningún ATP Finals.</p>`;
    } else {
      const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacion(edad,'atpFinals'));
      const rowsHtml = aniosFiltrados.map(edad=>`<tr><td>${edad} años</td>${celda(edad,'atpFinals','unico')}</tr>`).join('');
      bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr><th>Edad</th><th>ATP Finals</th></tr>${rowsHtml}</table></div>
        <p class="small">NP = no participó.</p>`;
    }
  } else if(torneosDispTab==='gs'){
    const jugoAlgunaVez = anios.some(edad=>tuvoParticipacion(edad,'gs'));
    if(!jugoAlgunaVez){
      bodyHtml = `<p class="small">Todavía no jugaste ningún Grand Slam.</p>`;
    } else {
      const sedes = TIER_BY_ID.gs.pool;
      const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacion(edad,'gs'));
      const headerHtml = `<th>Edad</th>` + sedes.map(s=>`<th>${s.split(' (')[0]}</th>`).join('');
      const rowsHtml = aniosFiltrados.map(edad=>`<tr><td>${edad} años</td>${sedes.map(s=>celda(edad,'gs',s)).join('')}</tr>`).join('');
      bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr>${headerHtml}</tr>${rowsHtml}</table></div>
        <p class="small">NP = no participó.</p>`;
    }
  } else if(torneosDispTab==='m1000'){
    const sedes = TIER_BY_ID.m1000.pool;
    const refHtml = refListHtml(M1000_ABBR, sedes);
    const jugoAlgunaVez = anios.some(edad=>tuvoParticipacion(edad,'m1000'));
    if(!jugoAlgunaVez){
      bodyHtml = `<p class="small">Todavía no jugaste ningún ATP 1000.</p>${refHtml}`;
    } else {
      const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacion(edad,'m1000'));
      const headerHtml = `<th>Edad</th>` + sedes.map(s=>`<th>${M1000_ABBR[s]||s.slice(0,2)}</th>`).join('');
      const rowsHtml = aniosFiltrados.map(edad=>`<tr><td>${edad} años</td>${sedes.map(s=>celda(edad,'m1000',s)).join('')}</tr>`).join('');
      bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr>${headerHtml}</tr>${rowsHtml}</table></div>
        <p class="small">NP = no participó.</p>${refHtml}`;
    }
  } else if(torneosDispTab==='atp500'){
    // A diferencia de GS/M1000 (que tienen pocas sedes fijas), ATP 500 tiene 9 sedes posibles y el
    // jugador rara vez las juega todas — mostrar las 9 columnas siempre dejaría la tabla llena de
    // "NP". En cambio: cada columna aparece recién la primera vez que se juega esa sede, en el
    // orden en que fueron apareciendo. Las FILAS cubren TODAS las temporadas jugadas desde los 15
    // años (no solo desde el primer ATP 500) — salvo que el toggle de ocultar años vacíos esté
    // activado, en cuyo caso se filtran igual que en el resto de las pestañas.
    const primeraAparicionPorSede = {};
    anios.forEach(edad=>{
      const cat = p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad].atp500;
      if(cat) Object.keys(cat).forEach(sede=>{
        if(primeraAparicionPorSede[sede]===undefined || edad<primeraAparicionPorSede[sede]) primeraAparicionPorSede[sede]=edad;
      });
    });
    const sedesJugadas = Object.keys(primeraAparicionPorSede).sort((a,b)=>primeraAparicionPorSede[a]-primeraAparicionPorSede[b]);
    const refHtml = refListHtml(ATP500_ABBR, TIER_BY_ID.atp500.pool);
    if(!sedesJugadas.length){
      bodyHtml = `<p class="small">Todavía no jugaste ningún ATP 500.</p>${refHtml}`;
    } else {
      const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacion(edad,'atp500'));
      if(!aniosFiltrados.length){
        bodyHtml = `<p class="small">No hay temporadas con participación en ATP 500 (con el filtro activado).</p>${refHtml}`;
      } else {
        const headerHtml = `<th>Edad</th>` + sedesJugadas.map(s=>`<th>${ATP500_ABBR[s]||s.slice(0,2)}</th>`).join('');
        const rowsHtml = aniosFiltrados.map(edad=>`<tr><td>${edad} años</td>${sedesJugadas.map(s=>celda(edad,'atp500',s)).join('')}</tr>`).join('');
        bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr>${headerHtml}</tr>${rowsHtml}</table></div>
          <p class="small">NP = no participó.</p>${refHtml}`;
      }
    }
  } else if(torneosDispTab==='atp250'){
    // Mismo criterio que ATP 500: columnas dinámicas (aparecen recién con el primer resultado en
    // esa sede, ordenadas por orden de aparición), filas completas desde los 15 años (salvo filtro).
    const primeraAparicionPorSede = {};
    anios.forEach(edad=>{
      const cat = p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad].atp250;
      if(cat) Object.keys(cat).forEach(sede=>{
        if(primeraAparicionPorSede[sede]===undefined || edad<primeraAparicionPorSede[sede]) primeraAparicionPorSede[sede]=edad;
      });
    });
    const sedesJugadas = Object.keys(primeraAparicionPorSede).sort((a,b)=>primeraAparicionPorSede[a]-primeraAparicionPorSede[b]);
    const refHtml = refListHtml(ATP250_ABBR, TIER_BY_ID.atp250.pool);
    if(!sedesJugadas.length){
      bodyHtml = `<p class="small">Todavía no jugaste ningún ATP 250.</p>${refHtml}`;
    } else {
      const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacion(edad,'atp250'));
      if(!aniosFiltrados.length){
        bodyHtml = `<p class="small">No hay temporadas con participación en ATP 250 (con el filtro activado).</p>${refHtml}`;
      } else {
        const headerHtml = `<th>Edad</th>` + sedesJugadas.map(s=>`<th>${ATP250_ABBR[s]||s.slice(0,2)}</th>`).join('');
        const rowsHtml = aniosFiltrados.map(edad=>`<tr><td>${edad} años</td>${sedesJugadas.map(s=>celda(edad,'atp250',s)).join('')}</tr>`).join('');
        bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr>${headerHtml}</tr>${rowsHtml}</table></div>
          <p class="small">NP = no participó.</p>${refHtml}`;
      }
    }
  } else if(torneosDispTab==='challenger'){
    // Fusiona Challenger 175 y Challenger 125 (el jugador no distingue la subcategoría en esta
    // pantalla, solo la sede). Mismo criterio dinámico que ATP 500/250.
    const primeraAparicionPorSede = {};
    anios.forEach(edad=>{
      const cat = p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad].challenger;
      if(cat) Object.keys(cat).forEach(sede=>{
        if(primeraAparicionPorSede[sede]===undefined || edad<primeraAparicionPorSede[sede]) primeraAparicionPorSede[sede]=edad;
      });
    });
    const sedesJugadas = Object.keys(primeraAparicionPorSede).sort((a,b)=>primeraAparicionPorSede[a]-primeraAparicionPorSede[b]);
    const refHtml = refListHtml(CHALLENGER_ABBR, [...TIER_BY_ID.ch175.pool, ...TIER_BY_ID.ch125.pool]);
    if(!sedesJugadas.length){
      bodyHtml = `<p class="small">Todavía no jugaste ningún Challenger.</p>${refHtml}`;
    } else {
      const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacion(edad,'challenger'));
      if(!aniosFiltrados.length){
        bodyHtml = `<p class="small">No hay temporadas con participación en Challengers (con el filtro activado).</p>${refHtml}`;
      } else {
        const headerHtml = `<th>Edad</th>` + sedesJugadas.map(s=>`<th>${CHALLENGER_ABBR[s]||s.slice(0,2)}</th>`).join('');
        const rowsHtml = aniosFiltrados.map(edad=>`<tr><td>${edad} años</td>${sedesJugadas.map(s=>celda(edad,'challenger',s)).join('')}</tr>`).join('');
        bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr>${headerHtml}</tr>${rowsHtml}</table></div>
          <p class="small">NP = no participó.</p>${refHtml}`;
      }
    }
  } else if(torneosDispTab==='itf'){
    // Fusiona ITF M25 y M15, mismo criterio.
    const primeraAparicionPorSede = {};
    anios.forEach(edad=>{
      const cat = p.torneosPorAnio && p.torneosPorAnio[edad] && p.torneosPorAnio[edad].itf;
      if(cat) Object.keys(cat).forEach(sede=>{
        if(primeraAparicionPorSede[sede]===undefined || edad<primeraAparicionPorSede[sede]) primeraAparicionPorSede[sede]=edad;
      });
    });
    const sedesJugadas = Object.keys(primeraAparicionPorSede).sort((a,b)=>primeraAparicionPorSede[a]-primeraAparicionPorSede[b]);
    const refHtml = refListHtml(ITF_ABBR, [...TIER_BY_ID.m25.pool, ...TIER_BY_ID.m15.pool]);
    if(!sedesJugadas.length){
      bodyHtml = `<p class="small">Todavía no jugaste ningún ITF.</p>${refHtml}`;
    } else {
      const aniosFiltrados = aplicarFiltro(anios, edad=>tuvoParticipacion(edad,'itf'));
      if(!aniosFiltrados.length){
        bodyHtml = `<p class="small">No hay temporadas con participación en ITFs (con el filtro activado).</p>${refHtml}`;
      } else {
        const headerHtml = `<th>Edad</th>` + sedesJugadas.map(s=>`<th>${ITF_ABBR[s]||s.slice(0,2)}</th>`).join('');
        const rowsHtml = aniosFiltrados.map(edad=>`<tr><td>${edad} años</td>${sedesJugadas.map(s=>celda(edad,'itf',s)).join('')}</tr>`).join('');
        bodyHtml = `<div class="rank-scroll"><table class="rank-table"><tr>${headerHtml}</tr>${rowsHtml}</table></div>
          <p class="small">NP = no participó.</p>${refHtml}`;
      }
    }
  } else {
    bodyHtml = `<p class="small">Todavía no armamos esta pestaña — próximamente.</p>`;
  }
  setScreen(`
    <div class="card">
      <span class="tag">Torneos disputados</span>
      <h2>Historial de participación</h2>
      <div class="tourinfo-tabs">${tabsHtml}</div>
      ${bodyHtml}
      ${anios.length ? toggleHtml : ''}
      <button class="primary ghost" id="backBtn" style="margin-top:10px;">Volver a títulos</button>
    </div>
  `);
  const ocultarVaciosCheck = document.getElementById('ocultarVaciosCheck');
  if(ocultarVaciosCheck) ocultarVaciosCheck.addEventListener('change', (e)=>{ torneosDispOcultarVacios = e.target.checked; renderTorneosDisputados(); });
  document.querySelectorAll('[data-tdtab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ torneosDispTab = btn.dataset.tdtab; renderTorneosDisputados(); });
  });
  document.getElementById('backBtn').addEventListener('click', renderTitulos);
}

/* =========================================================
   PANTALLA: TIENDA
========================================================= */
function renderShop(refresh){
  const p = G.player;
  const prevScrollEl = document.getElementById('shopScrollDiv');
  const prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
  const itemsHtml = SHOP_ITEMS.map(it=>{
    const level = p.itemLevels[it.id] || 0;
    const maxed = level >= it.costs.length;
    const statMaxed = it.stat && p[it.stat]>=99;
    const cost = maxed ? null : it.costs[level];
    return `<button class="choice" data-item="${it.id}" ${maxed||statMaxed||p.dinero<cost?'disabled':''}>
      ${it.name} ${level>0?`(nivel ${level}/${it.costs.length})`:''} ${maxed?'— MÁXIMO ✅':statMaxed?'— la stat ya está al tope':`— ${fmt(cost)} para nivel ${level+1}`}
      <small>${it.desc}</small>
    </button>`;
  }).join('');
  const repeatHtml = SHOP_REPEATABLE.map(it=>{
    const count = (p.repeatBuys && p.repeatBuys[it.id]) || 0;
    const cost = Math.round(it.baseCost * Math.pow(1.35, count));
    const atTope = (it.effect==="fisico" && Math.round(p.fisico)>=p.fisicoMax) || (it.effect==="fama" && Math.round(p.fama)>=100);
    const topeTexto = it.effect==="fisico" ? "— ya estás al tope de físico" : it.effect==="fama" ? "— ya estás al tope de fama" : "— ya estás al tope";
    return `<button class="choice" data-repeat="${it.id}" ${atTope||p.dinero<cost?'disabled':''}>
      ${it.name} — ${fmt(cost)} ${count>0?`(comprado x${count})`:''} ${atTope?topeTexto:''}
      <small>${it.desc}</small>
    </button>`;
  }).join('');
  const luxuryHtml = SHOP_LUXURY.map(it=>{
    const count = (p.luxuryBuys && p.luxuryBuys[it.id]) || 0;
    const maxed = it.oneTimeMax && count>=it.oneTimeMax;
    const cost = Math.round(it.baseCost * Math.pow(1.22, count));
    return `<button class="choice" data-luxury="${it.id}" ${maxed||p.dinero<cost?'disabled':''}>
      ${it.name} ${maxed?'— MÁXIMO ✅':`— ${fmt(cost)}`} ${count>0?`(x${count})`:''}
      <small>${it.desc}${it.fama?` · Fama +${it.fama}`:''}</small>
    </button>`;
  }).join('');
  const cardClass = refresh ? 'card no-anim' : 'card';
  const choicesClass = refresh ? 'choices no-anim' : 'choices';
  setScreen(`
    <div class="${cardClass}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="tag">Tienda</span>
        <button class="tourinfo-launch" id="nationalShopBtn">🏟️ Selección Nacional</button>
      </div>
      <h2>Invertí en tu carrera</h2>
      <p class="small">Dinero disponible: <b style="color:var(--purple-dark)">${fmt(p.dinero)}</b></p>
      <div class="shop-scroll" id="shopScrollDiv">
        <h3>Mejoras permanentes (por niveles)</h3>
        <div class="${choicesClass}">${itemsHtml}</div>
        <h3>Boosters repetibles</h3>
        <div class="${choicesClass}">${repeatHtml}</div>
        <h3>Vida de lujo</h3>
        <div class="${choicesClass}">${luxuryHtml}</div>
      </div>
      <button class="primary ghost" id="backBtn" style="margin-top:12px;">Volver</button>
    </div>
  `);
  const nationalShopBtn = document.getElementById('nationalShopBtn');
  if(nationalShopBtn) nationalShopBtn.addEventListener('click', ()=>renderNationalShop());
  if(refresh){
    const scrollEl = document.getElementById('shopScrollDiv');
    if(scrollEl) scrollEl.scrollTop = prevScrollTop;
  }
  document.querySelectorAll('[data-item]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.item;
      const it = SHOP_ITEMS.find(i=>i.id===id);
      const level = p.itemLevels[id] || 0;
      if(level >= it.costs.length) return;
      if(it.stat && p[it.stat]>=99) return; // ya está al tope, no tiene sentido seguir comprando
      const cost = it.costs[level];
      if(p.dinero<cost) return;
      p.dinero -= cost;
      p.itemLevels[id] = level+1;
      unlockAchievement(p, 'primera_compra_tienda');
      if(it.stat){
        p[it.stat] = clamp(p[it.stat] + shopLevelGain(it.totalEffect, it.costs.length, level+1), 0, 99);
        checkStatItemsAchievement(p);
      }
      recalcNivel(p);
      renderShop(true);
    });
  });
  document.querySelectorAll('[data-luxury]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.luxury;
      const it = SHOP_LUXURY.find(i=>i.id===id);
      p.luxuryBuys = p.luxuryBuys || {};
      const count = p.luxuryBuys[id] || 0;
      if(it.oneTimeMax && count>=it.oneTimeMax) return;
      const cost = Math.round(it.baseCost * Math.pow(1.22, count));
      if(p.dinero<cost) return;
      p.dinero -= cost;
      p.luxuryBuys[id] = count+1;
      unlockAchievement(p, 'primera_compra_tienda');
      if(it.fama) p.fama = clamp(p.fama + it.fama);
      renderShop(true);
    });
  });
  document.querySelectorAll('[data-repeat]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.repeat;
      const it = SHOP_REPEATABLE.find(i=>i.id===id);
      p.repeatBuys = p.repeatBuys || {};
      const count = p.repeatBuys[id] || 0;
      const cost = Math.round(it.baseCost * Math.pow(1.35, count));
      if(it.effect==="fisico" && Math.round(p.fisico)>=p.fisicoMax) return;
      if(it.effect==="fama" && Math.round(p.fama)>=100) return;
      if(p.dinero<cost) return;
      p.dinero -= cost;
      p.repeatBuys[id] = count+1;
      unlockAchievement(p, 'primera_compra_tienda');
      if(it.effect==="fisico") p.fisico = clamp(p.fisico+20, 0, p.fisicoMax);
      if(it.effect==="fama") p.fama = clamp(p.fama+5);
      renderShop(true);
    });
  });
  document.getElementById('backBtn').addEventListener('click', renderHub);
}

/* =========================================================
   PANTALLA: TIENDA — SELECCIÓN NACIONAL
   Inversiones caras que NO mejoran al jugador: mejoran a los NPCs de su país, para subir sus
   chances en Ranking de Selecciones / Copa Davis. Ver SHOP_NATIONAL_ITEMS para el detalle de
   costos y rangos de bonus. Guardado en el mismo p.itemLevels que el resto de la tienda (ids
   "becas" y "predio", sin colisión con los ids de SHOP_ITEMS).
========================================================= */
function renderNationalShop(refresh){
  const p = G.player;
  const itemsHtml = SHOP_NATIONAL_ITEMS.map(it=>{
    const level = (p.itemLevels && p.itemLevels[it.id]) || 0;
    const maxed = level >= it.costs.length;
    const cost = maxed ? null : it.costs[level];
    return `<button class="choice" data-nitem="${it.id}" ${maxed||p.dinero<cost?'disabled':''}>
      ${it.name} ${level>0?`(nivel ${level}/${it.costs.length})`:''} ${maxed?'— MÁXIMO ✅':`— ${fmt(cost)} para nivel ${level+1}`}
      <small>${it.desc}</small>
    </button>`;
  }).join('');
  const cardClass = refresh ? 'card no-anim' : 'card';
  const choicesClass = refresh ? 'choices no-anim' : 'choices';
  setScreen(`
    <div class="${cardClass}">
      <span class="tag">Tienda — Selección Nacional</span>
      <h2>Inversión en la selección de ${flagImg(p.pais,20)} ${COUNTRY_NAMES[p.pais]||p.pais}</h2>
      <p class="small">Estas mejoras suben el nivel de los otros tenistas de tu país en el circuito, aumentando las probabilidades de la selección en la Copa Davis. Cada mejora tiene hasta dos niveles.</p>
      <p class="small">Dinero disponible: <b style="color:var(--purple-dark)">${fmt(p.dinero)}</b></p>
      <div class="${choicesClass}">${itemsHtml}</div>
      <button class="primary ghost" id="backBtn" style="margin-top:12px;">Volver a la tienda</button>
    </div>
  `);
  document.querySelectorAll('[data-nitem]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.nitem;
      const it = SHOP_NATIONAL_ITEMS.find(i=>i.id===id);
      p.itemLevels = p.itemLevels || {};
      const level = p.itemLevels[id] || 0;
      if(level >= it.costs.length) return;
      const cost = it.costs[level];
      if(p.dinero<cost) return;
      p.dinero -= cost;
      p.itemLevels[id] = level+1;
      unlockAchievement(p, 'primera_compra_tienda');
      if(id==='predio'){
        // Efecto inmediato: cada jugador ACTIVO de tu país (NPC, no vos) sube un monto al azar
        // entre bonusMin y bonusMax de nivel, en el momento de la compra — un sorteo independiente
        // por jugador, no un único monto para todo el país. No afecta a los que debuten después de
        // este momento (para eso está "Becas").
        G.pool.forEach(npc=>{
          if(!npc.retirado && npc.pais===p.pais) npc.nivel = clamp(npc.nivel + randInt(it.bonusMin, it.bonusMax), 0, 99);
        });
      }
      // "becas" no necesita ninguna acción acá: se aplica solo, en makeNPC(), cada vez que debuta
      // un jugador nuevo de este país — lee p.itemLevels.becas en ese momento.
      renderNationalShop(true);
    });
  });
  document.getElementById('backBtn').addEventListener('click', ()=>renderShop());
}

/* =========================================================
   FLUJO DE TEMPORADA
========================================================= */
let yearState = null;

// Objeto "preroll" de la temporada: qué 3 stats se ofrecen para entrenar y qué evento especial
// (doping/soborno/prensa/ninguno) toca este año. Se genera UNA sola vez por temporada real, la
// primera vez que se entra a elegir calendario, y no se vuelve a tirar hasta que finishYear() lo
// resetea a null al cerrar la temporada. Así, ir y volver entre el hub y la elección de estrategia
// (con "« Volver, cambiar de estrategia") ya no permite resortear el entrenamiento ni el evento.
let seasonPreroll = null;

// Datos base de las 5 mejoras de entrenamiento posibles (estático, no depende del jugador).
// Riesgos de lesión bajados ~15% (a pedido del usuario, sesión de "menos frustrante") respecto a
// los valores originales (0.014/0.018/0.014/0.01) — ver también el mismo criterio aplicado en el
// evento de pretemporada y en checkMidSeasonInjuryThenPlay.
const STAT_TRAINING_OPTIONS = [
  {stat:"saque", label:"Trabajar el saque", base:8, fisicoCost:8, risk:0.012, text:"Meses de repeticiones de saque. Se nota en la velocidad de tu primer servicio."},
  {stat:"potencia", label:"Trabajar la potencia física", base:7, fisicoCost:10, risk:0.015, text:"Pretemporada dura en el gimnasio. Llegás más fuerte, pero cansado.", extra:{stat:"movilidad",amount:3}},
  {stat:"movilidad", label:"Trabajar la movilidad y los desplazamientos", base:8, fisicoCost:8, risk:0.012, text:"Llegás a bolas que antes dabas por perdidas."},
  {stat:"tecnica", label:"Pulir la técnica de base", base:8, fisicoCost:6, risk:0.008, text:"El nuevo grip te cuesta al principio, pero termina rindiendo."},
  {stat:"mental", label:"Trabajar la parte mental con un psicólogo deportivo", base:8, fisicoCost:-3, risk:0, text:"Encontrás herramientas para manejar la presión de los puntos importantes."},
];

function startYear(strategy){
  const p = G.player;
  // OJO: p.puntos ya NO se resetea acá (bug #2) — se resetea recién cuando se compromete un
  // entrenamiento, en renderTrainingChoice(). Así, mientras el jugador solo esté mirando
  // estrategias, el hub sigue mostrando ranking/puntos consistentes si vuelve atrás.
  const calendario = buildCalendar(strategy, p);
  if(!seasonPreroll){
    // Evento especial "de flavor" del año: como mucho UNO entre conferencia de prensa, doping o
    // soborno. "Ninguno" es lo más común. IMPORTANTE (cambio de diseño): el match point YA NO
    // comparte este cupo — es un evento aparte y GARANTIZADO cada vez que la temporada tiene al
    // menos una final (ver runSeason/resolvePendingFinals), independiente de si acá salió prensa/
    // doping/soborno o "ninguno". Antes competían por el mismo cupo de "1 evento especial por
    // año", así que si tocaba doping/soborno/prensa, ese año NUNCA había match point aunque el
    // jugador llegara a una final — eso ya no pasa.
    const roll = Math.random();
    let specialEventType = null;
    if(roll < 0.025) specialEventType = 'doping';
    else if(roll < 0.05) specialEventType = 'soborno';
    else if(roll < 0.22) specialEventType = 'prensa';
    // qué 3 de las 5 mejoras se ofrecen esta temporada (bug #1: antes se resorteaba en cada render)
    const statIds = shuffle(STAT_TRAINING_OPTIONS.map(so=>so.stat)).slice(0,3);
    seasonPreroll = { specialEventType, statIds };
  }
  yearState = { strategy, calendario, idx:0, results:[], interactiveUsed:false, pendingFinal:null, injuryNote:null, snapshotTaken:false, hadInjury:false, specialEventType: seasonPreroll.specialEventType };
  renderTrainingChoice();
}

/* =========================================================
   ENTRENAMIENTO ANUAL (garantizado, con stats visibles)
========================================================= */
function renderTrainingChoice(){
  const p = G.player;
  const coachLevel = p.itemLevels.coach || 0;
  // CAMBIO (a pedido del usuario, sesión de "entrenador personal se diluye con nivel alto"): antes
  // este bonus se sumaba DENTRO de diminish(so.base+bonus, ...), así que quedaba multiplicado por el
  // mismo statFactor que castiga el entrenamiento normal cerca del techo (piso 0.09 → hasta -91%
  // cuando la stat está cerca de 95) — por eso invertir en el entrenador dejaba de notarse justo
  // cuando más plata ya se había puesto (llegaba a rendir solo +1 con la stat en 90+). En la sesión
  // siguiente se probó sacarle el castigo por completo, pero eso lo hizo demasiado fuerte (permitió
  // llegar a nivel 100). AJUSTE FINAL: el bonus vuelve a pasar por un "castigo por cercanía al techo"
  // (coachStatFactor, ver más arriba) — pero con un piso de 0.33 en vez de 0.09, así que con la stat
  // muy alta el entrenador rinde ~+2 en vez de desplomarse a +1. Sigue pasando también por el factor
  // de edad (ageFactorOnly), igual que antes.
  const bonus = shopCumulativeEffect(6, 10, coachLevel); // el entrenador personal suma este extra a la ganancia principal de cada elección
  // las 3 stats ofrecidas ya quedaron fijadas en seasonPreroll al entrar a elegir calendario esta
  // temporada — no se vuelven a sortear en cada render (bug #1).
  const shuffledStats = seasonPreroll.statIds.map(id => STAT_TRAINING_OPTIONS.find(so=>so.stat===id));
  const opciones = shuffledStats.map(so=>{
    // El mental rinde 1 punto menos que las demás mejoras de stat (mínimo 1): así, aunque no
    // cueste físico (incluso lo suma), sigue habiendo un trade-off real contra otra stat que
    // rinda lo mismo — antes, con el mismo número y sin costo físico, mental ganaba siempre sin pensarlo.
    const malus = so.stat==='mental' ? 1 : 0;
    const coachGain = Math.round(bonus * coachStatFactor(p[so.stat]) * ageFactorOnly(p.edad));
    const gainReal = Math.max(1, Math.round(diminish(so.base, p[so.stat], p.edad)) + coachGain - malus);
    return {
      label: so.label,
      sub: `${so.stat[0].toUpperCase()+so.stat.slice(1)} +${gainReal}${so.extra?`, ${so.extra.stat} +${Math.max(1,Math.round(diminish(so.extra.amount,p[so.extra.stat],p.edad)))}`:''}, Físico ${so.fisicoCost>=0?'-':'+'}${Math.abs(so.fisicoCost)}${so.risk?` · riesgo de lesión leve`:''}`,
      resolve: pl=>{
        const golden = Math.random() < 0.1;
        const coachGainPl = Math.round(bonus * coachStatFactor(pl[so.stat]) * ageFactorOnly(pl.edad));
        const baseGainRaw = Math.round(diminish(so.base, pl[so.stat], pl.edad)) + coachGainPl;
        let realGainRaw = baseGainRaw;
        if(golden){
          const mult = 1.4+Math.random()*0.4;
          realGainRaw = Math.max(baseGainRaw+1, Math.round(diminish(so.base, pl[so.stat], pl.edad) * mult) + coachGainPl);
        }
        const realGain = Math.max(1, realGainRaw - malus);
        pl[so.stat]=clamp(pl[so.stat]+realGain, 0, 99);
        if(so.extra){
          const extraBase = Math.max(1, Math.round(diminish(so.extra.amount,pl[so.extra.stat],pl.edad)));
          const extraGain = golden ? Math.max(extraBase+1, Math.round(diminish(so.extra.amount,pl[so.extra.stat],pl.edad) * (1.4+Math.random()*0.4))) : extraBase;
          pl[so.extra.stat]=clamp(pl[so.extra.stat]+extraGain, 0, 99);
        }
        pl.fisico=clamp(pl.fisico-so.fisicoCost,0,pl.fisicoMax);
        if(so.risk && Math.random()<so.risk*(1-fisioInjuryReduction(pl))*highFisicoProtection(pl.fisico)){
          pl.fisico = clamp(pl.fisico-20,0,pl.fisicoMax);
          yearState.hadInjury = true;
          if(Math.random()<0.3 && yearState.calendario.length>3){
            const jugados = 3+Math.floor(Math.random()*3);
            yearState.calendario = yearState.calendario.slice(0,jugados);
            yearState.injuryNote = `Lesión durante la pretemporada: arrancás con menos torneos previstos este año (jugás ${jugados} de 8).`;
          }
          return {text: so.text+" Pero te pasaste de rosca: una molestia te va a complicar el arranque de temporada.", tone:"bad"};
        }
        if(golden) return {text: `✨ ¡Sesión excepcional! ${so.text} Superaste tus marcas personales (+${realGain} en vez de lo habitual).`, tone:"good"};
        return {text: so.text, tone:"good"};
      }
    };
  });
  opciones.push({
    label:"Descanso activo, sin entrenar nada puntual", sub:`Físico +${Math.round(15+bonus*2)} · sin riesgo`,
    resolve:pl=>{pl.fisico=clamp(pl.fisico+Math.round(15+bonus*2),0,pl.fisicoMax);return{text:"Llegás fresco al arranque de temporada, aunque sin mejoras técnicas puntuales.",tone:"neutral"};}
  });
  setScreen(`
    <div class="card">
      <span class="tag">Pretemporada</span>
      <h2>¿En qué enfocás la pretemporada?</h2>
      ${scoreboardHtml(p)}
      <p class="small">Este año se te ofrecen estas opciones (van rotando temporada a temporada). Elegí en base a lo que más te convenga.</p>
      <div class="choices">
        ${opciones.map((c,i)=>`<button class="choice" data-idx="${i}">${c.label}<small>${c.sub}</small></button>`).join('')}
      </div>
      <button class="primary ghost" id="backToHubBtn" style="margin-top:10px;">« Volver, cambiar de estrategia</button>
    </div>
  `);
  document.querySelectorAll('[data-idx]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!yearState.snapshotTaken){
        p.prevSnapshot = snapshotStats(p);
        yearState.snapshotTaken = true;
        // Recién ACÁ se compromete la temporada de verdad: el ranking "rolling" arranca en cero.
        // Antes esto pasaba apenas se elegía una estrategia (en startYear), lo que dejaba al hub
        // mostrando un ranking viejo/inconsistente si el jugador volvía atrás sin haber entrenado
        // todavía (bug #2). A partir de este punto ya no hay forma de volver al hub hasta finishYear().
        p.puntos = 0;
      }
      const idx = parseInt(btn.dataset.idx);
      const result = opciones[idx].resolve(p);
      recalcNivel(p);
      renderOutcome(result, ()=>maybeRenderFlavorEvent());
    });
  });
  document.getElementById('backToHubBtn').addEventListener('click', renderHub);
}

function maybeRenderFlavorEvent(){
  if(yearState.specialEventType === 'prensa'){ renderPressConference(); return; }
  if(yearState.specialEventType === 'doping'){ renderDopingEvent(); return; }
  if(yearState.specialEventType === 'soborno'){ renderSobornoEvent(); return; }
  if(Math.random() < 0.55){ renderEventCard(); }
  else { checkMidSeasonInjuryThenPlay(); }
}

function checkMidSeasonInjuryThenPlay(){
  const p = G.player;
  // Riesgo bajado ~15% (a pedido del usuario, sesión de "menos frustrante"): base 0.13→0.11,
  // denominador del componente por físico bajo 85→100 (techo baja de +0.59 a +0.50), multiplicador
  // por edad 0.013→0.011, y techo del clamp 0.55→0.48. Mismo criterio que en STAT_TRAINING_OPTIONS
  // y en el evento de pretemporada — no es un cambio grande, solo afloja la frecuencia general.
  const riskBajoFisico = p.fisico < 50 ? (50-p.fisico)/100 : 0; // hasta +0.50 con físico muy bajo
  const riskEdad = p.edad >= 26 ? (p.edad-26)*0.011 : 0;
  // Si ya tuviste la molestia de pretemporada y decidiste "jugar igual, con precaución" sin que se
  // agravara ahí mismo, quedás jugando con más cuidado el resto del año: un 25% menos de riesgo en
  // este chequeo general de temporada (antes, "esquivar" la molestia no influía en nada más).
  const factorCuidado = yearState.cuidadoExtraPretemporada ? 0.75 : 1;
  const chanceLesion = clamp((0.11 + riskBajoFisico + riskEdad) * (1-fisioInjuryReduction(p)) * factorCuidado * highFisicoProtection(p.fisico), 0, 0.48);
  if(!yearState.injuryNote && Math.random() < chanceLesion && yearState.calendario.length>2){
    yearState.hadInjury = true;
    // la mayoría de las lesiones son leves, hay una porción moderada, y muy esporádicamente una grave o gravísima
    const roll = Math.random();
    const jugados = roll<0.55 ? 6+Math.floor(Math.random()*2)      // leve: perdés 1-2
                  : roll<0.82 ? 4+Math.floor(Math.random()*2)      // moderada: perdés 3-4
                  : roll<0.95 ? 2+Math.floor(Math.random()*2)      // grave: perdés 5-6
                  : Math.floor(Math.random()*2);                    // gravísima (rara): perdés 6-8
    yearState.calendario = yearState.calendario.slice(0, Math.min(jugados, yearState.calendario.length));
    if(yearState.calendario.length === 0) yearState.sinJugarPorLesion = true;
    const perdidos = 8 - yearState.calendario.length;
    p.fisico = clamp(p.fisico - (perdidos<=2?8:perdidos<=4?14:22), 0, p.fisicoMax);
    yearState.injuryNote = yearState.calendario.length === 0
      ? `Sufriste una lesión grave que te obligó a bajarte de toda la temporada (no pudiste jugar ningún torneo).`
      : perdidos<=2
        ? `Sufriste una lesión durante la temporada y te perdiste ${perdidos} torneo${perdidos===1?'':'s'} (jugaste ${yearState.calendario.length} de 8 previstos).`
        : `Sufriste una lesión durante la temporada y tuviste que bajarte del resto del calendario (jugaste ${yearState.calendario.length} de 8 torneos previstos).`;
    setScreen(`
      <div class="card">
        <span class="tag">Imprevisto</span>
        <h2>Lesión durante la temporada</h2>
        <div class="outcome bad">🩹 ${yearState.injuryNote}</div>
        <button class="primary" id="contBtn">Continuar</button>
      </div>
    `);
    document.getElementById('contBtn').addEventListener('click', runSeason);
  } else {
    runSeason();
  }
}

function renderEventCard(){
  const p = G.player;
  const ev = G.yearEvents.length ? G.yearEvents.shift() : buildEventPool(p)[0];
  if(!G.yearEvents.length) G.yearEvents = shuffle(buildEventPool(p));
  setScreen(`
    <div class="card">
      <span class="tag">${ev.tag}</span>
      <h2>${ev.title}</h2>
      ${scoreboardHtml(p)}
      <p>${ev.text}</p>
      <div class="choices">
        ${ev.choices.map((c,i)=>{
          const label = typeof c.label==='function' ? c.label(p) : c.label;
          const sub = typeof c.sub==='function' ? c.sub(p) : c.sub;
          const cost = c.cost ? c.cost(p) : 0;
          const noAlcanza = cost>0 && p.dinero<cost;
          return `<button class="choice" data-idx="${i}" ${noAlcanza?'disabled':''}>${label}<small>${sub}${noAlcanza?' — no te alcanza la plata':''}</small></button>`;
        }).join('')}
      </div>
    </div>
  `);
  document.querySelectorAll('[data-idx]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.dataset.idx);
      const result = ev.choices[idx].resolve(p);
      recalcNivel(p);
      renderOutcome(result, ()=>checkMidSeasonInjuryThenPlay());
    });
  });
}

function recalcNivel(p){ p.nivel = Math.round((p.saque+p.potencia+p.movilidad+p.tecnica+p.mental)/5); }

// Guarda, para una edad (temporada) y categoría puntuales, el resultado de un torneo/evento —
// usado por la pantalla "Torneos disputados" (renderTorneosDisputados). `categoria` es uno de
// 'gs'/'m1000' (key = nombre de la sede), 'atpFinals' (key fija 'unico') o 'nacional' (key
// 'davis'/'jjoo'). Si nunca se llama para una combinación edad+categoria+key, la pantalla lo
// interpreta como "no participó" (NP) — no hace falta un valor explícito para eso.
function registrarTorneoAnio(p, edad, categoria, key, valor){
  p.torneosPorAnio = p.torneosPorAnio || {};
  p.torneosPorAnio[edad] = p.torneosPorAnio[edad] || {};
  p.torneosPorAnio[edad][categoria] = p.torneosPorAnio[edad][categoria] || {};
  p.torneosPorAnio[edad][categoria][key] = valor;
}
// Abrevia la ronda alcanzada en un torneo de eliminación directa (Grand Slam / Masters 1000), para
// mostrarla en el casillero de la pantalla "Torneos disputados". `totalRounds` es tier.points.length.
function roundCodeAbbrev(ronda, totalRounds, campeon){
  if(campeon) return 'Campeón';
  if(ronda===0) return '1R';
  const distFromFinal = totalRounds - (ronda+1);
  if(distFromFinal===0) return 'Final';
  if(distFromFinal===1) return 'SF';
  if(distFromFinal===2) return '4tos';
  if(distFromFinal===3) return '8vos';
  if(distFromFinal===4) return '16vos';
  if(distFromFinal===5) return '32vos';
  if(distFromFinal===6) return '2R';
  return `${ronda+1}R`;
}

function renderOutcome(result, onContinue){
  setScreen(`
    <div class="card">
      <span class="tag">Resultado</span>
      <div class="outcome ${result.tone}">${result.text}</div>
      <button class="primary" id="contBtn">Continuar</button>
    </div>
  `);
  document.getElementById('contBtn').addEventListener('click', onContinue);
}

function runSeason(){
  const p = G.player;
  // Fase 1: recorremos TODO el calendario. Los torneos de categoría suficiente (peso >=2) que
  // llegan a jugar su final quedan "pendientes" sin resolver esa última ronda todavía, en vez de
  // cortar la simulación ahí mismo — así, si este año llegás a más de una final, podemos elegir
  // la más importante para el evento interactivo de match point (ver resolvePendingFinals) en vez
  // de quedarnos automáticamente con la primera que aparece en el orden del calendario.
  const pendingFinals = [];
  while(yearState.idx < yearState.calendario.length){
    const entry = yearState.calendario[yearState.idx];
    // El match point ahora es un evento INDEPENDIENTE de prensa/doping/soborno (antes competían
    // por el mismo cupo "1 evento especial por año" y, si ya había tocado uno de esos tres, la
    // final se resolvía sola sin la decisión interactiva ni los minijuegos). Regla actual: si la
    // temporada tiene una final (en un tier de peso>=2), SIEMPRE hay evento de match point, haya
    // habido o no otro evento especial antes ese mismo año.
    const puedeQuedarPendiente = entry.tier.weight>=2;
    const res = simulateTournament(p, entry, puedeQuedarPendiente);
    yearState.idx++;
    if(res.pending){
      pendingFinals.push(res);
    } else {
      yearState.results.push(res);
      const nutriRecLevel = (p.itemLevels && p.itemLevels.nutri) || 0;
      p.fisico = clamp(p.fisico + 4 + shopCumulativeEffect(18,10,nutriRecLevel)*0.55, 0, p.fisicoMax);
    }
  }
  resolvePendingFinals(pendingFinals);
}

// Resuelve las finales que quedaron pendientes de la fase 1 de runSeason(). El match point es
// GARANTIZADO si hubo al menos una final ese año (independiente de si ya tocó prensa/doping/
// soborno como evento especial): la final MÁS IMPORTANTE (mayor peso de categoría) de las que se
// llegó a jugar es la que se presenta como match point interactivo (texto o minijuego, según
// G.minijuegosOn); el resto de las finales pendientes de ESE MISMO año (si hubo más de una) se
// resuelven automáticamente con la misma probabilidad que cualquier otra ronda del torneo (ver
// finalizeAutoFinal) — nunca hay más de un evento de match point por temporada.
function resolvePendingFinals(pendingFinals){
  const p = G.player;
  if(!pendingFinals.length){ finishYear(); return; }
  let interactiveIdx = -1;
  if(!yearState.interactiveUsed){
    interactiveIdx = 0;
    for(let i=1;i<pendingFinals.length;i++){
      if(pendingFinals[i].tier.weight > pendingFinals[interactiveIdx].tier.weight) interactiveIdx = i;
    }
  }
  pendingFinals.forEach((pf,i)=>{
    if(i===interactiveIdx) return;
    const res = finalizeAutoFinal(p, pf);
    yearState.results.push(res);
    const nutriRecLevel = (p.itemLevels && p.itemLevels.nutri) || 0;
    p.fisico = clamp(p.fisico + 4 + shopCumulativeEffect(18,10,nutriRecLevel)*0.55, 0, p.fisicoMax);
  });
  if(interactiveIdx>=0){
    yearState.interactiveUsed = true;
    yearState.pendingFinal = pendingFinals[interactiveIdx];
    renderMatchPoint(pendingFinals[interactiveIdx]);
  } else {
    finishYear();
  }
}

// Resuelve automáticamente (sin decisión interactiva) la ronda final de un torneo que se llegó a
// jugar, con la misma fórmula de probabilidad que se usa para cualquier otra ronda del certamen
// (chanceForRound) — el mismo cálculo que se habría usado si nunca hubiera quedado "pendiente".
function finalizeAutoFinal(player, pf){
  const tier = pf.tier;
  const totalRounds = tier.points.length;
  const chance = chanceForRound(player, tier, pf.roundsWon);
  const gano = Math.random() < chance;
  const ronda = gano ? totalRounds : totalRounds-1;
  return finalizeTournamentResult(player, pf.entry, ronda);
}

/* =========================================================
   DECISIÓN INTERACTIVA: PUNTO DE PARTIDO EN LA FINAL
========================================================= */
function renderMatchPoint(res){
  const p = G.player;
  // En Grand Slam, el rival sale del sorteo restringido a candidatos que realmente podrían haber
  // ganado el torneo (ver pickGrandSlamRival) — necesario porque si el jugador pierde, ESE rival
  // pasa a ser el campeón oficial de la sede (ver finalizeTournamentResult). Para el resto de las
  // categorías se sigue usando pickPlausibleRival, sin cambios.
  const rival = res.tier.id==='gs' ? pickGrandSlamRival() : pickPlausibleRival(TIER_TOUGHNESS[res.tier.weight]);
  const rivalTxt = rival ? `${rival.nombre} (${flagImg(rival.pais,14)})` : "tu rival";
  if(!G.minijuegosOn){
    if(Math.random() < 0.5){ renderMatchPointFavor(res, rival, rivalTxt); }
    else { renderMatchPointContra(res, rival, rivalTxt); }
    return;
  }
  // Con minijuegos activados: 20% match point a favor, 20% en contra (igual que siempre),
  // 60% repartido en partes iguales (20% c/u) entre los 3 minijuegos.
  const roll = Math.random();
  if(roll < 0.2){ renderMatchPointFavor(res, rival, rivalTxt); }
  else if(roll < 0.4){ renderMatchPointContra(res, rival, rivalTxt); }
  else if(roll < 0.6){ renderMinigameTiming(res, rival, rivalTxt); }
  else if(roll < 0.8){ renderMinigameRally(res, rival, rivalTxt); }
  else { renderMinigameMovRally(res, rival, rivalTxt); }
}

// Cierra el match point cuando lo resolvió un minijuego (en vez de una de las decisiones
// interactivas de siempre): ganar el minijuego equivale a ganar la final, perderlo a ser
// subcampeón — misma lógica de puntos/premio/fama que renderMatchPointFavor/Contra. Acá NO se
// vuelve a mostrar el texto de resultado (a diferencia de Favor/Contra): el minijuego ya lo
// mostró en su propia pantalla vía showMinigameOutcome(), así que pasamos directo a finishYear().
function resolveMatchPointResult(res, rival, gano, text){
  const p = G.player;
  const ronda = gano ? res.tier.points.length : res.tier.points.length-1;
  const final = finalizeTournamentResult(p, res.entry, ronda, rival);
  yearState.results.push(final);
  const nutriRecLevel = (p.itemLevels && p.itemLevels.nutri) || 0;
  p.fisico = clamp(p.fisico + 4 + shopCumulativeEffect(18,10,nutriRecLevel)*0.55, 0, p.fisicoMax);
  finishYear();
}

// Muestra el resultado de un minijuego EN LA MISMA PANTALLA (con el track/pointer/pips ya
// congelados en su posición final, para que se vea cuán cerca o lejos estuvo) y espera un click
// en "Continuar" antes de recién ahí pasar a la pantalla de resultado del torneo. Antes se
// saltaba directo a la pantalla siguiente apenas terminaba el minijuego, sin dar tiempo a ver
// el detalle de dónde había quedado el puntero.
function showMinigameOutcome(gano, text, onContinue){
  const slot = document.getElementById('mgOutcomeSlot');
  if(!slot){ onContinue(); return; }
  slot.innerHTML = `
    <div class="outcome ${gano?'good':'bad'}">${text}</div>
    <button class="primary" id="mgContinueBtn">Continuar</button>
  `;
  document.getElementById('mgContinueBtn').addEventListener('click', onContinue, {once:true});
}

function renderMatchPointFavor(res, rival, rivalTxt){
  const p = G.player;
  setScreen(`
    <div class="card">
      <span class="tag">Momento decisivo</span>
      <h2>Match point — Final de ${res.entry.nombre}</h2>
      <p>Estás sacando para ganarle la final a <b>${rivalTxt}</b>. Adivina bien tus patrones. ¿A dónde tirás el saque?</p>
      <div class="choices">
        <button class="choice" data-opt="cuerpo">Saque al cuerpo<small>Más seguro, apoyado en tu técnica.</small></button>
        <button class="choice" data-opt="abierto">Saque abierto, buscando el ángulo<small>Apoyado en tu movilidad para la definición posterior.</small></button>
        <button class="choice" data-opt="ace">Ace arriesgado a la línea<small>Todo o nada, depende de tu saque.</small></button>
      </div>
    </div>
  `);
  document.querySelectorAll('[data-opt]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const opt = btn.dataset.opt;
      let chance, statUsada;
      if(opt==="cuerpo"){ chance = 0.45 + (p.tecnica-50)/220; statUsada="técnica"; }
      else if(opt==="abierto"){ chance = 0.4 + (p.movilidad-50)/200; statUsada="movilidad"; }
      else { chance = 0.35 + (p.saque-50)/150; statUsada="saque"; }
      chance = clamp(chance,0.15,0.85);
      const gano = Math.random() < chance;
      const ronda = gano ? res.tier.points.length : res.tier.points.length-1;
      const final = finalizeTournamentResult(p, res.entry, ronda, rival);
      yearState.results.push(final);
      const nutriRecLevel = (p.itemLevels && p.itemLevels.nutri) || 0;
      p.fisico = clamp(p.fisico + 4 + shopCumulativeEffect(18,10,nutriRecLevel)*0.55, 0, p.fisicoMax);
      const text = gano
        ? `¡Convertiste el match point con un ${opt==='ace'?'ace':'saque'} clave apoyado en tu ${statUsada}! Le ganaste la final a ${rivalTxt}.`
        : `${rival?rival.nombre:'Tu rival'} llegó a devolver y te quebró el ritmo. Terminás subcampeón de ${res.entry.nombre}, pero fue una gran temporada.`;
      renderOutcome({text, tone: gano?"good":"neutral"}, ()=>finishYear());
    });
  });
}

function renderMatchPointContra(res, rival, rivalTxt){
  const p = G.player;
  setScreen(`
    <div class="card">
      <span class="tag">Momento decisivo</span>
      <h2>Match point en contra — Final de ${res.entry.nombre}</h2>
      <p><b>${rivalTxt}</b> saca para quedarse con el título. Tenés que adivinar y defender bien para forzar otra chance. ¿Cómo te parás?</p>
      <div class="choices">
        <button class="choice" data-opt="profundo">Defender profundo y seguro<small>Apoyado en tu movilidad para llegar a todo.</small></button>
        <button class="choice" data-opt="passing">Buscar un passing agresivo apenas devolvés<small>Apoyado en tu potencia.</small></button>
        <button class="choice" data-opt="anticipar">Anticipar el saque y salir a la red<small>Todo o nada, depende de tu mental.</small></button>
      </div>
    </div>
  `);
  document.querySelectorAll('[data-opt]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const opt = btn.dataset.opt;
      let chance, statUsada;
      if(opt==="profundo"){ chance = 0.42 + (p.movilidad-50)/220; statUsada="movilidad"; }
      else if(opt==="passing"){ chance = 0.38 + (p.potencia-50)/200; statUsada="potencia"; }
      else { chance = 0.33 + (p.mental-50)/150; statUsada="mental"; }
      chance = clamp(chance,0.12,0.82);
      const salvaste = Math.random() < chance;
      // si salvás el match point, seguís peleando el partido y terminás ganando la final; si no, cae ahí mismo
      const ronda = salvaste ? res.tier.points.length : res.tier.points.length-1;
      const final = finalizeTournamentResult(p, res.entry, ronda, rival);
      yearState.results.push(final);
      const nutriRecLevel = (p.itemLevels && p.itemLevels.nutri) || 0;
      p.fisico = clamp(p.fisico + 4 + shopCumulativeEffect(18,10,nutriRecLevel)*0.55, 0, p.fisicoMax);
      const text = salvaste
        ? `¡Salvaste el match point apoyado en tu ${statUsada}! Le diste vuelta el partido y le ganaste la final a ${rivalTxt}.`
        : `${rival?rival.nombre:'Tu rival'} definió el punto y se quedó con el título. Terminás subcampeón de ${res.entry.nombre}, pero fue una gran temporada.`;
      renderOutcome({text, tone: salvaste?"good":"neutral"}, ()=>finishYear());
    });
  });
}

/* =========================================================
   MINIJUEGOS DE MATCH POINT (opcionales, "Jugar con mini-juegos")
   Adaptados de minijuegos-atp.html: acá no hay slider de prueba,
   usan la stat real del jugador, y son binarios (ganás el punto
   o no) porque siempre están resolviendo la final del torneo.
========================================================= */

// Minijuego 1: barra de timing (saque). Frenar el puntero en la zona verde = ganás el punto.
function renderMinigameTiming(res, rival, rivalTxt){
  const p = G.player;
  setScreen(`
    <div class="card">
      <span class="tag">Momento decisivo</span>
      <h2>Match point — Final de ${res.entry.nombre}</h2>
      <p>Se define con un saque. Tocá la pista (o apretá la barra espaciadora) en el momento justo. Tenés <b>3 segundos</b> para sacar.</p>
      <div class="timing-track" id="mgTrack">
        <div class="timing-zone" id="mgZone"></div>
        <div class="timing-pointer" id="mgPointer"></div>
      </div>
      <p class="small" id="mgTimeLeft" style="margin-top:-8px;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--purple-dark);">⏱ 3.0s</p>
      <div id="mgOutcomeSlot"></div>
      <button class="primary" id="mgPlayBtn">Sacar</button>
    </div>
  `);
  const track = document.getElementById('mgTrack');
  const zone = document.getElementById('mgZone');
  const pointer = document.getElementById('mgPointer');
  const playBtn = document.getElementById('mgPlayBtn');
  const timeLeftText = document.getElementById('mgTimeLeft');

  let raf=null, running=false, pos=0, dir=1;
  // La velocidad ahora se expresa en %/segundo REAL, no en %/frame. Antes (`pos += dir*2.15` en
  // cada callback de requestAnimationFrame) la velocidad quedaba atada a cuántos frames por
  // segundo dibuja el monitor: a 60Hz se veía bien, pero en un monitor de 144Hz/240Hz
  // requestAnimationFrame se dispara 2-4x más seguido y el puntero corría 2-4x más rápido,
  // arruinando el minijuego. El valor de abajo (2.15*60) está calibrado para que en un monitor de
  // 60Hz el movimiento se vea EXACTAMENTE igual que antes — el fix es transparente ahí.
  const SPEED_PCT_PER_SEC = 2.15*60;
  const TIME_LIMIT_MS = 3000;
  let timeoutId=null, roundStart=0, zoneInfo=null, resolved=false, lastTickTime=0;

  function layoutZone(){
    const sEff = clamp(p.saque, 50, 99);
    // Zona ensanchada de 5-9% a 7-10% (a pedido del usuario: costaba mucho acertar, sobre todo
    // con niveles de saque bajos, donde antes la zona era más angosta).
    const zoneWidthPct = 7 + (sEff-50)/49*3; // 7% (saque 50) a 10% (saque 99)
    const zoneCenter = 8 + Math.random()*84;
    zone.style.left = (zoneCenter-zoneWidthPct/2)+'%';
    zone.style.width = zoneWidthPct+'%';
    return {zoneCenter, zoneWidthPct};
  }
  function tick(now){
    // now llega automáticamente si el llamado vino de requestAnimationFrame; si vino del llamado
    // manual inicial en start() (sin argumento), lo resolvemos con performance.now(). En el
    // primerísimo frame de la ronda no hay "cuadro anterior" con el que calcular un delta real,
    // así que ese frame no mueve el puntero (dt=0) — evita un salto gigante al arrancar.
    now = now || performance.now();
    const dt = lastTickTime ? (now-lastTickTime)/1000 : 0;
    lastTickTime = now;
    pos += dir*SPEED_PCT_PER_SEC*dt;
    if(pos>=100){ pos=100; dir=-1; }
    if(pos<=0){ pos=0; dir=1; }
    pointer.style.left = pos+'%';
    const remaining = clamp((TIME_LIMIT_MS-(performance.now()-roundStart))/1000, 0, TIME_LIMIT_MS/1000);
    timeLeftText.textContent = `⏱ ${remaining.toFixed(1)}s`;
    raf = requestAnimationFrame(tick);
  }
  function start(){
    running=true; pos=0; dir=1; resolved=false; lastTickTime=0;
    zoneInfo = layoutZone();
    playBtn.disabled = true;
    playBtn.textContent = 'Sacando...';
    roundStart = performance.now();
    tick();
    timeoutId = setTimeout(()=>{ if(running) finish(false); }, TIME_LIMIT_MS);
  }
  function finish(gano){
    if(resolved) return;
    resolved = true; running=false;
    cancelAnimationFrame(raf);
    clearTimeout(timeoutId);
    track.removeEventListener('click', clickHandler);
    document.removeEventListener('keydown', spaceHandler);
    playBtn.style.display = 'none';
    if(gano) registerMinigameWin(p, 'timing');
    const text = gano
      ? `¡Clavaste el saque justo donde buscabas! Le ganaste la final a ${rivalTxt}.`
      : `${rival?rival.nombre:'Tu rival'} llega a devolver y te quiebra el ritmo. Terminás subcampeón de ${res.entry.nombre}, pero fue una gran temporada.`;
    showMinigameOutcome(gano, text, ()=>resolveMatchPointResult(res, rival, gano, text));
  }
  function clickHandler(){
    if(!running || !zoneInfo) return;
    const distFromCenter = Math.abs(pos-zoneInfo.zoneCenter);
    finish(distFromCenter <= zoneInfo.zoneWidthPct/2);
  }
  function spaceHandler(e){
    if(e.code==='Space' && running){ e.preventDefault(); clickHandler(); }
  }
  track.addEventListener('click', clickHandler);
  document.addEventListener('keydown', spaceHandler);
  playBtn.addEventListener('click', start);
}

// Minijuego 2: QTE de rally (movilidad). Hay que acertar 4 golpes seguidos dentro de una ventana
// de tiempo; un solo fallo corta el intercambio. Ganar los 4 = ganás el punto.
function renderMinigameRally(res, rival, rivalTxt){
  const p = G.player;
  const ARROWS = {izq:'◀', centro:'●', der:'▶'};
  const dirs = ['izq','centro','der'];
  setScreen(`
    <div class="card">
      <span class="tag">Momento decisivo</span>
      <h2>Match point — Final de ${res.entry.nombre}</h2>
      <p>Se define en un rally largo. Anticipá los 4 golpes: tocá la dirección correcta antes de que se acabe el tiempo. ¡Atento al último, que es un remate más rápido que los anteriores!</p>
      <div class="rally-pips" id="mgPips"></div>
      <div class="rally-timerbar"><div class="rally-timerfill" id="mgTimerFill"></div></div>
      <div class="rally-stage"><div class="rally-cue" id="mgCue">◀</div></div>
      <div class="rally-controls">
        <button class="rally-btn" data-dir="izq" disabled>◀</button>
        <button class="rally-btn" data-dir="centro" disabled>●</button>
        <button class="rally-btn" data-dir="der" disabled>▶</button>
      </div>
      <div id="mgOutcomeSlot"></div>
      <button class="primary" id="mgPlayBtn">Jugar el punto</button>
    </div>
  `);
  const pipsEl = document.getElementById('mgPips');
  const cue = document.getElementById('mgCue');
  const timerFill = document.getElementById('mgTimerFill');
  const rallyBtns = document.querySelectorAll('.rally-btn');
  const playBtn = document.getElementById('mgPlayBtn');

  function buildPips(n){ pipsEl.innerHTML = Array.from({length:n}).map(()=>`<div class="pip"></div>`).join(''); }
  function setPip(i,cls){ const el = pipsEl.children[i]; if(el) el.classList.add(cls); }
  function setButtonsEnabled(enabled){ rallyBtns.forEach(b=>{ b.disabled = !enabled; }); }

  const sEff = clamp(p.movilidad, 50, 99);
  let baseWindowMs;
  if(sEff<=75){ baseWindowMs = 730 + (sEff-50)/25*190; } // 730ms (mov. 50) a 920ms (mov. 75)
  else { baseWindowMs = 920 + (sEff-75)/24*30; }          // 920ms (mov. 75) a 950ms (mov. 99)

  let sequence = Array.from({length:4}).map(()=>dirs[Math.floor(Math.random()*3)]);
  let idx=0, timerRaf=null, waitingInput=false, windowStart=0, windowMs=900, resolved=false;
  const CLICK_GRACE_MS = 90;

  buildPips(4);
  playBtn.addEventListener('click', ()=>{
    playBtn.disabled = true;
    playBtn.style.display = 'none';
    nextCue();
  });

  function nextCue(){
    if(idx>=sequence.length){ finish(true); return; }
    const decayPerStep = [1, 0.86, 0.74, 0.50];
    windowMs = baseWindowMs*decayPerStep[idx];
    const dir = sequence[idx];
    cue.textContent = ARROWS[dir];
    cue.classList.remove('show'); void cue.offsetWidth; cue.classList.add('show');
    waitingInput = true;
    setButtonsEnabled(true);
    windowStart = performance.now();
    animateTimer();
  }
  function animateTimer(){
    cancelAnimationFrame(timerRaf);
    function step(now){
      const elapsed = now-windowStart;
      const pct = clamp(1-elapsed/windowMs,0,1);
      timerFill.style.transform = `scaleX(${pct})`;
      if(elapsed >= windowMs+CLICK_GRACE_MS && waitingInput){ registerResult(false); return; }
      if(waitingInput) timerRaf = requestAnimationFrame(step);
    }
    timerRaf = requestAnimationFrame(step);
  }
  function registerResult(ok){
    waitingInput=false; setButtonsEnabled(false); cancelAnimationFrame(timerRaf);
    setPip(idx, ok?'hit':'miss'); idx++;
    cue.classList.remove('show');
    if(!ok){ finish(false); return; }
    setTimeout(nextCue,260);
  }
  function finish(gano){
    if(resolved) return; resolved=true;
    if(!gano){ for(let i=idx;i<sequence.length;i++) setPip(i,'skip'); }
    else { registerMinigameWin(p, 'rally'); }
    const text = gano
      ? `¡Anticipaste los 4 golpes y cerraste el punto con un winner! Le ganaste la final a ${rivalTxt}.`
      : `Fallaste un golpe clave y ahí se cortó el intercambio. ${rival?rival.nombre:'Tu rival'} se queda con el punto. Terminás subcampeón de ${res.entry.nombre}, pero fue una gran temporada.`;
    showMinigameOutcome(gano, text, ()=>resolveMatchPointResult(res, rival, gano, text));
  }
  rallyBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{ if(!waitingInput) return; registerResult(btn.dataset.dir===sequence[idx]); });
  });
}

// Minijuego 3: rally de movimiento (técnica). El puntero rebota sin parar; hay que tocar la
// pista cada vez que pasa por la zona verde, 5 tiros seguidos contra un reloj total. Un fallo
// (o que se acabe el tiempo) corta el intercambio.
function renderMinigameMovRally(res, rival, rivalTxt){
  const p = G.player;
  // Cantidad de tiros del intercambio, según la categoría del torneo que se está definiendo (a
  // pedido del usuario: 5 tiros fijos resultaba muy exigente/largo para muchos jugadores). Grand
  // Slam y Masters 1000 (los dos tiers más altos, weight 8 y 7) piden 4 tiros; el resto de las
  // categorías que llegan a tener match point/minijuegos (ATP 500, ATP 250, Challenger 175/125 e
  // ITF M25 — el ITF M15 no llega a tener minijuegos, ver el chequeo `weight>=2` en runSeason())
  // piden 3. Nunca hay 5 tiros en ningún caso.
  const TOTAL_SHOTS = res.tier.weight >= 7 ? 4 : 3;
  setScreen(`
    <div class="card">
      <span class="tag">Momento decisivo</span>
      <h2>Match point — Final de ${res.entry.nombre}</h2>
      <p>Se define en un intercambio largo. Tocá la pista cada vez que el puntero pase por la zona verde. Tenés que conectar <b>${TOTAL_SHOTS} tiros seguidos</b> contra el reloj.</p>
      <div class="rally-pips" id="mgPips"></div>
      <div class="rally-timerbar"><div class="rally-timerfill" id="mgTimerFill"></div></div>
      <div class="timing-track" id="mgTrack">
        <div class="timing-zone" id="mgZone"></div>
        <div class="timing-pointer" id="mgPointer"></div>
      </div>
      <div id="mgOutcomeSlot"></div>
      <button class="primary" id="mgPlayBtn">Jugar el punto</button>
    </div>
  `);
  const pipsEl = document.getElementById('mgPips');
  const track = document.getElementById('mgTrack');
  const zone = document.getElementById('mgZone');
  const pointer = document.getElementById('mgPointer');
  const timerFill = document.getElementById('mgTimerFill');
  const playBtn = document.getElementById('mgPlayBtn');

  let pos=0, dir=1;
  // Mismo fix que en el minijuego de timing: velocidad expresada en %/segundo REAL en vez de
  // %/frame, para que no dependa del refresh rate del monitor (antes corría 2-4x más rápido en
  // monitores de 144Hz/240Hz). Calibrado con 2.05*60 para que en 60Hz se vea igual que antes.
  const SPEED_PCT_PER_SEC = 2.05*60;
  let running=false, moveRaf=null, timerRaf=null, resolved=false, lastMoveTickTime=0;
  let shotsTaken=0, zoneCenter=50;

  const sEff = clamp(p.tecnica, 50, 99);
  const zoneWidthPct = 9 + (sEff-50)/49*6; // 9% (técnica 50) a 15% (técnica 99)
  const totalMs = 4600 + (sEff-50)/49*900; // 4.6s (técnica 50) a 5.5s (técnica 99)
  let roundStart = 0;

  function buildPips(){ pipsEl.innerHTML = Array.from({length:TOTAL_SHOTS}).map(()=>`<div class="pip"></div>`).join(''); }
  function setPip(i,cls){ const el = pipsEl.children[i]; if(el) el.classList.add(cls); }
  function placeZone(){
    zoneCenter = 8 + Math.random()*84;
    zone.style.left = (zoneCenter-zoneWidthPct/2)+'%';
    zone.style.width = zoneWidthPct+'%';
  }
  function moveTick(now){
    // Mismo patrón que en el minijuego de timing: now llega solo si vino de requestAnimationFrame;
    // si vino del llamado manual inicial (sin argumento) lo resolvemos con performance.now(), y el
    // primer frame de la ronda no mueve el puntero (dt=0) para no pegar un salto al arrancar.
    now = now || performance.now();
    const dt = lastMoveTickTime ? (now-lastMoveTickTime)/1000 : 0;
    lastMoveTickTime = now;
    pos += dir*SPEED_PCT_PER_SEC*dt;
    if(pos>=100){ pos=100; dir=-1; }
    if(pos<=0){ pos=0; dir=1; }
    pointer.style.left = pos+'%';
    if(running) moveRaf = requestAnimationFrame(moveTick);
  }
  function timerTick(now){
    const elapsed = now-roundStart;
    const pct = clamp(1-elapsed/totalMs,0,1);
    timerFill.style.transform = `scaleX(${pct})`;
    if(pct<=0){ endRound('timeout'); return; }
    if(running) timerRaf = requestAnimationFrame(timerTick);
  }
  function registerSwing(){
    if(!running) return;
    const distFromCenter = Math.abs(pos-zoneCenter);
    const ok = distFromCenter <= zoneWidthPct/2;
    setPip(shotsTaken, ok?'hit':'miss');
    shotsTaken++;
    if(!ok){ endRound('miss'); return; }
    if(shotsTaken>=TOTAL_SHOTS){ endRound('win'); return; }
    placeZone();
  }
  function endRound(status){
    if(resolved) return; resolved=true;
    running=false;
    cancelAnimationFrame(moveRaf);
    cancelAnimationFrame(timerRaf);
    for(let i=shotsTaken;i<TOTAL_SHOTS;i++) setPip(i, status==='timeout'?'miss':'skip');
    track.removeEventListener('click', registerSwing);
    const gano = status==='win';
    if(gano) registerMinigameWin(p, 'movrally');
    const text = gano
      ? `¡Punto redondo! Conectaste los ${TOTAL_SHOTS} tiros y le ganaste la final a ${rivalTxt}.`
      : status==='timeout'
        ? `El reloj te ganó antes de completar el intercambio. Terminás subcampeón de ${res.entry.nombre}, pero fue una gran temporada.`
        : `Fallaste un tiro y ahí se cortó el intercambio. ${rival?rival.nombre:'Tu rival'} se queda con el punto. Terminás subcampeón de ${res.entry.nombre}, pero fue una gran temporada.`;
    showMinigameOutcome(gano, text, ()=>resolveMatchPointResult(res, rival, gano, text));
  }
  buildPips();
  track.addEventListener('click', registerSwing);
  playBtn.addEventListener('click', ()=>{
    playBtn.disabled = true;
    playBtn.style.display = 'none';
    running = true;
    lastMoveTickTime = 0;
    placeZone();
    roundStart = performance.now();
    moveTick();
    timerRaf = requestAnimationFrame(timerTick);
  });
}

/* =========================================================
   CONFERENCIA DE PRENSA
========================================================= */
const PRESS_QUESTIONS = [
  { pregunta: `"¿Cómo ves tu nivel esta temporada?"`,
    opciones: [
      {opt:"humilde", label:"Responder con humildad, bajando el perfil", textos:{buena:"Tu humildad cae genial en la sala: la prensa destaca tu perfil bajo.", mala:"Tu humildad se lee como falta de confianza, y algunos títulos te tratan de 'tibio'.", neutra:"Tu respuesta pasa sin pena ni gloria, nadie la comenta demasiado."}},
      {opt:"confianza", label:"Responder con confianza, sin vueltas", textos:{buena:"Tu seguridad genera buenos titulares: 'llegó para quedarse'.", mala:"Tu confianza se lee como soberbia, y te cae una ola de críticas.", neutra:"Nadie se sorprende con tu respuesta directa, sigue la conferencia."}},
      {opt:"humor", label:"Desviar el tema con humor", textos:{buena:"El chiste cae bien, la sala se ríe y quedás como una persona cercana.", mala:"El chiste no cae bien en un momento serio, y te lo marcan en las notas.", neutra:"Nadie se ríe demasiado, pero tampoco pasa a mayores."}},
    ]},
  { pregunta: `"¿Qué opinás de tu próximo rival?"`,
    opciones: [
      {opt:"respeto", label:"Elogiarlo con respeto deportivo", textos:{buena:"Tu deportividad genera elogios: 'un profesional ejemplar'.", mala:"Se lee como que ya lo diste por ganador antes de jugar.", neutra:"Una respuesta protocolar más, nadie la destaca."}},
      {opt:"picante", label:"Tirar una frase picante, sin faltar el respeto", textos:{buena:"La frase genera repercusión positiva: le da color a la previa.", mala:"La toman como una provocación innecesaria y te critican.", neutra:"La frase pasa sin generar demasiado ruido."}},
      {opt:"esquivar", label:"No opinar y hablar solo de tu juego", textos:{buena:"Se valora que mantengas el foco en lo tuyo.", mala:"Te acusan de esquivar la pregunta y ser poco frontal.", neutra:"Cambian de tema rápido, sin mayor efecto."}},
    ]},
  { pregunta: `"¿Cómo te llevás con la presión de los resultados?"`,
    opciones: [
      {opt:"abierto", label:"Hablar abiertamente de la presión que sentís", textos:{buena:"Tu sinceridad conecta con la gente, te ven más humano.", mala:"Lo toman como una señal de debilidad mental.", neutra:"Nadie le da demasiada trascendencia al comentario."}},
      {opt:"frio", label:"Minimizarla, mostrarte inquebrantable", textos:{buena:"Proyectás una frialdad que genera admiración.", mala:"Suena poco creíble y te tildan de impostado.", neutra:"Queda como una frase más de conferencia."}},
      {opt:"equipo", label:"Desviar el mérito hacia tu equipo de trabajo", textos:{buena:"Se valora tu generosidad al compartir el crédito.", mala:"Se lee como que estás evitando hacerte cargo.", neutra:"Nadie repara demasiado en la respuesta."}},
    ]},
  { pregunta: `"¿Pensás que podés pelear el número 1 del mundo?"`,
    opciones: [
      {opt:"ambicioso", label:"Decir que sí, sin dudarlo", textos:{buena:"Tu ambición genera un titular potente y motivador.", mala:"Te acusan de sobreestimarte antes de tiempo.", neutra:"Queda como una declaración más, sin gran repercusión."}},
      {opt:"cauto", label:"Bajar la ansiedad, hablar de objetivos paso a paso", textos:{buena:"Se valora tu cabeza fría y tu planificación.", mala:"Te critican por falta de ambición.", neutra:"Nadie le da mucha bola a la respuesta calculada."}},
      {opt:"pregunta", label:"Devolver la pregunta con otra pregunta", textos:{buena:"El recurso cae simpático y alivia la tensión de la sala.", mala:"Lo toman como una evasiva molesta.", neutra:"El periodista sigue con la siguiente pregunta sin más."}},
    ]},
  { pregunta: `"¿Qué le cambiarías al calendario actual del circuito?"`,
    opciones: [
      {opt:"critico", label:"Ser franco: hay demasiados torneos obligatorios", textos:{buena:"Muchos colegas del circuito coinciden en privado, y tu franqueza suma respeto.", mala:"La organización se toma mal la crítica pública y algún medio te pinta de quejoso.", neutra:"El comentario genera un par de titulares chicos, sin mayor repercusión."}},
      {opt:"diplomatico", label:"Responder con diplomacia, sin cuestionar a la organización", textos:{buena:"Tu mesura cae bien entre los organizadores de torneos.", mala:"Te acusan de no querer 'jugarte' por los jugadores.", neutra:"Una respuesta protocolar más que nadie destaca."}},
      {opt:"desviar", label:"Desviar el tema hacia tu propia preparación física", textos:{buena:"Se valora que no entres en polémicas ajenas a tu juego.", mala:"Notan que evitaste la pregunta a propósito.", neutra:"El tema se diluye rápido sin generar ruido."}},
    ]},
  { pregunta: `"Después de esa derrota dura, ¿cómo seguís mentalmente?"`,
    opciones: [
      {opt:"sincero", label:"Admitir que te costó, sin vueltas", textos:{buena:"Tu sinceridad genera empatía y buena prensa.", mala:"Algunos medios lo leen como una grieta mental para explotar.", neutra:"Nadie profundiza demasiado en el comentario."}},
      {opt:"positivo", label:"Enfocarte en lo aprendido, discurso positivo", textos:{buena:"Se destaca tu madurez para procesar una derrota.", mala:"Suena ensayado y poco genuino para algunos periodistas.", neutra:"Queda como una frase de manual más."}},
      {opt:"cortante", label:"Responder cortante, sin dar muchos detalles", textos:{buena:"Se respeta que quieras procesarlo en privado.", mala:"Te tildan de hosco con la prensa.", neutra:"La conferencia sigue sin mayores comentarios."}},
    ]},
  { pregunta: `"¿Tenés algún ritual o superstición antes de un partido importante?"`,
    opciones: [
      {opt:"compartir", label:"Contar tu ritual con lujo de detalle", textos:{buena:"La anécdota genera simpatía y se viraliza en redes.", mala:"Algunos títulos se burlan un poco de la superstición.", neutra:"Genera un par de risas en la sala y nada más."}},
      {opt:"misterio", label:"Responder con humor, sin revelar nada", textos:{buena:"El misterio genera curiosidad positiva sobre vos.", mala:"Lo toman como una respuesta esquiva más.", neutra:"El periodista insiste un poco y después cambia de tema."}},
      {opt:"negar", label:"Decir que no creés en supersticiones", textos:{buena:"Proyectás una imagen racional y centrada que se valora.", mala:"Suena forzado, como si estuvieras posando.", neutra:"Nadie le da mayor trascendencia."}},
    ]},
  { pregunta: `"¿Cómo ves el nivel de las nuevas generaciones que están saliendo?"`,
    opciones: [
      {opt:"elogiar", label:"Elogiar a los jóvenes del circuito sin reservas", textos:{buena:"Tu generosidad con los rivales jóvenes te suma prestigio.", mala:"Algunos lo leen como que ya te sentís de salida.", neutra:"Una respuesta amable que nadie discute demasiado."}},
      {opt:"medido", label:"Reconocer el nivel, pero remarcar que todavía falta experiencia", textos:{buena:"Se valora tu análisis medido y realista.", mala:"Te acusan de subestimar a los que vienen.", neutra:"Pasa sin generar demasiado revuelo."}},
      {opt:"foco", label:"Decir que no le prestás atención a eso, solo a tu juego", textos:{buena:"Se respeta tu concentración total en lo tuyo.", mala:"Suena como una respuesta evasiva y poco cálida.", neutra:"El tema se cierra rápido."}},
    ]},
  { pregunta: `"¿Cómo llevás la vida lejos de casa, con tanta gira?"`,
    opciones: [
      {opt:"abierto", label:"Hablar de lo difícil que es estar tanto tiempo viajando", textos:{buena:"Tu costado humano conecta fuerte con el público.", mala:"Algún medio lo usa para instalar dudas sobre tu compromiso con el circuito.", neutra:"Nadie profundiza mucho en la respuesta."}},
      {opt:"positivo", label:"Destacar lo lindo de conocer el mundo jugando al tenis", textos:{buena:"El enfoque optimista genera buena onda con la prensa.", mala:"Suena poco creíble después de una gira tan larga.", neutra:"Queda como una respuesta más de cortesía."}},
      {opt:"privado", label:"Decir que preferís mantener eso en el ámbito privado", textos:{buena:"Se respeta que marques un límite con clase.", mala:"Te marcan como alguien distante con la prensa.", neutra:"El periodista pasa a la siguiente pregunta sin más."}},
    ]},
];

function renderPressConference(){
  const p = G.player;
  const q = PRESS_QUESTIONS[Math.floor(Math.random()*PRESS_QUESTIONS.length)];
  setScreen(`
    <div class="card">
      <span class="tag">Conferencia de prensa</span>
      <h2>${q.pregunta}</h2>
      <p>Un periodista te tira una pregunta con trampa. Nunca sabés bien qué es lo que quiere escuchar — a veces una respuesta prudente cae bien, a veces se lee como esquiva.</p>
      <div class="choices">
        ${q.opciones.map(o=>`<button class="choice" data-opt="${o.opt}">${o.label}</button>`).join('')}
      </div>
    </div>
  `);
  document.querySelectorAll('[data-opt]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const opt = btn.dataset.opt;
      const roll = Math.random();
      let delta, reaccion;
      // Probabilidades más benévolas a pedido del usuario: 35% buena (+3), 40% neutra (sin
      // cambios), 25% mala (-2, antes era -3) — antes era ~34/33/33 con la mala en -3.
      if(roll<0.35){ delta=3; reaccion="buena"; } else if(roll<0.75){ delta=0; reaccion="neutra"; } else { delta=-2; reaccion="mala"; }
      p.fama = clamp(p.fama+delta, 0, 100);
      const opcionElegida = q.opciones.find(o=>o.opt===opt);
      const cambioTxt = delta>0 ? ` (Fama +${delta})` : delta<0 ? ` (Fama ${delta})` : ` (Fama sin cambios)`;
      const text = opcionElegida.textos[reaccion] + cambioTxt;
      renderOutcome({text, tone: delta>0?"good":delta<0?"bad":"neutral"}, ()=>checkMidSeasonInjuryThenPlay());
    });
  });
}

/* =========================================================
   DOPING (evento raro, riesgo alto)
========================================================= */
function renderDopingEvent(){
  const p = G.player;
  const usos = p.dopingUsos || 0;
  const chance = clamp(0.3 + usos*0.1, 0, 0.8);
  const chancePct = Math.round(chance*100);
  const advertenciaUsos = usos>0 ? ` (ya lo usaste ${usos} ${usos===1?'vez':'veces'} antes en tu carrera, por eso el riesgo subió)` : '';
  setScreen(`
    <div class="card">
      <span class="tag">Zona gris</span>
      <h2>Te ofrecen algo para "ayudarte"</h2>
      <p>Alguien cercano al equipo te sugiere una sustancia para mejorar tu rendimiento esta temporada. Te daría un salto de nivel temporal, pero si te agarran en un control antidopaje las consecuencias son serias.</p>
      <div class="choices">
        <button class="choice" data-opt="si">Aceptar el riesgo<small>+4 de nivel general por esta temporada, pero ${chancePct}% de chance de que te agarren (perdés TODA la temporada y bastante fama)${advertenciaUsos}</small></button>
        <button class="choice" data-opt="no">Rechazar<small>Mental +1</small></button>
      </div>
    </div>
  `);
  document.querySelectorAll('[data-opt]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const opt = btn.dataset.opt;
      if(opt==="no"){
        p.mental = clamp(p.mental+1);
        unlockAchievement(p, 'zona_gris_esquivada');
        renderOutcome({text:"Decidís no arriesgar tu carrera por un atajo. Seguís por las tuyas.", tone:"neutral"}, ()=>checkMidSeasonInjuryThenPlay());
        return;
      }
      const agarrado = Math.random() < chance;
      p.dopingUsos = usos + 1;
      if(agarrado){
        p.dopingAgarradoAlgunavez = true;
        yearState.calendario = [];
        // Misma regla que cuando una lesión te deja sin jugar NINGÚN torneo en el año (ver
        // checkMidSeasonInjuryThenPlay, yearState.sinJugarPorLesion): si tocaba Copa Davis este
        // año, no deberías poder disputarla habiendo perdido toda la temporada por sanción. Antes
        // esto no se marcaba y el relato de finishYear() decía que jugaste igual, aunque hayas
        // perdido el año entero por dar positivo.
        yearState.sinJugarPorDopingSuspension = true;
        yearState.injuryNote = `Diste positivo en un control antidopaje. Sanción: perdiste toda la temporada, y tu imagen quedó muy golpeada.`;
        p.fama = clamp(p.fama-30, 0, 100);
        renderOutcome({text:"Te agarran en el control antidopaje. El escándalo te cuesta la temporada entera y un golpe serio a tu fama.", tone:"bad"}, ()=>checkMidSeasonInjuryThenPlay());
      } else {
        p.nivel = clamp(p.nivel+4);
        p.dopingBonus = (p.dopingBonus||0) + 4;
        unlockAchievement(p, 'doping_impune');
        p.dopingImpuneCount = (p.dopingImpuneCount||0) + 1;
        if(p.dopingImpuneCount>=4 && !p.dopingAgarradoAlgunavez) unlockAchievement(p, 'doping_impune_x4');
        renderOutcome({text:"No te agarran. Jugás la temporada con un salto de nivel que nadie puede explicarte del todo (se va a diluir al terminar el año).", tone:"good"}, ()=>checkMidSeasonInjuryThenPlay());
      }
    });
  });
}

/* =========================================================
   SOBORNO (evento raro, riesgo alto)
========================================================= */
function renderSobornoEvent(){
  const p = G.player;
  const monto = Math.max(50000, Math.round((p.dineroTotalGanado||0)*0.2/1000)*1000);
  setScreen(`
    <div class="card">
      <span class="tag">Zona gris</span>
      <h2>Te ofrecen plata por perder</h2>
      <p>Un contacto poco confiable te ofrece <b>${fmt(monto)}</b> por perder tu próximo partido a propósito. Si te descubren, la sanción es dura.</p>
      <div class="choices">
        <button class="choice" data-opt="si">Aceptar<small>Si no te descubren, cobrás ${fmt(monto)}. 35% de chance de que te descubran: perdés el dinero y 5 torneos del año.</small></button>
        <button class="choice" data-opt="no">Rechazar<small>Mental +1</small></button>
      </div>
    </div>
  `);
  document.querySelectorAll('[data-opt]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const opt = btn.dataset.opt;
      if(opt==="no"){
        p.mental = clamp(p.mental+1);
        unlockAchievement(p, 'zona_gris_esquivada');
        renderOutcome({text:"Rechazás la propuesta sin pensarlo dos veces. Seguís jugando limpio.", tone:"neutral"}, ()=>checkMidSeasonInjuryThenPlay());
        return;
      }
      const descubierto = Math.random() < 0.35;
      if(descubierto){
        const jugados = 3;
        yearState.calendario = yearState.calendario.slice(0, Math.min(jugados, yearState.calendario.length));
        yearState.injuryNote = `Te descubrieron arreglando un partido. Sanción: jugaste ${yearState.calendario.length} de 8 torneos previstos, y tu imagen quedó golpeada.`;
        p.fama = clamp(p.fama-20, 0, 100);
        renderOutcome({text:"Te descubren. El escándalo te cuesta gran parte de la temporada, la fama y no ves un peso del trato.", tone:"bad"}, ()=>checkMidSeasonInjuryThenPlay());
      } else {
        p.dinero += monto; p.dineroTotalGanado = (p.dineroTotalGanado||0) + monto;
        checkMoneyAchievements(p);
        renderOutcome({text:`Nadie sospecha nada. Cobrás ${fmt(monto)}, aunque te queda la sensación incómoda de lo que hiciste.`, tone:"good"}, ()=>checkMidSeasonInjuryThenPlay());
      }
    });
  });
}

/* =========================================================
   CAMPEONES DE GRAND SLAM (registro con nombre real por sede)
   REDISEÑADO esta sesión (segunda vuelta): la versión anterior repartía las sedes de forma
   DETERMINÍSTICA (siempre el #1 del ranking primero, después el #2 si sobraba capacidad, etc.) y
   además siempre en el mismo orden de sedes (Abierto de Australia -> Roland Garros -> Wimbledon ->
   US Open) — eso hacía que el líder del ranking "gastara" su primer cupo de 2000 puntos SIEMPRE en
   el Abierto de Australia, quedando con muchas menos chances en las otras 3 sedes por el mismo
   motivo, año tras año. A pedido del usuario, ahora:
   - El ORDEN en que se resuelven las 4 sedes es AL AZAR cada año (no siempre AO primero).
   - Para cada sede, el campeón sale de una LOTERÍA PONDERADA POR PUNTOS entre TODOS los candidatos
     con capacidad disponible (+2000 puntos, floor(puntos/2000) sedes como máximo) — cuanto más
     arriba en el ranking, más chances, pero NUNCA es obligatorio que gane el mejor ubicado.
========================================================= */

// Determina y registra el campeón de CADA UNA de las 4 sedes de Grand Slam del año (Abierto de
// Australia, Roland Garros, Wimbledon, US Open — el orden de la tabla del historial sigue siendo
// fijo, pero el orden en que se RESUELVEN/sortean es al azar cada año), SIEMPRE las 4, jugado o no
// el jugador ese año. Si el jugador ganó una sede en yearState.results, el campeón registrado es
// el jugador (con sus puntos reales, sin tocar nada) — nunca puede heredar una sede que no ganó de
// verdad. Para las sedes que el jugador no ganó, se sortea entre los NPCs activos con capacidad de
// puntos disponible (ver comentario de arriba). Ningún puntaje se toca salvo en el caso de
// emergencia del final (no debería activarse con el tamaño normal del pool).
function assignGrandSlamChampions(){
  const p = G.player;
  const sedesPool = TIER_BY_ID.gs.pool;
  const misResultadosGS = (yearState.results||[]).filter(r=>r.campeon && r.entry.tier.id==='gs');
  const campeonPts = TIER_BY_ID.gs.points[TIER_BY_ID.gs.points.length-1]; // 2000

  const campeones = new Array(sedesPool.length).fill(null);
  const sedesVacantesIdx = [];
  sedesPool.forEach((sedeNombre, i)=>{
    const ganeYo = misResultadosGS.find(r=>r.entry.nombre===sedeNombre);
    if(ganeYo){
      campeones[i] = { esJugador:true, nombre:p.nombre, pais:p.pais };
      return;
    }
    // Si el jugador PERDIÓ la final de esta sede este año, el rival que le ganó (ya elegido entre
    // candidatos legítimos por pickGrandSlamRival — ver finalizeTournamentResult) queda confirmado
    // directamente como campeón: nunca puede haber otro nombre distinto en el historial. Se le
    // suman los 2000 puntos de campeón (es un resultado real, jugado en cancha, no una suposición
    // — a diferencia del resto de las sedes, que sí se sortean por lotería sin tocar puntos).
    const rivalQueGano = yearState.gsFinalLosses && yearState.gsFinalLosses[sedeNombre];
    if(rivalQueGano){
      rivalQueGano.puntos += campeonPts;
      campeones[i] = { esJugador:false, nombre:rivalQueGano.nombre, pais:rivalQueGano.pais };
      return;
    }
    sedesVacantesIdx.push(i);
  });

  if(sedesVacantesIdx.length){
    // Candidatos elegibles: todo NPC activo con al menos 2000 puntos, con una capacidad inicial de
    // floor(puntos/2000) sedes que puede llegar a ganar este año (4500 puntos = hasta 2, etc.). Se
    // va descontando a medida que se le asignan sedes, en la misma pasada.
    const candidatos = G.pool.filter(x=>!x.retirado && x.puntos>=campeonPts)
      .map(x=>({ npc:x, capacidadRestante: Math.floor(x.puntos/campeonPts) }));

    const sedesEnOrdenAzar = shuffle(sedesVacantesIdx);
    sedesEnOrdenAzar.forEach(sedeIdx=>{
      const elegibles = candidatos.filter(c=>c.capacidadRestante>0);
      if(!elegibles.length) return; // sin candidatos con capacidad: se resuelve en la fase de emergencia
      // Lotería ponderada: los puntos pesan con exponente 2.2 (no lineal, a pedido del usuario —
      // antes un líder con muchos más puntos que el resto igual podía perder la lotería con
      // demasiada frecuencia) y el nivel también pesa aparte (exponente 1.6) — no es lo mismo
      // "puntos" (puede incluir algo de suerte/calendario de la temporada) que "nivel" (la fuerza
      // real del jugador), así que ambos factores se multiplican para que el candidato más fuerte
      // Y mejor posicionado en el ranking domine la lotería, sin que sea 100% obligatorio.
      const pesos = elegibles.map(c=>Math.pow(c.npc.puntos,2.2)*Math.pow(c.npc.nivel,1.6));
      const totalPeso = pesos.reduce((a,b)=>a+b,0);
      let roll = Math.random()*totalPeso;
      let elegido = elegibles[elegibles.length-1];
      for(let i=0;i<elegibles.length;i++){
        roll -= pesos[i];
        if(roll<=0){ elegido = elegibles[i]; break; }
      }
      elegido.capacidadRestante--;
      campeones[sedeIdx] = { esJugador:false, nombre:elegido.npc.nombre, pais:elegido.npc.pais };
    });

    // Fase de emergencia (no debería activarse con el tamaño normal del pool): si quedó alguna sede
    // sin campeón porque se agotó la capacidad de todos los elegibles, se le suman 2000 puntos al
    // mejor ubicado del ranking general que todavía no había llegado a los 2000.
    const sedesSinAsignar = sedesEnOrdenAzar.filter(i=>!campeones[i]);
    if(sedesSinAsignar.length){
      const resto = G.pool.filter(x=>!x.retirado && x.puntos<campeonPts).sort((a,b)=>b.puntos-a.puntos);
      sedesSinAsignar.forEach((sedeIdx,i)=>{
        const npc = resto[i] || resto[resto.length-1];
        if(npc){
          npc.puntos += campeonPts;
          campeones[sedeIdx] = { esJugador:false, nombre:npc.nombre, pais:npc.pais };
        }
      });
    }
  }

  G.grandSlamHistorial = G.grandSlamHistorial || [];
  G.grandSlamHistorial.push({ anio: 2010+p.edad, sedes: sedesPool, campeones });
}

/* =========================================================
   JUEGOS OLÍMPICOS (evento cada 4 temporadas: edades 17/21/25/29/33/37 → años 2028..2048)
   Minijuego de "casilleros" (adaptado de un prototipo aparte): el jugador va revelando 16
   casilleros de victoria/derrota ya sorteados según su NIVEL actual (tabla OLYMPIC_LEVEL_TIERS,
   igual criterio que el resto del juego: más nivel, más casilleros de victoria). El rival que se
   muestra en cada ronda es solo de sabor — sale de una escalera de dificultad creciente entre los
   otros 63 clasificados (el mejor tenista activo de cada país, salvo el del jugador) — pero NUNCA
   influye el resultado real, que ya está definido por el casillero elegido.
========================================================= */
const OLYMPIC_AGES = [17,21,25,29,33,37];
const OLYMPIC_LEVEL_TIERS = [
  {min:95, wins:15, losses:1},
  {min:90, wins:14, losses:2},
  {min:85, wins:13, losses:3},
  {min:80, wins:12, losses:4},
  {min:75, wins:11, losses:5},
  {min:70, wins:10, losses:6},
  {min:65, wins:9,  losses:7},
  {min:0,  wins:8,  losses:8},
];
const OLY_ROUNDS = [
  {id:'r32', name:'32vos de Final'},
  {id:'r16', name:'16vos de Final'},
  {id:'r8',  name:'8vos de Final'},
  {id:'qf',  name:'4tos de Final'},
  {id:'sf',  name:'Semifinal'},
];
const OLY_BRACKET_LABELS = ['32vos','16vos','8vos','4tos','SF','Final/3°'];
// Premios: dinero + fama, en línea con la escala de Copa Davis/ATP Finals. A pedido del usuario,
// la fama de los Juegos Olímpicos NUNCA se resta — solo se suma, cualquiera sea el resultado.
const OLYMPIC_PRIZES = {
  r32:   {dinero:20000,  fama:2},
  r16:   {dinero:35000,  fama:4},
  r8:    {dinero:55000,  fama:6},
  qf:    {dinero:80000,  fama:9},
  fourth:{dinero:120000, fama:14},
  bronze:{dinero:170000, fama:18},
  silver:{dinero:230000, fama:25},
  gold:  {dinero:350000, fama:32},
};
const OLY_MEDAL_INFO = {
  gold:  {emoji:'🥇', label:'Medalla de Oro', tone:'gold'},
  silver:{emoji:'🥈', label:'Medalla de Plata', tone:'silver'},
  bronze:{emoji:'🥉', label:'Medalla de Bronce', tone:'bronze'},
  null:  {emoji:'🎾', label:'Sin medalla', tone:'bad'},
};

function olympicTierForLevel(nivel){
  return OLYMPIC_LEVEL_TIERS.find(t=>nivel>=t.min) || OLYMPIC_LEVEL_TIERS[OLYMPIC_LEVEL_TIERS.length-1];
}
// Arma un mazo de N casilleros (win/loss mezclados) a partir de una cantidad de victorias y
// derrotas — recibe cualquier objeto con .wins/.losses, no necesariamente un tramo completo de
// OLYMPIC_LEVEL_TIERS (ver resolveFirstOlympicCell(), que la llama con el remanente de 15 después
// de resolver el primer casillero aparte).
function buildOlympicCells(tier){
  const pool = [...Array(tier.wins).fill('win'), ...Array(tier.losses).fill('loss')];
  return shuffle(pool).map(result=>({result, revealed:false, score:null}));
}
// Marcador de tenis plausible (al mejor de 3 sets), desde la perspectiva del jugador — solo para
// darle sabor al resultado del casillero, no influye en nada. Ponderado (a pedido del usuario):
// antes los 7 marcadores posibles tenían la misma chance (~14.3% cada uno), y el 6-0 salía
// demasiado seguido para lo poco común que es en la realidad. Ahora el 6-0 pesa 1 contra 2-3 del
// resto — baja de ~14.3% a 1/16=6.25%, menos de la mitad de frecuente, sin desaparecer del todo.
const SET_SCORE_OPTIONS = ['6-0','6-1','6-2','6-3','6-4','7-5','7-6'];
const SET_SCORE_WEIGHTS = [1,2,3,3,3,2,2];
function olyGenSetScore(playerWinsSet){
  const opt = SET_SCORE_OPTIONS[weightedPickIdx(SET_SCORE_WEIGHTS)];
  const [a,b] = opt.split('-').map(Number);
  return playerWinsSet ? `${a}-${b}` : `${b}-${a}`;
}
function olyGenMatchScore(playerWins){
  const straight = Math.random() < 0.62;
  if(straight) return [olyGenSetScore(playerWins), olyGenSetScore(playerWins)].join(', ');
  return [olyGenSetScore(playerWins), olyGenSetScore(!playerWins), olyGenSetScore(playerWins)].join(', ');
}
// Los otros 63 clasificados: el mejor tenista activo de cada país (salvo el del jugador, que se
// resuelve aparte en maybeRunOlympics), ordenados de menor a mayor nivel — así los primeros rivales
// que le tocan al jugador son más flojos, y van subiendo ronda a ronda.
function buildOlympicOpponents(p){
  const oponentes = [];
  COUNTRY_CODES.forEach(code=>{
    if(code===p.pais) return;
    const mejor = paisConvocadosTop3(code, null)[0];
    if(mejor) oponentes.push({ pais:code, nombre:mejor.nombre, nivel:mejor.nivel });
  });
  oponentes.sort((a,b)=>a.nivel-b.nivel);
  return oponentes;
}
function pickOlympicRival(oponentesAsc, roundIndex){
  const n = oponentesAsc.length;
  if(!n) return {pais:G.player.pais, nombre:"Rival desconocido", nivel:50};
  const startIdx = Math.floor(roundIndex*n/6);
  const endIdx = Math.max(startIdx+1, Math.floor((roundIndex+1)*n/6));
  const bucket = oponentesAsc.slice(startIdx, endIdx);
  return bucket[Math.floor(Math.random()*bucket.length)];
}

let OLY = null;
// Evita que el fade-in del .card se dispare de nuevo en CADA ronda de los JJOO (setScreen arma un
// <div class="card"> nuevo por cada render, y por default siempre anima) — solo tiene que animar
// al cambiar de PANTALLA (intro→jugando→resultado), no de ronda a ronda dentro de "jugando".
let olyLastScreenKey = null;
function olyCardClass(screenKey){
  const anim = screenKey !== olyLastScreenKey;
  olyLastScreenKey = screenKey;
  return anim ? 'card' : 'card no-anim';
}

// Punto de entrada, llamado desde finishYear(). Si esta temporada no toca Juegos Olímpicos, o si
// el jugador no fue convocado (no está en el Top 3 de su país), avisa (o no dice nada) y sigue de
// largo. Si corresponde, arranca el minijuego interactivo; `callback` es lo que sigue del cierre
// de temporada (finishYearTail), y se llama recién cuando el evento termina de resolverse.
function maybeRunOlympics(p, trofeosGanadosEsteAnio, bonusEvents, callback){
  const edadTemporada = p.edad-1;
  if(!OLYMPIC_AGES.includes(edadTemporada)){ callback(); return; }
  const anioJJOO = 2010+p.edad;
  const convocados = paisConvocadosTop3(p.pais, p);
  const jugadorClasifica = convocados.some(c=>c.esJugador);
  if(!jugadorClasifica){ registrarTorneoAnio(p, edadTemporada, 'nacional', 'jjoo', 'No convocado'); callback(); return; }
  unlockAchievement(p, 'juegos_olimpicos_participante', edadTemporada);
  startOlympics(p, anioJJOO, (outcome)=>{
    bonusEvents.push(outcome.bonusText);
    if(outcome.medal==='gold') trofeosGanadosEsteAnio.push('jjoo');
    const JJOO_RESULT_ABBR = {r32:'32vos',r16:'16vos',r8:'8vos',qf:'4tos',fourth:'4to',bronze:'🥉 Bronce',silver:'🥈 Plata',gold:'🥇 Oro'};
    registrarTorneoAnio(p, edadTemporada, 'nacional', 'jjoo', JJOO_RESULT_ABBR[outcome.prizeKey] || 'Participó');
    callback();
  });
}

function startOlympics(p, anioJJOO, onDone){
  olyLastScreenKey = null;
  const tier = olympicTierForLevel(p.nivel);
  OLY = {
    anio: anioJJOO, tier,
    // Los 16 casilleros arrancan SIN resultado asignado (antes se armaba el mazo completo acá
    // mismo, con buildOlympicCells(tier)) — ver resolveFirstOlympicCell(): el primer casillero que
    // el jugador toca se resuelve aparte, con protección extra, y el mazo recién se completa
    // después de conocer ese resultado.
    cells: Array.from({length:16}, ()=>({revealed:false, result:null, score:null})),
    firstClickResolved: false,
    roundIdx: 0, mode: 'normal',
    oponentes: buildOlympicOpponents(p),
    rival: null, history: [], pendingFinish: null, onDone,
  };
  OLY.rival = pickOlympicRival(OLY.oponentes, 0);
  renderOlympicsIntro();
}

function olyCurrentRoundName(){
  if(OLY.mode==='final') return 'Final';
  if(OLY.mode==='bronze') return 'Partido por el 3er puesto';
  return OLY_ROUNDS[OLY.roundIdx].name;
}

function renderOlympicsIntro(){
  const p = G.player;
  const cardClass = olyCardClass('intro');
  setScreen(`
    <div class="${cardClass}" style="text-align:center;">
      <span class="tag">Juegos Olímpicos ${OLY.anio}</span>
      <h2>Clasificaste a los Juegos Olímpicos</h2>
      <p>Vas a representar a ${flagImg(p.pais,16)} ${COUNTRY_NAMES[p.pais]} junto a los mejores tenistas de otros 63 países, en busca de la medalla de oro.</p>
      <img src="${wikiImg('Olympic rings without rims.svg',260)}" alt="Aros olímpicos" style="max-width:200px;width:100%;margin:0 auto 16px;display:block;" loading="lazy" onerror="this.style.display='none'">
      <button class="primary" id="startOlyBtn">Comenzar el torneo</button>
    </div>
  `);
  document.getElementById('startOlyBtn').addEventListener('click', renderOlympicsPlaying);
}

function olyBracketTrackHtml(){
  return `<div class="oly-bracketTrack">${OLY_BRACKET_LABELS.map((label,i)=>{
    let stateClass = '';
    if(i===5){
      const h = OLY.history.find(h=>h.round==='Final' || h.round==='Partido por el 3er puesto');
      if(h) stateClass = h.gano ? 'won' : 'lost';
      else if(OLY.mode==='final'||OLY.mode==='bronze') stateClass = 'current';
    } else {
      const roundName = OLY_ROUNDS[i].name;
      const h = OLY.history.find(h=>h.round===roundName);
      if(h) stateClass = h.gano ? 'won' : 'lost';
      else if(OLY.mode==='normal' && OLY.roundIdx===i) stateClass = 'current';
    }
    return `<div class="oly-bstep ${stateClass}">${label}</div>`;
  }).join('')}</div>`;
}

function renderOlympicsPlaying(){
  const cardClass = olyCardClass('playing');
  const cellsHtml = OLY.cells.map((c,i)=>{
    if(c.revealed) return `<button class="oly-cell revealed ${c.result}" disabled>${c.result==='win'?'✅':'❌'}<br>${c.score}</button>`;
    return `<button class="oly-cell ${OLY.pendingFinish?'dim':''}" data-cell="${i}" ${OLY.pendingFinish?'disabled':''}>?</button>`;
  }).join('');
  const outcomeHtml = OLY.pendingFinish ? `<div class="outcome ${OLY.pendingFinish.tone}">${OLY.pendingFinish.text}</div>` : '';
  setScreen(`
    <div class="${cardClass}">
      <span class="tag">${olyCurrentRoundName()} · Juegos Olímpicos ${OLY.anio}</span>
      <h2>Tocá una celda para jugar el partido</h2>
      ${olyBracketTrackHtml()}
      <div class="oly-rivalBox">
        ${flagImg(OLY.rival.pais,22)}
        <div class="info"><b>${OLY.rival.nombre}</b><span>Rival de esta ronda</span></div>
      </div>
      <div class="oly-grid16">${cellsHtml}</div>
      ${outcomeHtml}
      <button class="primary" id="olyFinishBtn" ${OLY.pendingFinish?'':'disabled'}>Finalizar partido</button>
    </div>
  `);
  document.querySelectorAll('[data-cell]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('[data-cell]').forEach(b=>b.disabled=true);
      onOlympicCellClick(parseInt(btn.dataset.cell));
    });
  });
  if(OLY.pendingFinish){
    document.getElementById('olyFinishBtn').addEventListener('click', ()=>{ renderOlympicsResult(OLY.pendingFinish); });
  }
}

// PROTECCIÓN DEL PRIMER CLICK (a pedido del usuario): el primer casillero que el jugador toca en
// toda su ronda de JJOO ese año tiene la MITAD de chance de ser derrota que un casillero cualquiera
// del mazo completo (chance normal = tier.losses/16; acá se juega con tier.losses/32). Recién
// DESPUÉS de conocer ese resultado se arma el resto del mazo (los otros 15 casilleros), descontando
// del pool original la victoria o derrota que ya se consumió en este primer casillero — así el
// total de victorias/derrotas disponibles en la ronda sigue siendo el mismo de siempre (ej. tier
// 12V/4D: si el primer casillero salió victoria, quedan 11V/4D repartidas en los 15 restantes).
function resolveFirstOlympicCell(idx){
  const tier = OLY.tier;
  const lossChance = (tier.losses/16)/2;
  const gano = Math.random() >= lossChance;
  OLY.cells[idx].result = gano ? 'win' : 'loss';
  OLY.firstClickResolved = true;
  const wRestantes = tier.wins - (gano?1:0);
  const lRestantes = tier.losses - (gano?0:1);
  const resto = buildOlympicCells({wins:wRestantes, losses:lRestantes});
  let ri = 0;
  OLY.cells.forEach((c,i)=>{ if(i!==idx){ c.result = resto[ri].result; ri++; } });
}

function onOlympicCellClick(idx){
  const cell = OLY.cells[idx];
  if(cell.revealed) return;
  if(!OLY.firstClickResolved) resolveFirstOlympicCell(idx);
  const gano = cell.result==='win';
  cell.score = olyGenMatchScore(gano);
  cell.revealed = true;
  const roundName = olyCurrentRoundName();
  OLY.history.push({round:roundName, rival:OLY.rival, gano, score:cell.score});

  if(gano){
    if(OLY.mode==='final'){
      settleOlympicOutcome('gold', 'gold', `¡Medalla de oro! Le ganaste la final a ${OLY.rival.nombre} ${flagImg(OLY.rival.pais,12)} por ${cell.score}.`);
    } else if(OLY.mode==='bronze'){
      settleOlympicOutcome('bronze', 'bronze', `¡Medalla de bronce! Le ganaste el partido por el 3er puesto a ${OLY.rival.nombre} ${flagImg(OLY.rival.pais,12)} por ${cell.score}.`);
    } else if(OLY.roundIdx === OLY_ROUNDS.length-1){
      OLY.mode = 'final';
      OLY.rival = pickOlympicRival(OLY.oponentes, 5);
      renderOlympicsPlaying();
    } else {
      OLY.roundIdx++;
      OLY.rival = pickOlympicRival(OLY.oponentes, OLY.roundIdx);
      renderOlympicsPlaying();
    }
  } else {
    if(OLY.mode==='final'){
      settleOlympicOutcome('silver', 'silver', `Medalla de plata: perdiste la final ante ${OLY.rival.nombre} ${flagImg(OLY.rival.pais,12)} por ${cell.score}.`);
    } else if(OLY.mode==='bronze'){
      settleOlympicOutcome('fourth', null, `4to puesto, sin medalla: perdiste el partido por el bronce ante ${OLY.rival.nombre} ${flagImg(OLY.rival.pais,12)} por ${cell.score}.`);
    } else if(OLY.roundIdx === OLY_ROUNDS.length-1){
      OLY.mode = 'bronze';
      OLY.rival = pickOlympicRival(OLY.oponentes, 5);
      renderOlympicsPlaying();
    } else {
      settleOlympicOutcome(OLY_ROUNDS[OLY.roundIdx].id, null, `Eliminado en ${OLY_ROUNDS[OLY.roundIdx].name.toLowerCase()} ante ${OLY.rival.nombre} ${flagImg(OLY.rival.pais,12)} por ${cell.score}.`);
    }
  }
}

// Aplica la recompensa (dinero + fama, nunca negativa) apenas se conoce el resultado definitivo,
// y arma el texto que va a quedar en el resumen de temporada. Recién al tocar "Finalizar partido" /
// "Continuar" se avanza de pantalla — así se alcanza a ver la última celda revelada.
function settleOlympicOutcome(prizeKey, medal, text){
  const p = G.player;
  const prize = OLYMPIC_PRIZES[prizeKey];
  p.dinero += prize.dinero;
  p.dineroTotalGanado = (p.dineroTotalGanado||0) + prize.dinero;
  checkMoneyAchievements(p, p.edad-1);
  p.fama = clamp(p.fama + prize.fama);
  let tone = medal==='gold' ? 'gold' : medal==='silver' ? 'silver' : medal==='bronze' ? 'bronze' : (prizeKey==='fourth' ? 'neutral' : 'bad');
  if(medal) unlockAchievement(p, 'juegos_olimpicos_medalla', p.edad-1);

  let bonusText;
  if(medal==='gold'){
    p.titulos++;
    unlockAchievement(p, 'primer_titulo', p.edad-1);
    unlockAchievement(p, 'juegos_olimpicos_oro', p.edad-1);
    checkTitleCountAchievements(p, p.edad-1);
    checkAgeTitleAchievements(p, p.edad-1);
    p.olimpicoOro = true;
    checkSuperCareerSlam(p, p.edad-1);
    p.titulosList = p.titulosList || [];
    p.titulosList.push({ edad: p.edad-1, tier: "Juegos Olímpicos", tierWeight: 8.5, sede: `${OLY.anio}`, rivalNombre: OLY.rival.nombre, rivalPais: OLY.rival.pais });
    bonusText = `🥇 ¡Ganaste la medalla de <b>oro</b> en los Juegos Olímpicos de ${OLY.anio}, representando a ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]}!`;
  } else if(medal==='silver'){
    p.finales++;
    bonusText = `🥈 Jugaste los Juegos Olímpicos de ${OLY.anio} representando a ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]} y te llevaste la medalla de <b>plata</b>.`;
  } else if(medal==='bronze'){
    bonusText = `🥉 Jugaste los Juegos Olímpicos de ${OLY.anio} representando a ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]} y te llevaste la medalla de <b>bronce</b>.`;
  } else if(prizeKey==='fourth'){
    bonusText = `🎽 Jugaste los Juegos Olímpicos de ${OLY.anio} representando a ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]} y terminaste 4to, sin medalla.`;
  } else {
    bonusText = `🎽 Jugaste los Juegos Olímpicos de ${OLY.anio} representando a ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]}. ${text.replace(/^Eliminado/, 'Fuiste eliminado')}`;
  }

  OLY.pendingFinish = { tone, text, medal, bonusText, prizeKey };
  renderOlympicsPlaying();
}

function renderOlympicsResult(outcome){
  const cardClass = olyCardClass('result');
  const medal = OLY_MEDAL_INFO[outcome.medal || 'null'];
  const historyHtml = OLY.history.map(h=>`
    <div class="outcome ${h.gano?'good':'bad'}" style="margin-bottom:6px;padding:8px 10px;">
      <b>${h.round}</b> vs ${h.rival.nombre} ${flagImg(h.rival.pais,12)} — ${h.gano?'Ganaste':'Perdiste'} ${h.score}
    </div>`).join('');
  setScreen(`
    <div class="${cardClass}">
      <span class="tag">Juegos Olímpicos ${OLY.anio} — Resultado final</span>
      <div class="oly-medalHero">
        <div class="oly-medalEmoji">${medal.emoji}</div>
        <div class="oly-medalLabel">${medal.label}</div>
      </div>
      <div class="outcome ${medal.tone}">${outcome.text}</div>
      <h3>Recorrido</h3>
      ${historyHtml}
      <button class="primary" id="olyContinueBtn" style="margin-top:10px;">Continuar</button>
    </div>
  `);
  document.getElementById('olyContinueBtn').addEventListener('click', ()=>{
    const onDone = OLY.onDone;
    const finalOutcome = { medal: outcome.medal, bonusText: outcome.bonusText, prizeKey: outcome.prizeKey };
    OLY = null;
    onDone(finalOutcome);
  });
}

/* =========================================================
   CIERRE DE AÑO
========================================================= */
function finishYear(){
  const p = G.player;
  seasonPreroll = null; // se resetea acá: la próxima temporada vuelve a sortear stats ofrecidas + evento especial
  p.dopingBonus = 0; // el bonus de doping es solo por esta temporada
  if(!yearState.hadInjury) unlockAchievement(p, 'temporada_sin_lesion');
  if(yearState.hadInjury) p.tuvoLesionAlguna = true;
  // Cupo anual de campeones de Grand Slam: 4 en total, descontando los que ya ganaste vos esta
  // temporada. Mezclamos el orden del pool para que el reparto de los cupos restantes entre los
  // NPCs no dependa de en qué posición del array les toca simularse.
  const misGSGanados = (yearState && yearState.results ? yearState.results : []).filter(r=>r.campeon && r.entry.tier.id==='gs').length;
  gsSlotsRestantes = Math.max(0, 4 - misGSGanados);
  // Acumula qué trofeos "grandes" (Grand Slam / ATP Finals / Copa Davis) ganó el JUGADOR esta
  // temporada, para mostrarlos juntos en la pantalla de celebración al final de finishYear() — ver
  // renderTrophyCelebration() y TROFEO_INFO. Los Grand Slam se detectan acá porque ya se resolvieron
  // durante la temporada (yearState.results); ATP Finals y Copa Davis se agregan más abajo, en sus
  // respectivos bloques, porque recién se resuelven en esta misma función.
  const trofeosGanadosEsteAnio = [];
  (yearState.results||[]).filter(r=>r.campeon && r.entry.tier.id==='gs').forEach(r=>{
    const idx = TIER_BY_ID.gs.pool.indexOf(r.entry.nombre);
    const keysGS = ['gs_au','gs_rg','gs_wim','gs_uso'];
    if(idx>=0) trofeosGanadosEsteAnio.push(keysGS[idx]);
  });
  G.pool = shuffle(G.pool);
  // Recalcular NPCs existentes, sumar nuevos que debutan, edad y ranking
  G.pool.forEach(simulateNPCSeason);
  replenishPool(G.pool);
  p.edad++;
  applyAgingToPlayer(p);
  assignGrandSlamChampions(); // se llama ANTES de recalcular el ranking, para que el piso de puntos del campeón ya quede reflejado
  p.fama = clamp(p.fama - 3); // la fama decae sola si no la sostenés con resultados
  const rkPrev = p.ranking;
  const rk = buildRankingList(p, G.pool);
  p.ranking = rk.ranking;

  const bonusEvents = [];

  // ATP Finals: top 8
  // Premio subido (antes 180k/70k) para reflejar que en la realidad el ATP Finals paga a la par
  // o incluso más que un Grand Slam. Los PUNTOS se dejaron igual (400/200): a diferencia del dinero,
  // acá sí importa la comparación con los rivales del top 8 — como estimateNPCPoints() nunca simula
  // el ATP Finals para los NPCs (ver esa función), si el jugador ganara muchos puntos extra ahí se
  // despegaría del resto del top 8 sin que ellos tengan la misma oportunidad de compensarlo.
  // Los 8 clasificados reales (mismo corte de ranking de puntos que decide si el JUGADOR entra),
  // mapeados a un formato común {nombre,pais,nivel,isPlayer} para el fixture — se arma SIEMPRE,
  // clasifique o no el jugador ese año, mismo criterio que Copa Davis (ver buildAtpFinalsBracket).
  const atpTop8 = rk.list.slice(0,8).map(x=>({
    nombre: x.esJugador ? p.nombre : x.nombre,
    pais: x.pais, nivel: x.nivel, isPlayer: !!x.esJugador,
  }));
  let etapaJugadorAtpFinals = null; // se completa más abajo si el jugador clasificó (p.ranking<=8)
  if(p.ranking<=8){
    unlockAchievement(p, 'atp_finals_clasif', p.edad-1);
    // Formato real: fase de grupos (2 grupos de 4, todos contra todos) → semifinal → final. No es
    // un cuadro de eliminación directa desde el arranque, por eso no hay "octavos/cuartos" como en
    // Copa Davis. ANTES esto era un único sorteo binario que siempre garantizaba llegar como mínimo
    // a la final (pagaba y sumaba puntos de subcampeón en la derrota), pero el texto decía por error
    // "Llegaste a semifinales" — quedaba inconsistente con `p.finales++` (que sí contaba como
    // finalista). Ahora hay 3 etapas reales, con su propia chance de quedar afuera en cada una.
    const chanceGrupo = clamp(0.5 + (p.nivel-70)/130, 0.15, 0.85);
    const avanzaGrupo = Math.random() < chanceGrupo;
    let etapa, premio, puntosGanados;
    if(!avanzaGrupo){
      etapa = "grupos"; premio = 60000; puntosGanados = 100;
      p.fama = clamp(p.fama + 4);
    } else {
      const chanceSemi = clamp(0.45 + (p.nivel-70)/120, 0.15, 0.85);
      const ganaSemi = Math.random() < chanceSemi;
      if(!ganaSemi){
        etapa = "semis"; premio = 130000; puntosGanados = 200;
        p.fama = clamp(p.fama + 10);
      } else {
        const chanceFinal = clamp(0.3 + (p.nivel-70)/120, 0.1, 0.75);
        const ganaFinal = Math.random() < chanceFinal;
        if(ganaFinal){
          etapa = "campeon"; premio = 350000; puntosGanados = 400;
          p.fama = clamp(p.fama + 15);
        } else {
          etapa = "subcampeon"; premio = 220000; puntosGanados = 300;
          p.fama = clamp(p.fama + 12);
        }
      }
    }
    p.dinero += premio; p.dineroTotalGanado = (p.dineroTotalGanado||0) + premio;
    checkMoneyAchievements(p, p.edad-1);
    p.puntos += puntosGanados;
    if(etapa==="campeon"){
      p.titulos++;
      unlockAchievement(p, 'primer_titulo', p.edad-1);
      unlockAchievement(p, 'ganar_atp_finals', p.edad-1);
      checkTitleCountAchievements(p, p.edad-1);
      checkAgeTitleAchievements(p, p.edad-1);
      p.atpFinalsGanado = true;
      checkBigFour(p, p.edad-1);
      checkSuperSlam(p, p.edad-1);
      checkSuperCareerSlam(p, p.edad-1);
      trofeosGanadosEsteAnio.push('finals');
      p.titulosList.push({ edad: p.edad-1, tier: "ATP Finals", tierWeight: 7.5, sede: "Turín", rivalNombre: null, rivalPais: null });
      // "Rey de Turín" (a pedido del usuario): mismo mecanismo que "Rey de <ciudad>" para el resto
      // de las categorías (ver titulosPorSede en finalizeTournamentResult) — acá se replica a mano
      // porque el ATP Finals no pasa por esa función, se resuelve aparte en finishYear(). Única
      // sede posible para esta categoría (Turín), así que no hace falta variar el nombre del logro.
      p.titulosPorSede = p.titulosPorSede || {};
      const sedeKeyFinals = 'finals::Turín';
      p.titulosPorSede[sedeKeyFinals] = (p.titulosPorSede[sedeKeyFinals]||0) + 1;
      if(p.titulosPorSede[sedeKeyFinals] === 4){
        unlockDynamicAchievement(p, 'rey_'+sedeKeyFinals.replace(/[^a-zA-Z0-9]+/g,'_'), {
          icon:'🤴', name:'Rey de Turín',
          desc:'Ganaste el ATP Finals en Turín 4 veces a lo largo de tu carrera.',
          tier: 3
        }, p.edad-1);
      }
    } else if(etapa==="subcampeon"){
      p.finales++;
    }
    const ATP_FINALS_ABBR = {grupos:'Grupos', semis:'SF', subcampeon:'Final', campeon:'Campeón'};
    registrarTorneoAnio(p, p.edad-1, 'atpFinals', 'unico', ATP_FINALS_ABBR[etapa]);
    const etapaTexto = etapa==="grupos" ? "Quedaste eliminado en la fase de grupos."
      : etapa==="semis" ? "Caíste en semifinales."
      : etapa==="subcampeon" ? "Fuiste subcampeón."
      : "¡Lo ganaste!";
    bonusEvents.push(`🏟️ Clasificaste al <b>ATP Finals</b> por terminar entre los 8 mejores del año. ${etapaTexto} (+${fmt(premio)})`);
    etapaJugadorAtpFinals = etapa;
  }
  yearState.atpFinalsFixture = buildAtpFinalsBracket(atpTop8, etapaJugadorAtpFinals);

  // Copa Davis: se arma el cuadro COMPLETO de 16 selecciones todos los años (buildDavisCupBracket),
  // juegue el jugador o no — así se puede mostrar el fixture entero desde el resumen de temporada
  // con el botón "Copa Davis". La convocatoria a la selección SIEMPRE son los 3 tenistas de mayor
  // nivel del país (paisConvocadosTop3) — antes dependía de estar entre los 3 mejores por PUNTOS y
  // de tener ranking ≤400, lo cual podía dejar afuera al mejor tenista real del país si otro tenía
  // más puntos acumulados ese año. Que el país después clasifique o no al cuadro de 16 sigue
  // dependiendo del nivel real del equipo (computeDavisTop16), eso no cambió.
  const davisFixture = buildDavisCupBracket(p);
  yearState.davisFixture = davisFixture;
  // Registro año a año para "Historial de Copa Davis" (pestaña nueva en Ranking de Selecciones):
  // se guarda SIEMPRE, jugado o no el jugador ese año, con el mismo criterio que el fixture completo
  // de arriba. El "año" mostrado arranca en 2026 para la Temporada 1 (p.edad ya está incrementado
  // en este punto de finishYear(), así que 2010+p.edad da el año correcto) — es solo un envoltorio
  // de ambientación, no se le explica al jugador la equivalencia real temporada↔año (no hace falta).
  // Semifinalistas = los 2 perdedores de la ronda "Semifinal" (penúltima); no hay partido por el
  // tercer puesto en Copa Davis, así que quedan empatados en ese lugar, como en la realidad.
  const davisFinalMatch = davisFixture.rounds[davisFixture.rounds.length-1].matches[0];
  const davisSubcampeon = davisFinalMatch.winner===davisFinalMatch.aCode ? davisFinalMatch.bCode : davisFinalMatch.aCode;
  const davisSemifinalistas = davisFixture.rounds[davisFixture.rounds.length-2].matches.map(m => m.winner===m.aCode ? m.bCode : m.aCode);
  p.copaDavisHistorial = p.copaDavisHistorial || [];
  p.copaDavisHistorial.push({ anio: 2010+p.edad, campeon: davisFixture.champion, subcampeon: davisSubcampeon, semifinalistas: davisSemifinalistas, fixture: davisFixture });
  const convocados = paisConvocadosTop3(p.pais, p);
  const jugadorConvocado = convocados.some(c=>c.esJugador);
  if(jugadorConvocado) unlockAchievement(p, 'davis_convocado', p.edad-1);
  const paisEnCuadro = davisFixture.rounds[0].matches.some(m=>m.aCode===p.pais || m.bCode===p.pais);
  if(!jugadorConvocado){
    registrarTorneoAnio(p, p.edad-1, 'nacional', 'davis', 'No convocado');
  } else if(!paisEnCuadro){
    registrarTorneoAnio(p, p.edad-1, 'nacional', 'davis', 'No clasificó');
  }
  if(jugadorConvocado && paisEnCuadro){
    const companerosTxt = convocados.filter(c=>!c.esJugador).map(c=>c.nombre).join(" y ") || "un equipo de compañeros del circuito";

    const rondasDavis = ["los Octavos de final","los Cuartos de final","la Semifinal","la Final"];
    const path = findCountryDavisPath(davisFixture, p.pais);
    const rondaDavis = path.rondasGanadas;
    const campeonDavis = davisFixture.champion === p.pais;
    const paisRival = path.rivales[path.rivales.length-1];
    // Suspensión por doping: a diferencia de una lesión (donde seguís "convocado" al equipo aunque
    // no hayas jugado ningún torneo), estar suspendido por doping te deja afuera de TODO lo que
    // pueda ganarse ese año con la Copa Davis — a pedido explícito del usuario. Ni título, ni logro,
    // ni premio en dinero, ni fama, sin importar cómo le haya ido a tu selección. Se define ACÁ
    // (antes que el cálculo de premio/fama, que antes se aplicaba siempre) para poder anularlos.
    const sinJugarPorDoping = !!yearState.sinJugarPorDopingSuspension;
    const premio = sinJugarPorDoping ? 0 : (campeonDavis ? 200000 : 60000 + rondaDavis*20000);
    if(premio>0){ p.dinero += premio; p.dineroTotalGanado = (p.dineroTotalGanado||0) + premio; }
    if(!sinJugarPorDoping) p.fama = clamp(p.fama + (campeonDavis?22:8+rondaDavis*4));
    checkMoneyAchievements(p, p.edad-1);
    // Si la selección sale campeona en el mismo año en que te agarraron con doping, NO se te
    // otorga el título de Copa Davis ni ninguno de los logros asociados (davis_campeon,
    // primer_titulo, Big Four, título precoz/veterano, el conteo de títulos totales), aunque el
    // equipo haya ganado de verdad.
    if(campeonDavis && !sinJugarPorDoping){
      p.titulos++;
      unlockAchievement(p, 'primer_titulo', p.edad-1);
      checkTitleCountAchievements(p, p.edad-1);
      unlockAchievement(p, 'davis_campeon', p.edad-1);
      checkBigFour(p, p.edad-1);
      checkSuperSlam(p, p.edad-1);
      checkSuperCareerSlam(p, p.edad-1);
      checkAgeTitleAchievements(p, p.edad-1);
      trofeosGanadosEsteAnio.push('davis');
      p.titulosList.push({ edad: p.edad-1, tier: "Copa Davis", tierWeight: 7.2, sede: COUNTRY_NAMES[p.pais], rivalNombre: null, rivalPais: null, companeros: companerosTxt });
    } else if(!campeonDavis && rondaDavis === rondasDavis.length-1){
      p.finales++;
    }

    let relato;
    const sinJugarPorLesion = !!yearState.sinJugarPorLesion;
    // Mismo criterio que la lesión: si diste positivo y perdiste toda la temporada, no deberías
    // poder disputar la Copa Davis ese año — se usa un texto propio (sanción, no lesión) para no
    // mezclar los dos motivos. Ambos flags son mutuamente excluyentes en la práctica (si te
    // suspendieron por doping el calendario ya quedó vacío antes de que pudiera activarse el
    // chequeo de lesión de mitad de temporada), pero por las dudas se chequean por separado.
    const noPudoJugar = sinJugarPorLesion || sinJugarPorDoping;
    const motivoNoJugar = sinJugarPorDoping ? "por estar cumpliendo la sanción de doping" : "por lesión";
    {
      const rondasDavisCod = ['8vos','4tos','SF','Final'];
      let davisResultado;
      if(sinJugarPorDoping) davisResultado = 'Sanción';
      else if(sinJugarPorLesion) davisResultado = 'Lesión';
      else if(campeonDavis) davisResultado = 'Campeón';
      else davisResultado = rondasDavisCod[path.eliminadoEnRonda] || '—';
      registrarTorneoAnio(p, p.edad-1, 'nacional', 'davis', davisResultado);
    }
    if(campeonDavis){
      relato = noPudoJugar
        ? `🏳️ Fuiste convocado a la Copa Davis con ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]} pero no pudiste jugar ${motivoNoJugar}. Igual, tu equipo se consagró campeón, dejando en el camino a ${flagImg(paisRival,14)} ${COUNTRY_NAMES[paisRival]} en la final.`
        : `🏳️ ¡Ganaste la <b>Copa Davis</b> con ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]}! Jugaste junto a ${companerosTxt}, y en la final dejaron en el camino a ${flagImg(paisRival,14)} ${COUNTRY_NAMES[paisRival]}.`;
    } else {
      // OJO: la ronda donde caíste NO es "rondaDavis-1" (cantidad de rondas ganadas) — eso apunta a
      // la ronda ANTERIOR a la derrota. La ronda real de la eliminación es path.eliminadoEnRonda,
      // el índice que devuelve findCountryDavisPath(). Bug corregido: antes decía, por ejemplo,
      // "cayeron en semifinales" cuando en realidad la derrota fue en la final.
      const rondaPerdidaNombre = rondasDavis[path.eliminadoEnRonda];
      relato = noPudoJugar
        ? `🏳️ Fuiste convocado a la Copa Davis con ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]} pero no pudiste jugar ${motivoNoJugar}. Tu equipo llegó hasta ${rondaPerdidaNombre} y perdió ante ${flagImg(paisRival,14)} ${COUNTRY_NAMES[paisRival]}.`
        : `🏳️ Jugaste la <b>Copa Davis</b> con ${flagImg(p.pais,14)} ${COUNTRY_NAMES[p.pais]} junto a ${companerosTxt}. Llegaste hasta ${rondaPerdidaNombre} y perdiste ante ${flagImg(paisRival,14)} ${COUNTRY_NAMES[paisRival]}.`;
    }
    bonusEvents.push(relato);
  }

  // Juegos Olímpicos: evento interactivo (necesita clicks del usuario), así que acá se corta el
  // flujo sincrónico de finishYear() — el resto del cierre de temporada (sponsors, ranking final,
  // logros de racha de títulos, historial, pantalla de celebración/resumen) se movió a
  // finishYearTail(), que maybeRunOlympics() llama recién cuando el evento se resolvió (o de
  // inmediato si ese año no tocaban Juegos Olímpicos, o si tocaban pero el jugador no fue convocado).
  maybeRunOlympics(p, trofeosGanadosEsteAnio, bonusEvents, ()=>{
    finishYearTail(p, trofeosGanadosEsteAnio, bonusEvents, rkPrev);
  });
}

function finishYearTail(p, trofeosGanadosEsteAnio, bonusEvents, rkPrev){
  // Sponsors activos: cobran su cuota anual y se les descuenta un año de contrato
  p.sponsors = p.sponsors || [];
  p.sponsors.forEach(s=>{ p.dinero += s.anual; p.dineroTotalGanado = (p.dineroTotalGanado||0) + s.anual; s.years--; });
  checkMoneyAchievements(p, p.edad-1);
  p.sponsors = p.sponsors.filter(s=>s.years>0);

  // Nuevas ofertas de sponsor, según fama (con buena fama puede haber más de una oferta el mismo año)
  const repLevel = p.itemLevels.representante || 0;
  p.pendingSponsorOffers = [];
  const maxSponsors = 4;
  let maxOffers = p.fama>=85 ? 4 : p.fama>=60 ? 3 : p.fama>=35 ? 2 : 1;
  for(let i=0;i<maxOffers;i++){
    if(p.fama>=15 && Math.random()<(0.35+shopCumulativeEffect(5,7,repLevel)*0.06) && (p.sponsors.length+p.pendingSponsorOffers.length)<maxSponsors){
      const yaComprometidas = new Set([...p.sponsors.map(s=>s.brand.name), ...p.pendingSponsorOffers.map(o=>o.brand.name)]);
      const disponibles = SPONSOR_BRANDS.filter(b=>!yaComprometidas.has(b.name));
      if(!disponibles.length) break; // no quedan marcas nuevas disponibles este año
      const brand = disponibles[Math.floor(Math.random()*disponibles.length)];
      const years = 2+Math.floor(Math.random()*3);
      // +12% general sobre TODO lo que ofrecen los sponsors (de una sesión anterior) + un +10%
      // ADICIONAL de esta sesión (a pedido del usuario, "aumentar un 10% todo lo que pagan los
      // sponsors en cualquier nivel y momento del juego") — se combinan en un solo multiplicador
      // (1.12*1.10=1.232) para no tener dos números sueltos haciendo lo mismo. Se aplica siempre,
      // para cualquier nivel de fama, en cualquier momento de la carrera, tengas o no representante
      // contratado. Como la negociación ("pedir más plata") multiplica sobre este monto ya con el
      // +23.2% adentro, el beneficio se mantiene también si después negociás una oferta. Solo afecta
      // ofertas NUEVAS a partir de ahora — no reajusta contratos ya firmados.
      const anual = Math.round((1200 + p.fama*220 + Math.random()*1500) * (1+shopCumulativeEffect(5,7,repLevel)*0.09) * 1.232);
      p.pendingSponsorOffers.push({brand, years, anual});
    }
  }

  yearState.bonusEvents = bonusEvents;
  yearState.rkPrev = rkPrev;

  // Recalculamos el ranking una vez más acá, porque ATP Finals pudo sumar puntos después del cálculo inicial
  const rkFinal = buildRankingList(p, G.pool);
  p.ranking = rkFinal.ranking;
  p.bestRanking = Math.min(p.bestRanking, p.ranking);
  p.bestNivel = Math.max(p.bestNivel, p.nivel);
  if(p.ranking<=100) unlockAchievement(p, 'primer_top100', p.edad-1);
  if(p.ranking<=10) unlockAchievement(p, 'top10', p.edad-1);
  if(p.ranking===1){
    unlockAchievement(p, 'numero1_mundo', p.edad-1);
    if(!p.logros.primera_compra_tienda) unlockAchievement(p, 'numero1_sin_comprar', p.edad-1);
  }

  // Racha de títulos en la misma temporada: todos los títulos ganados este año (torneos normales,
  // ATP Finals, Copa Davis) quedan en titulosList con la misma "edad jugada" (player.edad para los
  // normales, p.edad-1 para Finals/Davis porque esos bloques corren después de p.edad++ — ambos
  // representan la edad durante ESTA temporada, así que son directamente comparables).
  const edadTemporada = p.edad-1;
  const titulosEstaTemporada = (p.titulosList||[]).filter(t=>t.edad===edadTemporada).length;
  if(titulosEstaTemporada>=3) unlockAchievement(p, 'racha_titulos_temporada', edadTemporada);
  if(titulosEstaTemporada>=5) unlockAchievement(p, 'temporada_perfecta', edadTemporada);
  const gsEstaTemporada = (p.titulosList||[]).filter(t=>t.edad===edadTemporada && t.tier==="Grand Slam").length;
  if(gsEstaTemporada>=4) unlockAchievement(p, 'calendario_gs_real', edadTemporada);

  p.historial.push({
    edad: p.edad-1,
    ranking: p.ranking,
    rankingPrev: rkPrev,
    nivel: p.nivel,
    torneos: [...yearState.results].sort((a,b)=>b.entry.tier.weight-a.entry.tier.weight).map(r=>({ tier: r.entry.tier.name, sede: r.entry.nombre, etiqueta: r.etiqueta, puntos: r.puntos, premio: r.premio })),
    injuryNote: yearState.injuryNote,
    bonusEvents: bonusEvents,
    titulosAcum: p.titulos,
    dinero: p.dinero,
  });
  if(p.historial.length>=5) checkCleanSeasonsAchievements(p, edadTemporada);

  G.screen="summary";
  // Si este año se ganó algún Grand Slam, el ATP Finals o la Copa Davis, se muestra primero la
  // pantalla de celebración con el/los trofeo(s) — recién al tocar "Seguir adelante" se pasa al
  // resumen de temporada de siempre. Si no se ganó nada de eso, va directo al resumen (sin cambios).
  if(trofeosGanadosEsteAnio.length){
    renderTrophyCelebration(trofeosGanadosEsteAnio, renderYearSummary);
  } else {
    renderYearSummary();
  }
}

function rankingChangeText(prev, curr){
  if(curr===prev) return `Ranking: te mantuviste en <b style="color:var(--purple-dark)">#${curr}</b>.`;
  if(curr<prev) return `Ranking: subiste de #${prev} a <b style="color:var(--purple-dark)">#${curr}</b>.`;
  return `Ranking: bajaste de #${prev} a <b style="color:var(--purple-dark)">#${curr}</b>.`;
}

const RETIRE_FISICO_THRESHOLD = 35;
const RETIRE_MAX_AGE = 40;

/* =========================================================
   PANTALLA: CELEBRACIÓN DE TROFEOS
   Aparece cuando el jugador ganó al menos uno de los "trofeos grandes" (Grand Slam, ATP Finals,
   Copa Davis) en la temporada que se acaba de cerrar — ver trofeosGanadosEsteAnio en finishYear().
   Si ganó más de uno el mismo año, se muestran TODOS juntos acá, con un solo título combinado
   (ej. "¡Ganaste la Copa Davis, el ATP Finals, el Roland Garros y Wimbledon!"). El botón "Seguir
   adelante" lleva al resumen de temporada de siempre (onContinue).
========================================================= */
function buildTrophyTitle(trofeos){
  const frases = trofeos.map(k=>{
    const t = TROFEO_INFO[k];
    return (t.articulo ? t.articulo+' ' : '') + t.label;
  });
  if(frases.length===1) return `¡Ganaste ${frases[0]}!`;
  const ultimo = frases[frases.length-1];
  const resto = frases.slice(0,-1).join(', ');
  return `¡Ganaste ${resto} y ${ultimo}!`;
}
function renderTrophyCelebration(trofeos, onContinue){
  const titulo = buildTrophyTitle(trofeos);
  const cardsHtml = trofeos.map(k=>{
    const t = TROFEO_INFO[k];
    return `<div class="trophy-card">
      <img src="${wikiImg(t.img,300)}" alt="${t.label}" loading="lazy" onerror="this.style.display='none'">
      <h4>${t.label}</h4>
      <p>${t.desc}</p>
    </div>`;
  }).join('');
  setScreen(`
    <div class="card" style="text-align:center;">
      <span class="tag">🏆 Temporada histórica</span>
      <h2>${titulo}</h2>
      <div class="trophy-grid">${cardsHtml}</div>
      <button class="primary" id="contBtn">Seguir adelante</button>
    </div>
  `);
  document.getElementById('contBtn').addEventListener('click', onContinue);
}

function renderYearSummary(){
  const p = G.player;
  const resultadosOrdenados = [...yearState.results].sort((a,b)=>b.entry.tier.weight-a.entry.tier.weight);
  const rows = resultadosOrdenados.map((r,i)=>`
    <div class="log-item" style="animation-delay:${(i*0.12).toFixed(2)}s">
      <b>${r.entry.tier.name}</b> — ${r.entry.nombre}<br>
      <span class="res ${r.campeon?'win':(r.ronda===0?'lose':'')}">${r.etiqueta}</span> · +${r.puntos} pts · ${fmt(r.premio)}
    </div>`).join('');
  const injuryHtml = yearState.injuryNote ? `<div class="outcome bad">🩹 ${yearState.injuryNote}</div>` : '';
  const bonusHtml = (yearState.bonusEvents||[]).map(t=>`<div class="outcome good">${t}</div>`).join('');

  const edadJugada = p.edad-1;
  const forzarRetiroPorEdad = p.edad > RETIRE_MAX_AGE;
  const forzarRetiroPorFisico = p.edad >= 38 && p.fisico < RETIRE_FISICO_THRESHOLD;
  const puedeElegirRetiro = !forzarRetiroPorFisico && !forzarRetiroPorEdad && p.edad >= 33 && p.fisico < RETIRE_FISICO_THRESHOLD;

  let actionHtml = '';
  if(forzarRetiroPorEdad){
    actionHtml = `<div class="outcome">A los ${edadJugada} llegaste al límite de una carrera profesional. Es hora de colgar la raqueta.</div><button class="primary" id="nextBtn" data-action="retire">Ver epílogo de carrera</button>`;
  } else if(forzarRetiroPorFisico){
    actionHtml = `<div class="outcome bad">El cuerpo ya no da para más: con el físico tan bajo a los ${edadJugada}, tu equipo decide que es momento de retirarte.</div><button class="primary" id="nextBtn" data-action="retire">Ver epílogo de carrera</button>`;
  } else if(puedeElegirRetiro){
    actionHtml = `<div class="outcome">Con el físico resentido a los ${edadJugada}, es una edad razonable para pensar en el retiro. ¿Qué preferís?</div>
      <div class="choices">
        <button class="choice" id="retireBtn">Retirarme ahora, cerrar la carrera</button>
        <button class="choice" id="nextBtn" data-action="continue">Seguir un año más</button>
      </div>`;
  } else {
    actionHtml = `<button class="primary" id="nextBtn" data-action="continue">Siguiente temporada</button>`;
  }

  const rankingBtnHtml = `<button class="tourinfo-launch" id="rankingSummaryBtn">ATP Ranking</button>`;
  const atpFinalsBtnHtml = yearState.atpFinalsFixture ? `<button class="tourinfo-launch" id="atpFinalsFixtureBtn">ATP Finals</button>` : '';
  const davisBtnHtml = yearState.davisFixture ? `<button class="tourinfo-launch" id="davisFixtureBtn">Copa Davis</button>` : '';

  setScreen(`
    <div class="card">
      <span class="tag">Fin de temporada — ${edadJugada} años</span>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <h2 style="margin:6px 0 10px;">Resumen del año</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${rankingBtnHtml}
          ${atpFinalsBtnHtml}
          ${davisBtnHtml}
        </div>
      </div>
      ${injuryHtml}
      ${rows}
      ${bonusHtml}
      <p class="small">${rankingChangeText(yearState.rkPrev, p.ranking)} Nivel actual: ${p.nivel}. Físico: ${Math.round(p.fisico)}.</p>
      ${actionHtml}
    </div>
  `);
  const rankingSummaryBtn = document.getElementById('rankingSummaryBtn');
  if(rankingSummaryBtn) rankingSummaryBtn.addEventListener('click', ()=>renderRanking('summary'));
  const atpFinalsFixtureBtn = document.getElementById('atpFinalsFixtureBtn');
  if(atpFinalsFixtureBtn) atpFinalsFixtureBtn.addEventListener('click', ()=>renderAtpFinalsFixture());
  const davisFixtureBtn = document.getElementById('davisFixtureBtn');
  if(davisFixtureBtn) davisFixtureBtn.addEventListener('click', ()=>renderDavisCupFixture());
  const retireBtn = document.getElementById('retireBtn');
  if(retireBtn) retireBtn.addEventListener('click', renderEpilogue);
  const nextBtn = document.getElementById('nextBtn');
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    if(nextBtn.dataset.action==="retire"){ renderEpilogue(); return; }
    // recuperación de físico entre temporadas + bonus de items
    p.fisico = clamp(p.fisico + 6 + (p.itemLevels && p.itemLevels.nutri ? shopCumulativeEffect(18,10,p.itemLevels.nutri)*0.55 : 0), 0, p.fisicoMax);
    if(p.pendingSponsorOffers && p.pendingSponsorOffers.length){ renderSponsorOffer(); }
    else { G.screen="hub"; renderHub(); }
  });
}

/* =========================================================
   FIXTURE DEL ATP FINALS (fase de grupos + semis + final, con los 8 clasificados reales)
   Antes solo se simulaba cómo le iba al JUGADOR si clasificaba (ver bloque "ATP Finals: top 8" en
   finishYear()) — el resto del cuadro no existía. Ahora se arma el fixture completo todos los
   años (clasifique o no el jugador, mismo criterio que Copa Davis), con los 8 mejores del ranking
   de puntos, para poder mostrarlo en una pantalla propia.
   DECISIÓN DE DISEÑO (confirmada con el usuario): el avance del JUGADOR se sigue resolviendo
   100% con su cadena de probabilidad de siempre (chanceGrupo/chanceSemi/chanceFinal, ya calibrada
   en finishYear() — "Modelo A", comparado por simulación contra una lotería por nivel antes de
   decidir esto). Este fixture solo viste con nombres reales a los otros 7 lugares del cuadro (vía
   una lotería ponderada por nivel, mismo mecanismo que assignGrandSlamChampions()/Copa Davis),
   FORZANDO el resultado del sorteo cuando hace falta para que nunca haya una contradicción entre
   lo que ya se resolvió para el jugador y lo que muestra el fixture. Por ahora NO reparte puntos
   de ranking a nadie (ni al jugador — eso ya estaba así — ni a los NPCs): es un cuadro de sabor,
   igual que Copa Davis. Grupos fijos a pedido del usuario: Grupo A = puestos 1º-4º-5º-8º del
   ranking de puntos, Grupo B = 2º-3º-6º-7º. Semis cruzadas: 1°A vs 2°B, 1°B vs 2°A.
========================================================= */
const ATP_FINALS_LOTTERY_EXP = 4; // solo cosmético (NPCs), no afecta el balance del jugador
function weightedPickIdx(weights){
  const total = weights.reduce((a,b)=>a+b,0);
  let roll = Math.random()*total;
  for(let i=0;i<weights.length;i++){
    roll -= weights[i];
    if(roll<=0) return i;
  }
  return weights.length-1;
}
// Orden completo de un grupo de 4 (mejor a peor), vía sorteos ponderados por nivel^EXP sin
// reemplazo — se usa tanto para decidir quién sale 1°/2° como para saber a quién promover si hace
// falta forzar/sacar al jugador del resultado natural del sorteo.
function atpFinalsWeightedOrder(group){
  const remaining = [...group];
  const order = [];
  while(remaining.length){
    const idx = weightedPickIdx(remaining.map(m=>Math.pow(m.nivel, ATP_FINALS_LOTTERY_EXP)));
    order.push(remaining[idx]);
    remaining.splice(idx,1);
  }
  return order;
}
// Resuelve un grupo de 4: quién sale 1° y 2° (clasifican a semis). Si el jugador está en este
// grupo, `mustClassify` (ya definido por la cadena de probabilidad de siempre) pisa el resultado
// natural del sorteo cuando hace falta.
function resolveAtpFinalsGroup(group, mustClassify){
  const order = atpFinalsWeightedOrder(group);
  let first = order[0], second = order[1];
  const rest = order.slice(2);
  const playerIdx = group.findIndex(m=>m.isPlayer);
  if(playerIdx>=0){
    const player = group[playerIdx];
    const yaClasifica = first===player || second===player;
    if(mustClassify && !yaClasifica){
      // el sorteo lo dejó afuera pero tiene que clasificar: entra como 2°
      second = player;
    } else if(!mustClassify && yaClasifica){
      // el sorteo lo hizo clasificar pero tiene que quedar afuera: sale, entra el mejor del resto
      const promovido = rest.shift();
      if(first===player) first = promovido; else second = promovido;
    }
  }
  return { first, second };
}
// Resuelve un cruce 1 contra 1 (semifinal o final). Si el jugador juega este cruce, el ganador ya
// está forzado por `playerGana` (definido por la cadena de probabilidad de siempre); si no, se
// sortea por nivel, mismo criterio que el resto del fixture.
function resolveAtpFinalsMatch(a, b, playerGana){
  if(a.isPlayer) return playerGana ? a : b;
  if(b.isPlayer) return playerGana ? b : a;
  const w = [Math.pow(a.nivel, ATP_FINALS_LOTTERY_EXP), Math.pow(b.nivel, ATP_FINALS_LOTTERY_EXP)];
  return weightedPickIdx(w)===0 ? a : b;
}
// Arma el fixture completo del año. `top8` son los 8 clasificados (mismo corte que ya usa el
// bloque de arriba para decidir si el jugador clasifica), ya mapeados a {nombre,pais,nivel,
// isPlayer}. `etapaJugador` es la etapa ya resuelta para el jugador ('grupos'/'semis'/
// 'subcampeon'/'campeon'), o null si no clasificó ese año (el top8 pasa a ser 100% NPCs).
function buildAtpFinalsBracket(top8, etapaJugador){
  const groupA = [top8[0], top8[3], top8[4], top8[7]];
  const groupB = [top8[1], top8[2], top8[5], top8[6]];
  const mustClassify = !!etapaJugador && etapaJugador!=='grupos';
  const rA = resolveAtpFinalsGroup(groupA, mustClassify);
  const rB = resolveAtpFinalsGroup(groupB, mustClassify);
  const ganaSemi = etapaJugador==='subcampeon' || etapaJugador==='campeon';
  const semi1 = { a: rA.first, b: rB.second, winner: resolveAtpFinalsMatch(rA.first, rB.second, ganaSemi) };
  const semi2 = { a: rB.first, b: rA.second, winner: resolveAtpFinalsMatch(rB.first, rA.second, ganaSemi) };
  const ganaFinal = etapaJugador==='campeon';
  const final = { a: semi1.winner, b: semi2.winner, winner: resolveAtpFinalsMatch(semi1.winner, semi2.winner, ganaFinal) };
  return {
    groupA: { members: groupA, first: rA.first, second: rA.second },
    groupB: { members: groupB, first: rB.first, second: rB.second },
    semi1, semi2, final,
  };
}

/* =========================================================
   PANTALLA: FIXTURE DEL ATP FINALS
   Mismo patrón visual que renderDavisCupFixture (reutiliza .davis-match, .rank-table y las
   clases "me"/"davis-called-row" ya existentes, sin CSS nuevo). Se usa desde el resumen de
   temporada, sin argumentos (toma yearState.atpFinalsFixture) — por ahora no es accesible desde
   ningún otro lugar (a pedido del usuario, "por ahora").
========================================================= */
function renderAtpFinalsFixture(fixtureOverride, onBack, anioLabel){
  const fixture = fixtureOverride || (yearState && yearState.atpFinalsFixture);
  const volver = onBack || renderYearSummary;
  if(!fixture){ volver(); return; }
  function groupTableHtml(label, groupData){
    const rowsHtml = groupData.members.map(m=>{
      const clasificado = m===groupData.first || m===groupData.second;
      return `<tr class="${m.isPlayer?'me':''}${clasificado?' davis-called-row':''}"><td>${flagImg(m.pais,14)} ${m.nombre}</td></tr>`;
    }).join('');
    return `<h3>${label}</h3><table class="rank-table"><tr><th>Jugador</th></tr>${rowsHtml}</table>`;
  }
  function matchHtml(match){
    const aWin = match.winner===match.a;
    return `<div class="davis-match">
      <span class="davis-team left"><span style="${aWin?'font-weight:700;':'opacity:0.5;'}${match.a.isPlayer?'color:var(--purple-dark);':''}">${flagImg(match.a.pais,14)} ${match.a.nombre}</span></span>
      <span class="davis-mid"><span>vs</span></span>
      <span class="davis-team right"><span style="${!aWin?'font-weight:700;':'opacity:0.5;'}${match.b.isPlayer?'color:var(--purple-dark);':''}">${match.b.nombre} ${flagImg(match.b.pais,14)}</span></span>
    </div>`;
  }
  setScreen(`
    <div class="card">
      <span class="tag">ATP Finals${anioLabel?` · ${anioLabel}`:''}</span>
      <h2>${flagImg(fixture.final.winner.pais,20)} ${fixture.final.winner.nombre} Campeón</h2>
      <div class="shop-scroll">
        ${groupTableHtml('Grupo A', fixture.groupA)}
        ${groupTableHtml('Grupo B', fixture.groupB)}
        <div class="davis-legend"><span><span class="legend-dot classified"></span>Clasificado a semifinales</span></div>
        <h3>Semifinal</h3>
        ${matchHtml(fixture.semi1)}
        ${matchHtml(fixture.semi2)}
        <h3>Final</h3>
        ${matchHtml(fixture.final)}
      </div>
      <button class="primary ghost" id="backBtn" style="margin-top:10px;">Volver</button>
    </div>
  `);
  document.getElementById('backBtn').addEventListener('click', volver);
}

/* =========================================================
   PANTALLA: FIXTURE COMPLETO DE COPA DAVIS
   Se usa tanto para el año en curso (desde el resumen de temporada, sin argumentos — toma
   yearState.davisFixture) como para cualquier año pasado (desde el historial de Copa Davis,
   pasando el fixture guardado en p.copaDavisHistorial y a dónde volver al cerrar la pantalla).
========================================================= */
function renderDavisCupFixture(fixtureOverride, onBack, anioLabel){
  const p = G.player;
  const fixture = fixtureOverride || (yearState && yearState.davisFixture);
  const volver = onBack || renderYearSummary;
  if(!fixture){ volver(); return; }
  const roundsHtml = fixture.rounds.map(round=>{
    const matchesHtml = round.matches.map(m=>{
      const aWin = m.winner===m.aCode;
      const meA = m.aCode===p.pais, meB = m.bCode===p.pais;
      const scoreA = aWin ? m.scoreWinner : m.scoreLoser;
      const scoreB = aWin ? m.scoreLoser : m.scoreWinner;
      return `<div class="davis-match">
        <span class="davis-team left"><span style="${aWin?'font-weight:700;':'opacity:0.5;'}${meA?'color:var(--purple-dark);':''}">${COUNTRY_NAMES[m.aCode]||m.aCode} ${flagImg(m.aCode,14)}</span></span>
        <span class="davis-mid"><span class="davis-score ${aWin?'win':''}">${scoreA}</span><span>vs</span><span class="davis-score ${!aWin?'win':''}">${scoreB}</span></span>
        <span class="davis-team right"><span style="${!aWin?'font-weight:700;':'opacity:0.5;'}${meB?'color:var(--purple-dark);':''}">${flagImg(m.bCode,14)} ${COUNTRY_NAMES[m.bCode]||m.bCode}</span></span>
      </div>`;
    }).join('');
    return `<h3>${round.name}</h3>${matchesHtml}`;
  }).join('');
  setScreen(`
    <div class="card">
      <span class="tag">Copa Davis${anioLabel?` · ${anioLabel}`:''}</span>
      <h2>${flagImg(fixture.champion,20)} ${COUNTRY_NAMES[fixture.champion]||fixture.champion} Campeón</h2>
      <div class="shop-scroll">${roundsHtml}</div>
      <button class="primary ghost" id="backBtn" style="margin-top:10px;">Volver</button>
    </div>
  `);
  document.getElementById('backBtn').addEventListener('click', volver);
}

/* =========================================================
   OFERTA DE SPONSOR (pantalla propia)
========================================================= */
function renderSponsorOffer(){
  const p = G.player;
  if(!p.pendingSponsorOffers || !p.pendingSponsorOffers.length){ G.screen="hub"; renderHub(); return; }
  const offer = p.pendingSponsorOffers[0];
  const brand = offer.brand;
  const puedeNegociar = !offer.negociado;
  setScreen(`
    <div class="card">
      <span class="tag">Propuesta de sponsor</span>
      <div style="display:flex;align-items:center;gap:12px;margin:10px 0 16px;">
        <div style="width:52px;height:52px;border-radius:50%;background:${brand.color};color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;flex-shrink:0;">${brand.name.charAt(0)}</div>
        <div>
          <h2 style="margin:0;">${brand.name}</h2>
          <p class="small" style="margin:2px 0 0;">quiere sumarte como imagen de la marca</p>
        </div>
      </div>
      <p>Te ofrecen un contrato de <b>${fmt(offer.anual)} por año</b>, durante <b>${offer.years} años</b>.</p>
      <div class="choices">
        <button class="choice" id="sponsorYes">Aceptar contrato</button>
        ${puedeNegociar ? `<button class="choice" id="sponsorNeg">Negociar (pedir más plata)</button>` : ''}
        <button class="choice" id="sponsorNo">Rechazar</button>
      </div>
    </div>
  `);
  document.getElementById('sponsorYes').addEventListener('click', ()=>{
    p.sponsors.push({brand, years:offer.years, anual:offer.anual});
    unlockAchievement(p, 'primer_sponsor');
    if(p.sponsors.length>=4) unlockAchievement(p, 'cuatro_sponsors');
    p.pendingSponsorOffers.shift();
    renderSponsorOffer();
  });
  document.getElementById('sponsorNo').addEventListener('click', ()=>{
    p.pendingSponsorOffers.shift();
    renderSponsorOffer();
  });
  const negBtn = document.getElementById('sponsorNeg');
  if(negBtn) negBtn.addEventListener('click', ()=>{
    offer.negociado = true;
    // El representante de primer nivel mejora moderadamente el resultado de la negociación:
    // sube la chance de que mejoren la oferta y baja la de que la retiren (el "no cede" del medio
    // queda con el mismo ancho de banda, 30 puntos, solo se corre). En nivel 0: 45/30/25 (igual que
    // antes). En nivel máximo (7): 55/30/15.
    const repLevel = (p.itemLevels && p.itemLevels.representante) || 0;
    const negFraction = shopCumulativeEffect(1, 7, repLevel); // 0..1 según nivel del representante
    const mejoraThreshold = 0.45 + 0.10*negFraction;
    const neutralThreshold = mejoraThreshold + 0.30;
    const roll = Math.random();
    let resultText, tone;
    if(roll < mejoraThreshold){
      const mejora = 1.15 + Math.random()*0.15;
      offer.anual = Math.round(offer.anual * mejora);
      resultText = `Tu representante consigue mejorar la oferta: ahora son ${fmt(offer.anual)} por año.`;
      tone = "good";
    } else if(roll < neutralThreshold){
      resultText = `${brand.name} no cede ni un peso, pero tampoco se ofende. La oferta sigue en pie tal cual estaba.`;
      tone = "neutral";
    } else {
      p.pendingSponsorOffers.shift();
      resultText = `${brand.name} se incomoda con la negociación y retira la oferta. Se fueron con las manos vacías.`;
      tone = "bad";
    }
    renderOutcome({text:resultText, tone}, ()=>renderSponsorOffer());
  });
}

/* =========================================================
   EPÍLOGO
========================================================= */
function renderEpilogue(){
  const p = G.player;
  G.gameEnded = true;
  const edadRetiro = p.edad-1;
  const peakRanking = Math.min(p.bestRanking, p.ranking);
  const peakNivel = Math.max(p.bestNivel, p.nivel);
  if(peakRanking<=5) unlockAchievement(p, 'retiro_top5', edadRetiro);
  if(!p.tuvoLesionAlguna && p.historial.length>0) unlockAchievement(p, 'carrera_sin_lesion', edadRetiro);
  let texto;
  if(peakRanking<=10) texto = `En tu mejor momento llegaste al puesto #${peakRanking} del mundo, con ${p.titulos} título(s) en tu vitrina. Colgás la raqueta a los ${edadRetiro} años como uno de los nombres importantes de tu generación.`;
  else if(peakRanking<=60) texto = `Tu techo fue el puesto #${peakRanking} del ranking mundial — una carrera sólida en el circuito principal, con ${p.titulos} título(s) conseguidos a lo largo de tu carrera.`;
  else if(peakRanking<=200) texto = `Llegaste a tocar el puesto #${peakRanking} en tu mejor momento, moviéndote entre Challengers y algún ATP suelto. No fue una carrera de multitudes, pero fue la tuya.`;
  else texto = `Tu mejor ranking fue #${peakRanking}, la mayor parte del tiempo peleando en los circuitos más chicos. No todos los caminos en el tenis pasan por los grandes escenarios, y el tuyo tuvo lo suyo.`;
  setScreen(`
    <div class="card epilogue">
      <span class="tag">Fin de carrera — ${edadRetiro} años</span>
      <h2>Así quedó tu carrera</h2>
      <p>${texto}</p>
      <div class="scoreboard" style="grid-template-columns:repeat(2,1fr);margin-bottom:10px;">
        <div class="tile"><span class="label">🏔️ Mejor nivel</span><span class="value">${peakNivel}</span></div>
        <div class="tile"><span class="label">🏆 Mejor ranking</span><span class="value">#${peakRanking}</span></div>
        <div class="tile"><span class="label">🎖️ Títulos</span><span class="value">${p.titulos}</span></div>
        <div class="tile"><span class="label">🥈 Finales perdidas</span><span class="value">${p.finales}</span></div>
        <div class="tile" style="grid-column:span 2;"><span class="label">💰 Dinero ganado en toda la carrera</span><span class="value" style="font-size:16px;">${fmt(p.dineroTotalGanado||p.dinero)}</span></div>
        <div class="tile" style="grid-column:span 2;"><span class="label">✨ Fama final</span><span class="value">${Math.round(p.fama)}</span></div>
      </div>
      <div class="toprow" style="flex-wrap:wrap;">
        <button class="linkbtn" id="rankBtnEnd">Ver ranking final</button>
        <button class="linkbtn" id="histBtnEnd">Ver historial</button>
        <button class="linkbtn" id="titulosBtnEnd">Ver títulos</button>
        <button class="linkbtn" id="logrosBtnEnd">🏅 Logros</button>
        <button class="linkbtn" id="davisHistBtnEnd">🏳️ Copa Davis</button>
      </div>
      <button class="primary" id="restartBtn" style="margin-top:10px;">Jugar de nuevo</button>
    </div>
  `);
  document.getElementById('rankBtnEnd').addEventListener('click', ()=>renderRankingFinal());
  document.getElementById('histBtnEnd').addEventListener('click', ()=>renderTitulos());
  document.getElementById('titulosBtnEnd').addEventListener('click', ()=>renderTitulos());
  document.getElementById('logrosBtnEnd').addEventListener('click', ()=>renderLogros());
  document.getElementById('davisHistBtnEnd').addEventListener('click', ()=>{ countryRankTab='historial'; renderCountryRanking(); });
  document.getElementById('restartBtn').addEventListener('click', ()=>{
    G = { screen:"intro", player:null, pool:[], yearEvents:[], turn:0, selectedCountry:null, minijuegosOn:false, tempMinijuegos:true, nightMode:false, tempNightMode:false, grandSlamHistorial:[] };
    document.body.classList.remove('night-mode');
    renderIntro();
  });
}
function renderRankingFinal(){
  renderRanking('summary');
  // El botón "volver" de renderRanking llama a renderYearSummary; lo pisamos para volver al epílogo
  const backBtn = document.getElementById('backBtn');
  if(backBtn) backBtn.addEventListener('click', renderEpilogue, {once:true});
}

/* =========================================================
   INIT
========================================================= */
window.addEventListener('beforeunload', function(e){
  if(G.player && G.screen !== "intro"){
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});
renderIntro();

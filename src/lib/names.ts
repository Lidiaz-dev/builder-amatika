/** Noms proposés à l'ajout d'un modèle, selon la race de la bande. */
const NAMES: Record<string, string[]> = {
  'cites-etats': [
    'Johann Kessler', 'Dieter Brandt', 'Ulrich Vogt', 'Matthias Kruger', 'Konrad Weiss', 'Lukas Hamm', 'Friedrich Adler', 'Otto Falk', 'Heinrich Stahl', 'Ernst Bauer',
    'Wilhelm Roth', 'Klaus Eberhardt', 'Gustav Lang', 'Albrecht Schwarz', 'Markus Pfeiffer', 'Hans Zimmer', 'Rudolf Graf', 'Siegfried Holz', 'Gerhard Kohl', 'Bruno Keller',
    'Erich Molder', 'Anselm Richter', 'Viktor Haas', 'Kaspar Wolff', 'Reinhold Brenner', 'Franz Lindner', 'Helga Steiner', 'Greta Hoffmann', 'Ilse Brunner', 'Magda Fischer',
  ],
  nains: [
    'Thorgrim Barbe-de-Fer', 'Durin Brise-Roc', 'Balin Fendeur', 'Grimli Marteau-Noir', 'Kazrik Poing-d\'Acier', 'Bromm Chope-Pleine', 'Dwalin Forgeroc', 'Gotrek Tranche-Os', 'Hrolf Pierre-Dure', 'Snorri Gros-Nez',
    'Ungrim Enclume', 'Borin Mine-Profonde', 'Thrain Barbe-Grise', 'Gimrik Cogne-Mur', 'Oddi Bouclier-d\'Or', 'Fargrim Hache-Rouge', 'Bardin Sombre-Galerie', 'Kragg le Sombre', 'Morek Fer-Battu', 'Alrik Taille-Gemme',
    'Hargrim Bière-Brune', 'Nori Pic-Usé', 'Grundi Roc-Têtu', 'Belegar Coeur-de-Pierre', 'Thorek Rune-Ardente', 'Skalf Marteau-Lourd', 'Durak Front-Bas', 'Gromril Sans-Peur', 'Helga Tresse-de-Cuivre', 'Brunhild Forge-Vive',
  ],
  orques: [
    'Grokk', 'Murgash', 'Ugluk Kass\'Tête', 'Azgob', 'Snagrot', 'Gorbad', 'Krug Mâchoire', 'Urzag', 'Brakk Dent-Noire', 'Morgrub',
    'Skarsnak', 'Dregg', 'Grimgor', 'Badrukk', 'Zogrot', 'Urk Kogne-Dur', 'Gashnak', 'Borgut', 'Nazbag', 'Krumpa',
    'Ogrog Tranche-Tout', 'Wazzok', 'Skullgrim', 'Dakka', 'Grubnak', 'Mogrul', 'Rukk Œil-Crevé', 'Thrakka', 'Gorzag', 'Bigg Boss Snorg',
  ],
  gobelins: [
    'Snikkit', 'Grizzik', 'Nob Pique-Pied', 'Skrag', 'Zogwort', 'Ratgob', 'Gribouille', 'Snotling Jr', 'Fizzgig', 'Krikk',
    'Nazgrub', 'Squig-Pas-Cher', 'Skarsnik', 'Grom le Pansu', 'Nogg', 'Snazzgar', 'Zitbag', 'Grotty', 'Fungus', 'Snivel',
    'Krazgob', 'Pickpock', 'Mouchgob', 'Rikkit Lune-Folle', 'Bogrot', 'Snagla', 'Gnarlik', 'Zippit', 'Grinkle', 'Morveux',
  ],
  'haut-elfe': [
    'Aelion', 'Caledor', 'Eltharion', 'Finreir', 'Ithilmar', 'Lothern', 'Saphery', 'Tyrion d\'Ulthuan', 'Imladris', 'Caradryel',
    'Aenarion', 'Belannaer', 'Teclis', 'Alarielle', 'Finubar', 'Korhil', 'Imrik', 'Salendor', 'Arathion', 'Eldrion',
    'Valandil', 'Silvarion', 'Aerendil', 'Thalion', 'Liandra', 'Mithlonde', 'Ellyrion', 'Yvraine', 'Aislinn', 'Elanor',
  ],
  'elfe-des-bois': [
    'Naieth', 'Arwael', 'Sylvaneth', 'Thalandor', 'Lyriel', 'Adanhu', 'Feuille-d\'Automne', 'Cerwyn', 'Elowen', 'Daith',
    'Ariel des Taillis', 'Faenor', 'Orion', 'Drycha', 'Sisrall', 'Findol', 'Araloth', 'Wychwood', 'Galadhon', 'Lothien',
    'Écorce-d\'Argent', 'Ronce', 'Brindille', 'Merle-Chanteur', 'Taillis', 'Haldir', 'Mirwen', 'Sylvain', 'Aubépine', 'Cerf-Blanc',
  ],
  drow: [
    'Malekith', 'Zaknafein', 'Vhaeraun', 'Ilphrin', 'Drizzara', 'Kaelith', 'Shakti', 'Veldrin', 'Morwen', 'Xullrae',
    'Nalfein', 'Sabrae', 'Morathi', 'Lokhir', 'Hellebron', 'Rakarth', 'Shadra', 'Kouran', 'Tullus', 'Malus',
    'Vrinn', 'Sylvra', 'Nyssa', 'Dravek', 'Ilvara', 'Zilvra', 'Kethra', 'Ryld', 'Valas', 'Quenthel',
  ],
  ogre: [
    'Gorgle', 'Bragg le Massif', 'Grasul', 'Golgfag', 'Skrag l\'Avaleur', 'Mungo', 'Bruk Panse-Pleine', 'Grond', 'Hulgar', 'Oggdrok',
    'Ventru', 'Krom', 'Greasus', 'Bolgar', 'Ghark Brise-Tout', 'Mangetout', 'Gudrun', 'Thogg', 'Brog', 'Lardo',
    'Gutlord', 'Krugg Double-Menton', 'Bulgar', 'Grumph', 'Ogg', 'Bedaine', 'Mâchefer', 'Torg', 'Gros-Dos', 'Borbo',
  ],
  skaven: [
    'Skritch', 'Queek', 'Snikch', 'Ikit', 'Thanquol', 'Vermik', 'Rattus', 'Skweel', 'Krittik', 'Gnawdwell',
    'Squeak', 'Throt', 'Skrolk', 'Lurk', 'Tretch', 'Skrikk', 'Vrisk', 'Nikkit', 'Gnash', 'Skabrus',
    'Kratch Queue-Pelée', 'Ratsnik', 'Sniktch', 'Vermiss', 'Chitter', 'Grisk', 'Skurvy', 'Twitch', 'Rongeur', 'Sklar',
  ],
  drakeide: [
    'Tik-Tak-To', 'Oxyotl', 'Kroq-Gar', 'Gor-Rok', 'Xilitl', 'Chakax', 'Tehenhauin', 'Zlaaq', 'Nakai', 'Itzl',
    'Quetli', 'Tlaxtl', 'Mazdamundi', 'Kroak', 'Tetto\'eko', 'Xlanhuapec', 'Huanchi', 'Tlazcotl', 'Inxi-Huinzi', 'Sotek',
    'Xiuhcoatl', 'Kai-Rok', 'Zwup', 'Tzunki', 'Kuoteq', 'Ix-Lak', 'Ohtli', 'Tecpatl', 'Qua-Tl', 'Chotec',
  ],
  mangechair: [
    'Gorge-Sang', 'Krell', 'Morg la Panse', 'Vargul', 'Ronge-Os', 'Grimsk', 'Hurk', 'Ventre-Creux', 'Draug', 'Skolm',
    'Babine', 'Gnarr', 'Crocs-Rouges', 'Lacère', 'Mordak', 'Viscère', 'Grisolm', 'Tripaille', 'Hachoir', 'Skarn',
    'Moelle', 'Gueule-Béante', 'Brask', 'Saignée', 'Vorr', 'Ronce-Chair', 'Graillon', 'Thurg', 'Croque-Mort', 'Dévore-Tout',
  ],
  'la-harde': [
    'Khazrak', 'Gorthor', 'Malagor', 'Morghur', 'Ghorros', 'Bray-Corne', 'Taurox', 'Ungrol', 'Grak Sabot-Noir', 'Mugrah',
    'Kreesh', 'Ghark', 'Slugtongue', 'Gnarl', 'Bruhh', 'Kurnoth', 'Grall Corne-Brisée', 'Ruk', 'Varg', 'Hurn',
    'Bêlement', 'Gorbrak', 'Skarr', 'Thrumm', 'Ghorgon', 'Mork Poil-Dru', 'Ugrul', 'Krazak', 'Brame', 'Sabot-Fendu',
  ],
  halfling: [
    'Bilbon Sacquet', 'Pippin Touque', 'Rosie Bonenfant', 'Merry Brandebouc', 'Hamfast Gamegie', 'Lobelia Sacquet', 'Bolger Rondelet', 'Tobold Sonnecor', 'Milo Fouineur', 'Daisy Pied-Léger',
    'Fredegar Bolger', 'Odo Grosse-Panse', 'Lumpin Croop', 'Bartolo Patate', 'Hob Sauce-Brune', 'Myrtille Fournil', 'Poppy Champdeblé', 'Wilibald Panier', 'Ferdi Touque', 'Basile Gâteau',
    'Pervenche Mielleux', 'Bingo Lardon', 'Otho Pied-Velu', 'Lily Cotonnier', 'Gaspard Tarte', 'Dudo Ventripotent', 'Primula Brandebouc', 'Marigold Jardinier', 'Rufus Fromager', 'Tom Pain-d\'Épice',
  ],
  tieffelin: [
    'Zariel', 'Malphas', 'Ashkar', 'Nyx', 'Damaia', 'Kallos', 'Mordai', 'Akmenos', 'Orianna', 'Velkar',
    'Leucis', 'Skamos', 'Bryseis', 'Ekemon', 'Iados', 'Makaria', 'Nemeia', 'Pelaios', 'Rieta', 'Therai',
    'Barakas', 'Kairon', 'Lerissa', 'Morthos', 'Sorrow', 'Ira', 'Tourment', 'Cendre', 'Azazel', 'Lilith',
  ],
  'nain-d-ashut': [
    'Astragoth', 'Drazhoath', 'Zhatan', 'Hashut-Khar', 'Rykarth', 'Ghorth le Cruel', 'Vraddok', 'Uzkulak', 'Daemok', 'Zharr',
    'Nazrak', 'Baraz Cendre', 'Gorduz', 'Rykorth', 'Zhargal', 'Khazdrak', 'Vulkar', 'Azhrak', 'Drogdush', 'Karak-Brûlé',
    'Uzgar Fer-Noir', 'Morgrim', 'Szarnak', 'Ghazak', 'Torgush', 'Zarduk Taureau-d\'Airain', 'Kuldrak', 'Brazak', 'Obsidius', 'Hargash',
  ],
  necromant: [
    'Vlad von Carstein', 'Mannfred', 'Isabella', 'Konrad', 'Heinrich Kemmler', 'Krell', 'Morticia', 'Dieter Helsnicht', 'Os-Brisés', 'Sir Crâne',
    'Lazare', 'Ossian', 'Neferata', 'Abhorash', 'Walach', 'Melkhior', 'Arkhan', 'Nagash', 'Sylvanie', 'Comte Morbus',
    'Baron Linceul', 'Tibia', 'Rotule', 'Clavicule', 'Dame Cendrée', 'Ombrage', 'Morteval', 'Funeste', 'Gisant', 'Cercueil',
  ],
  bretonniens: [
    'Sire Gauthier', 'Sire Bertrand', 'Dame Aliénor', 'Sire Lancelin', 'Sire Roland', 'Sire Tancrède', 'Dame Ysolde', 'Sire Godefroy', 'Sire Perceval', 'Sire Enguerrand',
    'Sire Amaury', 'Dame Mélisende', 'Sire Louen', 'Sire Bohémond', 'Sire Thibaut', 'Sire Raoul', 'Sire Guillaume', 'Sire Baudouin', 'Sire Hugues', 'Sire Arnaud',
    'Sire Foulques', 'Sire Aymeric', 'Dame Héloïse', 'Dame Blanchefleur', 'Sire Gaspard', 'Sire Renaud', 'Sire Yvain', 'Sire Galaad', 'Dame Clothilde', 'Sire Bayard',
  ],
  cathay: [
    'Hiroshi', 'Takeda', 'Mei Lin', 'Kenji', 'Wu Zhao', 'Akira', 'Li Feng', 'Masamune', 'Yuki', 'Zhang Wei',
    'Hanzo', 'Shen Long', 'Miao Ying', 'Zhao Ming', 'Musashi', 'Kojiro', 'Tomoe', 'Lin Bao', 'Jin Hu', 'Ryu',
    'Daisuke', 'Sakura', 'Xu Lan', 'Takumi', 'Huang Fei', 'Kaede', 'Nobunaga', 'Liu Yang', 'Haruto', 'Bai Shi',
  ],
  khajiit: [
    'M\'aiq', 'Ri\'saad', 'Dro\'Zhirr', 'Ja\'Khajay', 'Kharjo', 'Zaynabi', 'S\'rendarr', 'Ahnissi', 'J\'zargo', 'Inigo',
    'Do\'Rassa', 'Khayla', 'Ra\'Zhinda', 'Ma\'dran', 'Ri\'Bassa', 'Dro\'Marash', 'Ahkari', 'Atahbah', 'Kharrdin', 'Shavari',
    'Ja\'Rashi', 'Sa\'Vashi', 'Raz\'Khara', 'Zhassim', 'Ma\'jhad', 'Ri\'Vakh', 'Kesh', 'Ahzirr', 'Na\'ruzhi', 'Qa\'Dojo',
  ],
  esprit: [
    'Murmure', 'Brume', 'Écho', 'Lamentation', 'Spectre Gris', 'Âme Errante', 'Voile', 'Pâleur', 'Soupir', 'Frisson',
    'Dame Blanche', 'Le Hurleur', 'Ombre Froide', 'Chaîne-Sourde', 'Glas', 'Feu Follet', 'Linceul', 'Silence', 'Hantise', 'Givre',
    'Sire Oublié', 'La Veuve', 'Fantôme du Puits', 'Morne', 'Requiem', 'Nocturne', 'Vaporeux', 'Le Sans-Nom', 'Cendre Pâle', 'Larme',
  ],
  ondin: [
    'Marin', 'Thalassa', 'Coralie', 'Nérée', 'Ondine', 'Triton', 'Écume', 'Abysse', 'Perle', 'Galatée',
    'Morvan des Flots', 'Ressac', 'Amphitrite', 'Glaucos', 'Doris', 'Protée', 'Nacre', 'Varech', 'Lagune', 'Marée',
    'Embrun', 'Corail', 'Néréide', 'Houle', 'Brisant', 'Abyssin', 'Sirène', 'Thétis', 'Azur', 'Calypso',
  ],
}

/** 5 % des noms tirés sont… moins héroïques. */
const FUNNY = [
  'Gros Zizi', 'Prout le Brave', 'Gégé la Saucisse', 'Sire Fesse-Molle', 'Kévin du Marais', 'Tata Ginette', 'Mamie Cogne-Dur',
  'Bernard', 'Petit Slip', 'Jean-Michel Bastonne', 'Pied-Puant', 'Bouboule', 'Tonton Gratouille', 'Le Gros Nul', 'Michel',
  'Gros Bidou', 'Popol le Fourbe', 'Raclette', 'Dédé Pète-Sec', 'Sire Moustache', 'Jacquouille', 'Choupinou', 'Maurice',
  'Kiki la Terreur', 'Croquette', 'Bébert Trois-Doigts', 'Patate Douce', 'Roger Mou-du-Genou', 'Tartiflette', 'Sire Caleçon',
]

const FALLBACK = ['Aldric', 'Bran', 'Cador', 'Dunstan', 'Edric', 'Garret', 'Hal', 'Lorcan', 'Merrick', 'Osric', 'Roderick', 'Wulfric']

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]

/** Un nom au hasard pour la race, en évitant ceux déjà pris dans la bande. */
export function randomName(factionId: string, taken: string[] = []): string {
  if (Math.random() < 0.05) return pick(FUNNY)
  const list = NAMES[factionId] ?? FALLBACK
  const free = list.filter((n) => !taken.includes(n))
  return pick(free.length ? free : list)
}

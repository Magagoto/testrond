/**
 * Points d'intérêt à Orléans
 * Coordonnées GPS précises de lieux importants du centre-ville d'Orléans
 */

const orleansPOI = [
  {
    name: "Cathédrale Sainte-Croix",
    lat: 47.9021,
    long: 1.9092,
    description: "Imposante cathédrale gothique"
  },
  {
    name: "Place du Martroi",
    lat: 47.9028,
    long: 1.9033,
    description: "Place centrale avec statue de Jeanne d'Arc"
  },
  {
    name: "Hôtel Groslot",
    lat: 47.9022,
    long: 1.9055,
    description: "Ancien hôtel de ville du XVIe siècle"
  },
  {
    name: "Musée des Beaux-Arts",
    lat: 47.9017,
    long: 1.9072,
    description: "Un des plus anciens musées de France"
  },
  {
    name: "Place de Loire",
    lat: 47.8995,
    long: 1.9106,
    description: "Place animée au bord de la Loire"
  },
  {
    name: "Pont George V",
    lat: 47.8968,
    long: 1.9098,
    description: "Principal pont traversant la Loire"
  },
  {
    name: "FRAC Centre",
    lat: 47.9075,
    long: 1.9018,
    description: "Fonds Régional d'Art Contemporain"
  },
  {
    name: "Campo Santo",
    lat: 47.9025,
    long: 1.9097,
    description: "Ancien cimetière transformé en espace culturel"
  },
  {
    name: "Théâtre d'Orléans",
    lat: 47.9019,
    long: 1.9124, 
    description: "Scène nationale, à l'est de la cathédrale"
  },
  {
    name: "Maison de Jeanne d'Arc",
    lat: 47.9009,
    long: 1.9119,
    description: "Musée dédié à Jeanne d'Arc"
  },
  {
    name: "Collégiale Saint-Pierre-le-Puellier",
    lat: 47.9007,
    long: 1.9082,
    description: "Ancienne église romane transformée en espace d'exposition"
  },
  {
    name: "Crypte Saint-Aignan",
    lat: 47.8986,
    long: 1.9127,
    description: "Site archéologique médiéval"
  },
  {
    name: "Préfecture du Loiret",
    lat: 47.9037,
    long: 1.9090,
    description: "Siège administratif du département"
  },
  {
    name: "Quais de Loire",
    lat: 47.8975,
    long: 1.9077,
    description: "Promenade le long du fleuve"
  },
  {
    name: "Médiathèque d'Orléans",
    lat: 47.9045,
    long: 1.9086,
    description: "Principale bibliothèque de la ville, au nord du centre"
  },
  {
    name: "Jardin de l'Évêché",
    lat: 47.9011,
    long: 1.9099,
    description: "Jardin public à proximité de la cathédrale"
  },
  {
    name: "Gare d'Orléans",
    lat: 47.9079,
    long: 1.9040,
    description: "Gare ferroviaire principale"
  },
  {
    name: "La Motte Sanguin",
    lat: 47.8987,
    long: 1.9186,
    description: "Ancien bastion défensif"
  },
  {
    name: "Église Saint-Aignan",
    lat: 47.8986,
    long: 1.9139,
    description: "Église romane et gothique"
  },
  {
    name: "Place du Châtelet",
    lat: 47.9002,
    long: 1.9028,
    description: "Place commerçante avec fontaine"
  },
  {
    name: "Musée Historique et Archéologique",
    lat: 47.9009,
    long: 1.9074,
    description: "Musée municipal d'histoire locale"
  },
  {
    name: "Place de la République",
    lat: 47.9049,
    long: 1.9039,
    description: "Place au nord du centre-ville"
  },
  {
    name: "Hôtel de Ville",
    lat: 47.9030,
    long: 1.9054,
    description: "Mairie d'Orléans"
  },
  {
    name: "Centre Commercial Place d'Arc",
    lat: 47.9075,
    long: 1.9030,
    description: "Principal centre commercial"
  },
  {
    name: "Rue de Bourgogne",
    lat: 47.9007,
    long: 1.9061,
    description: "Rue animée du centre historique"
  },
  {
    name: "Rue Jeanne d'Arc",
    lat: 47.9028,
    long: 1.9067,
    description: "Grande artère commerçante"
  },
  {
    name: "Université d'Orléans - Centre-Ville",
    lat: 47.9029,
    long: 1.9014,
    description: "Antenne universitaire urbaine"
  },
  {
    name: "Insula V",
    lat: 47.9004,
    long: 1.9007,
    description: "Site archéologique gallo-romain"
  },
  {
    name: "Pont de l'Europe",
    lat: 47.8975,
    long: 1.8950,
    description: "Pont moderne à l'ouest du centre-ville"
  },
  {
    name: "Place Sainte-Croix",
    lat: 47.9023,
    long: 1.9100,
    description: "Place devant la cathédrale"
  }
];

// Export pour pouvoir l'utiliser dans script.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { orleansPOI };
} else {
  // Exportation pour le navigateur
  window.orleansPOI = orleansPOI;
}

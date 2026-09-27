require('dotenv').config();
const {db} = require('../config/firebase');

const tipos = {
  'herramienta': [
    {nombre:'Cargadora',interno:'H001',marca:'Caterpillar',modelo:'966K',stock:1},
    {nombre:'Paleta',interno:'H002',marca:'Caterpillar',modelo:'428',stock:3},
    {nombre:'Gato Hidraulico',interno:'H003',marca:'Holman',modelo:'5000',stock:2}
  ],
  'equipo': [
    {nombre:'Bomba Hidraulica',interno:'E001',marca:'Bosch',modelo:'3000',stock:1},
    {nombre:'Compresor',interno:'E002',marca:'Atlas Copco',modelo:'XAS 150',stock:1}
  ],
  'ropa': [
    {nombre:'Casco de Seguridad',interno:'R001',marca:'3M',modelo:'V-Series',stock:10},
    {nombre:'Botina de Seguridad',interno:'R002',marca:'Bullet',modelo:'B614',stock:8},
    {nombre:'Guantes Industriales',interno:'R003',marca:'Mechanix',modelo:'M-Pact',stock:20}
  ],
  'material': [
    {nombre:'Acero Estructural',interno:'M001',marca:'Siderca',modelo:'EN 12',stock:500},
    {nombre:'Cemento Portland',interno:'M002',marca:'Loma Negra',modelo:'CPII',stock:200}
  ]
};

async function main() {
  const batch = db.batch();
  // Limpiar counters existentes
  Object.keys(tipos).forEach(tipo => {
    batch.set(db.collection('counters').doc(tipo), { current: tipos[tipo].length }, { merge: true });
  });
  // Cargar catalogo
  Object.entries(tipos).forEach(([tipo, items]) => {
    items.forEach(item => {
      const ref = db.collection('elementos_catalogo').doc();
      batch.set(ref, { ...item, tipo, createdAt: new Date() });
    });
  });
  await batch.commit();
  console.log('Catalogo cargado OK con counters');
  process.exit(0);
}
main().catch(e => { console.log('Error:', e.message); process.exit(1); });

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const RULES_PATH = path.join(__dirname, '..', 'firestore.rules');

function parseJSON(str) {
  try { return JSON.parse(str); }
  catch (e) { return null; }
}

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fp = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(fp)) { const r = parseJSON(fs.readFileSync(fp, 'utf8')); if (r) return r; }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const c = process.env.FIREBASE_SERVICE_ACCOUNT.replace(/^['"]/, '').replace(/['"]$/, '');
    const r = parseJSON(c); if (r) return r;
  }
  const lf = path.join(__dirname, '..', 'engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json');
  if (fs.existsSync(lf)) { const r = parseJSON(fs.readFileSync(lf, 'utf8')); if (r) return r; }
  return null;
}

async function main() {
  const sa = getServiceAccount();
  if (!sa) { console.error('ERROR: No se encontró service account'); process.exit(1); }

  if (!fs.existsSync(RULES_PATH)) { console.error('ERROR: No se encontró firestore.rules'); process.exit(1); }

  const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');
  const projectId = sa.project_id;
  console.log(`Proyecto: ${projectId}`);

  const auth = new GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  console.log('Token obtenido correctamente');

  const rulesetBody = {
    source: {
      files: [
        {
          name: 'firestore.rules',
          content: rulesContent
        }
      ]
    }
  };

  console.log('Creando ruleset...');
  const createRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rulesetBody)
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(`Error creando ruleset (${createRes.status}):`, errText);
    process.exit(1);
  }

  const ruleset = await createRes.json();
  const rulesetName = ruleset.name;
  console.log(`Ruleset creado: ${rulesetName}`);

  const releaseBody = {
    name: `projects/${projectId}/releases/cloud.firestore`,
    rulesetName: rulesetName
  };

  console.log('Aplicando ruleset a Firestore via Admin API...');

  try {
    const secRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):setSecurityPolicy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          securityPolicy: {
            rulesetName: rulesetName
          },
          etag: ''
        })
      }
    );

    if (!secRes.ok) {
      const e2 = await secRes.text();
      console.warn(`Error setSecurityPolicy (${secRes.status}):`, e2);

      console.log('\nLas reglas se subieron como ruleset pero no se pudieron aplicar automáticamente.');
      console.log('Aplicá el ruleset manualmente desde Firebase Console:');
      console.log('  1. Ir a https://console.firebase.google.com');
      console.log(`  2. Proyecto: ${projectId}`);
      console.log('  3. Firestore → Reglas');
      console.log('  4. Haz clic en "Publicar"');
      console.log('\nO desde la terminal (después de hacer firebase login):');
      console.log(`  npx firebase-tools deploy --only firestore:rules --project ${projectId}`);
      process.exit(1);
    }

    const result = await secRes.json();
    console.log('Security policy actualizada ✅');
  } catch (e) {
    console.error('Error de red:', e.message);
    process.exit(1);
  }

  console.log('\nReglas desplegadas correctamente ✅');
  process.exit(0);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });

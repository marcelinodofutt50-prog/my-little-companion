import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretórios a serem ignorados
const IGNORE_DIRS = ['node_modules', '.git', 'dist', '.output', '.vinxi'];
const ASSET_DIR = path.join(process.cwd(), 'public/assets');

/**
 * Encontra recursivamente todos os arquivos em um diretório
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

/**
 * Valida referências a arquivos estáticos
 */
async function validateAssets() {
  console.log('🔍 Iniciando validação de assets em public/assets...');

  // 1. Mapear arquivos existentes em public/assets
  if (!fs.existsSync(ASSET_DIR)) {
    console.error('❌ Diretório public/assets não encontrado!');
    process.exit(1);
  }

  const existingAssets = fs.readdirSync(ASSET_DIR);
  console.log(`📦 Assets encontrados: ${existingAssets.length}`);

  // 2. Escanear código fonte em busca de referências a /assets/
  const srcDir = path.join(process.cwd(), 'src');
  const sourceFiles = getAllFiles(srcDir).filter(f => 
    f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')
  );

  let missingAssets = new Set();
  let totalReferences = 0;

  sourceFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Regex para encontrar padrões como "/assets/nome-do-arquivo.ext" ou referências em .asset.json
    // Captura o nome do arquivo ignorando query strings como ?v=v8-400
    // Ignora importações de .asset.json (que são tratadas pelo Lovable Cloud)
    const assetRegex = /\/assets\/([\w.-]+)(?:\?[\w.=-]*)?/g;
    let match;

    while ((match = assetRegex.exec(content)) !== null) {
      const assetName = match[1];
      totalReferences++;

      if (!existingAssets.includes(assetName) && !assetName.endsWith('.asset.json')) {
        missingAssets.add(`${assetName} (referenciado em ${path.relative(process.cwd(), file)})`);
      }
    }
  });

  console.log(`🔗 Total de referências a /assets/ encontradas: ${totalReferences}`);

  if (missingAssets.size > 0) {
    console.error('\n❌ ERRO: Assets referenciados mas não encontrados em public/assets:');
    missingAssets.forEach(asset => console.error(`   - ${asset}`));
    process.exit(1);
  } else {
    console.log('\n✅ Sucesso: Todos os assets referenciados existem em public/assets.');
  }
}

validateAssets().catch(err => {
  console.error('❌ Falha inesperada durante a validação:', err);
  process.exit(1);
});

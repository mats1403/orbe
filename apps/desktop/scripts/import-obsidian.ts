import { readdir, readFile, writeFile, mkdir, stat, copyFile } from "node:fs/promises";
import { join, extname, basename, relative, dirname } from "node:path";
import { randomUUID } from "node:crypto";

// Regex para encontrar wikilinks do Obsidian: [[Nome da Nota]] ou [[Nome da Nota|Texto Alternativo]]
const WIKILINK_REGEX = /\[\[(.*?)\]\]/g;

// Regex simples para frontmatter YAML
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

interface OrbePage {
  id: string;
  title: string;
  content: any[]; // Formato Tiptap JSON ou Markdown raw
  parentId: string | null;
  icon?: string;
  isFavorite: boolean;
  updatedAt: string;
}

export async function importObsidianVault(inputPath: string, outputPath: string) {
  console.log(`Iniciando importação de: ${inputPath}`);
  console.log(`Destino: ${outputPath}`);

  await mkdir(outputPath, { recursive: true });
  await mkdir(join(outputPath, "pages"), { recursive: true });
  await mkdir(join(outputPath, "assets"), { recursive: true });

  const pagesMap = new Map<string, OrbePage>();
  const fileToIdMap = new Map<string, string>(); // Mapeia nome do arquivo para UUID

  async function scanDirectory(currentPath: string, parentId: string | null = null) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // Ignora .obsidian, .git, etc

      const fullPath = join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        // No Orbe, uma pasta pode ser representada como uma página pai vazia ou ignorada
        // Por enquanto, criamos uma página pai para manter a hierarquia
        const folderId = randomUUID();
        pagesMap.set(folderId, {
          id: folderId,
          title: entry.name,
          content: [{ type: "paragraph", content: [] }], // Pasta vazia no Tiptap
          parentId,
          isFavorite: false,
          updatedAt: new Date().toISOString()
        });
        fileToIdMap.set(entry.name, folderId);
        
        await scanDirectory(fullPath, folderId);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        
        if (ext === ".md") {
          await processMarkdownFile(fullPath, entry.name, parentId);
        } else if ([".png", ".jpg", ".jpeg", ".gif", ".pdf", ".xlsx"].includes(ext)) {
          await processAssetFile(fullPath, entry.name);
        }
      }
    }
  }

  async function processMarkdownFile(filePath: string, fileName: string, parentId: string | null) {
    const rawContent = await readFile(filePath, "utf-8");
    const id = randomUUID();
    const title = basename(fileName, ".md");
    
    fileToIdMap.set(title, id); // Mapeia o título para o UUID (para resolver wikilinks)

    // Parse básico de frontmatter
    let contentSemFrontmatter = rawContent;
    const match = rawContent.match(FRONTMATTER_REGEX);
    if (match) {
      contentSemFrontmatter = rawContent.slice(match[0].length).trim();
    }

    // Como o Orbe usa Tiptap, podemos armazenar o raw Markdown ou converter para JSON
    // O importador manterá o conteúdo raw por enquanto para o Orbe Desktop processar
    pagesMap.set(id, {
      id,
      title,
      // No novo motor Local-First, o conteúdo pode ser apenas uma referência ao arquivo local
      content: [{ type: "markdown", data: { text: contentSemFrontmatter } }],
      parentId,
      isFavorite: false,
      updatedAt: new Date().toISOString()
    });
    
    // Salva o arquivo físico também na pasta pages
    await writeFile(join(outputPath, "pages", `${id}.md`), contentSemFrontmatter);
  }

  async function processAssetFile(filePath: string, fileName: string) {
    const id = randomUUID();
    const ext = extname(fileName);
    const newName = `${id}${ext}`;
    await copyFile(filePath, join(outputPath, "assets", newName));
    fileToIdMap.set(fileName, id);
  }

  await scanDirectory(inputPath);

  // Segunda passagem: resolver wikilinks nos arquivos gerados
  console.log("Resolvendo links...");
  for (const [id, page] of pagesMap.entries()) {
    const pagePath = join(outputPath, "pages", `${id}.md`);
    try {
      let content = await readFile(pagePath, "utf-8");
      
      content = content.replace(WIKILINK_REGEX, (match, linkText) => {
        const parts = linkText.split("|");
        const target = parts[0];
        const alias = parts[1] || target;
        
        const targetId = fileToIdMap.get(target);
        if (targetId) {
          return `[${alias}](orbe://page/${targetId})`; // Link interno do Orbe
        }
        return `[${alias}]()`; // Link quebrado
      });

      await writeFile(pagePath, content);
      
      // Atualiza o JSON
      page.content = [{ type: "markdown", data: { text: content } }];
    } catch (e) {
      // É uma pasta/página pai que não tem arquivo físico .md
    }
  }

  // Salvar o index/banco de dados local
  await writeFile(join(outputPath, "orbe-metadata.json"), JSON.stringify(Array.from(pagesMap.values()), null, 2));

  console.log("Importação concluída com sucesso!");
  console.log(`Foram processadas ${pagesMap.size} páginas/pastas.`);
}

// Execução via CLI: bun run import-obsidian.ts /caminho/obsidian /caminho/orbe-vault
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Uso: bun run import-obsidian.ts <caminho-origem-obsidian> <caminho-destino-orbe>");
    process.exit(1);
  }
  importObsidianVault(args[0], args[1]).catch(console.error);
}

import ts from 'typescript';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
for(const file of ['lib/events.ts','lib/verification.ts','lib/catalog-worldwide.ts','lib/catalog-expanded.ts','lib/catalog-data.ts','lib/ingestion-core.ts','tests/core.test.ts']){const source=await readFile(file,'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from (["'])(\.\.?\/[^"']+)\1/g,(_m,quote,specifier)=>`from ${quote}${specifier}.mjs${quote}`);const target=path.join('.sites-runtime/tests',file.replace(/\.ts$/,'.mjs'));await mkdir(path.dirname(target),{recursive:true});await writeFile(target,js);}
const result=spawnSync(process.execPath,['--test','.sites-runtime/tests/tests/core.test.mjs'],{stdio:'inherit'});process.exit(result.status??1);

// mergeApp.js
const fs = require('fs');
const path = require('path');
const recast = require('recast');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const parseOpts = {
    sourceType: 'module',
    plugins: [
        'jsx',
        'optionalChaining',
        'nullishCoalescingOperator',
        // dodaj tu inne, jeśli ich potrzebujesz, np. 'classProperties'
    ]
};

// 1) Wczytanie obu wersji
const fileA = path.join(__dirname, 'App.js');
const fileB = path.join(__dirname, 'App.Szymon.js');
if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
    console.error('❌ Brakuje App.js lub App.Szymon.js w tym folderze!');
    process.exit(1);
}
const codeA = fs.readFileSync(fileA, 'utf8');
const codeB = fs.readFileSync(fileB, 'utf8');

// 2) Parsowanie do AST
const astA = recast.parse(codeA, { parser: { parse: src => parser.parse(src, parseOpts) } });
const astB = recast.parse(codeB, { parser: { parse: src => parser.parse(src, parseOpts) } });

// 3) Ekstrakcja i de-duplikacja importów
const importsMap = new Map();
function collectImports(ast) {
    traverse(ast, {
        ImportDeclaration(path) {
            const src = path.node.source.value;
            if (!importsMap.has(src)) importsMap.set(src, new Set());
            path.node.specifiers.forEach(sp => {
                if (t.isImportDefaultSpecifier(sp)) importsMap.get(src).add('default');
                else if (t.isImportNamespaceSpecifier(sp)) importsMap.get(src).add('*');
                else importsMap.get(src).add(sp.local.name);
            });
            path.remove();
            return false;
        }
    });
}
collectImports(astA);
collectImports(astB);

// 4) Skonstruowanie jednej listy importów
const mergedImports = [];
for (let [src, specs] of importsMap) {
    const named = Array.from(specs).filter(n => n !== 'default' && n !== '*').sort();
    const specifiers = [];
    if (specs.has('*')) {
        specifiers.push(t.importNamespaceSpecifier(t.identifier(named[0] || 'React')));
    } else {
        if (specs.has('default')) specifiers.push(t.importDefaultSpecifier(t.identifier('React')));
        named.forEach(n => specifiers.push(t.importSpecifier(t.identifier(n), t.identifier(n))));
    }
    mergedImports.push(t.importDeclaration(specifiers, t.stringLiteral(src)));
}

// 5) Połączenie ciał modułów
const bodyA = astA.program.body;
const bodyB = astB.program.body;
const mergedBody = [...mergedImports, ...bodyA, ...bodyB];

// 6) Generowanie i zapis wynikowego pliku
const finalAst = t.file(t.program(mergedBody));
const output = recast.print(finalAst).code;
const outPath = path.join(__dirname, 'App.merged.js');
fs.writeFileSync(outPath, output, 'utf8');
console.log('✅ Gotowe! Wygenerowano:', outPath);

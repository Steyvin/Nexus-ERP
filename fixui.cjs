const fs = require('fs');
const path = 'c:/Users/steyv/OneDrive/Documentos/PROYECTOS/nexus-erp/src/routes/calculadoras/+page.svelte';

let content = fs.readFileSync(path, 'utf8');

const sIdx = content.indexOf("{#if tabActiva === 'nube' || tabActiva === 'letra'}");
const eIdx = content.indexOf("{:else if tabActiva === 'neon'}");

let block = content.substring(sIdx, eIdx);

// Block NUBE
let nubeBlock = block.replace("{#if tabActiva === 'nube' || tabActiva === 'letra'}", "{#if tabActiva === 'nube'}");
nubeBlock = nubeBlock.replace(/aviso\./g, "nube.");

// Remove faja letra from nubeBlock
const nubeFajaLetraRegex = /\{\:else\}\s*<!-- Letra a letra -->\s*<div class="grid grid-cols-2 gap-3">\s*<div>\s*<label class="label-field">Perímetro Total \(cm\)<\/label>\s*<input type="number" bind:value=\{nube\.perimetro_cm\} min="1" class="input-calc" \/>\s*<p class="mt-1 text-\[10px\] text-\[var\(--text-dim\)\]">Suma obligatoria de todas las letras<\/p>\s*<\/div>\s*<div>\s*<label class="label-field">Grosor faja \(cm\)<\/label>\s*<input type="number" bind:value=\{nube\.faja_ancho_cm\} min="1" class="input-calc" \/>\s*<\/div>\s*<\/div>\s*/g;
nubeBlock = nubeBlock.replace(nubeFajaLetraRegex, "");

// Convert {#if tabActiva === 'nube'} inside faja to just unconditional for nubeBlock
const matchIfNube = /\{#if tabActiva === 'nube'\}\s*<label class="toggle-row-between">/;
if (nubeBlock.match(matchIfNube)) {
  nubeBlock = nubeBlock.replace(matchIfNube, "<label class=\"toggle-row-between\">");
  const closeIfIdx = nubeBlock.indexOf("{/if}", nubeBlock.indexOf("<!-- Letra a letra -->"));
  if (closeIfIdx > -1) {
    // We already removed {:else}... so we just need to remove {/if}
  }
}

// Ensure the Faja conditional is removed fully.
// Let's just string manipulate it perfectly.
nubeBlock = nubeBlock.replace("{#if tabActiva === 'nube'}\r\n\t\t\t\t\t\t\t\t<label class=\"toggle-row-between\">", "<label class=\"toggle-row-between\">");
nubeBlock = nubeBlock.replace("{#if tabActiva === 'nube'}\n\t\t\t\t\t\t\t\t<label class=\"toggle-row-between\">", "<label class=\"toggle-row-between\">");
nubeBlock = nubeBlock.replace(/\{\:else\}\s*\r?\n\s*<!-- Letra a letra -->[\s\S]*?\{\/if\}/, "");


// Block LETRA
let letraBlock = block.replace("{#if tabActiva === 'nube' || tabActiva === 'letra'}", "{:else if tabActiva === 'letra'}");
letraBlock = letraBlock.replace(/aviso\./g, "letra.");

// For Letra, we remove the Nube IF part in Faja
// Actually, in Letra block, `{#if tabActiva === 'nube'}` will logically evaluate to false. 
// However, let's clean it up to just not have the if-else.
letraBlock = letraBlock.replace(/\{#if tabActiva === 'nube'\}[\s\S]*?\{\:else\}/, "");
letraBlock = letraBlock.replace(/\{\/if\}\s*<\/div>\s*<\/div>\s*<\/div>\s*<!-- Apliques -->/, "</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\n\t\t\t\t<!-- Apliques -->");


let finalHTML = nubeBlock + "\n\n\t\t\t" + letraBlock;

content = content.substring(0, sIdx) + finalHTML + content.substring(eIdx);

fs.writeFileSync(path, content, 'utf8');
console.log("SUCCESS");

import sharp from 'sharp';
import opentype from 'opentype.js';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const svgPath = args[0] ? path.resolve(args[0]) : path.join(process.cwd(), 'input.svg');
const outputPath = args[1] ? path.resolve(args[1]) : path.join(process.cwd(), 'output.png');
const fontPath = path.join(process.cwd(), 'fonts', 'SourceHanSansSC-Normal.otf');
const fontName = 'SourceHanSansSC';

const DPI = 300;

sharp.cache({ fonts: [fontPath] });

const font = opentype.loadSync(fontPath);

let svgContent = fs.readFileSync(svgPath, 'utf8');
svgContent = svgContent.replace(/font-family="[^"]*PuHuiTi[^"]*"/g, `font-family="${fontName}"`);
svgContent = svgContent.replace(/#PuHuiTi/g, `#${fontName}`);

const foreignObjectRegex = /<foreignObject([^>]*)>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/foreignObject>/g;
let match;

while ((match = foreignObjectRegex.exec(svgContent)) !== null) {
  const fullMatch = match[0];
  const attrs = match[1];
  const textContent = match[2].replace(/<[^>]+>/g, '').trim();

  const xMatch = attrs.match(/x="([^"]*)"/);
  const yMatch = attrs.match(/y="([^"]*)"/);
  const widthMatch = attrs.match(/width="([^"]*)"/);
  const heightMatch = attrs.match(/height="([^"]*)"/);

  const x = xMatch ? parseFloat(xMatch[1]) : 0;
  const y = yMatch ? parseFloat(yMatch[1]) : 0;

  const spanStyleRegex = /<span[^>]*style="([^"]*)"/;
  const spanStyleMatch = fullMatch.match(spanStyleRegex);
  let fontSize = 16;
  let fill = '#000000';

  if (spanStyleMatch) {
    const style = spanStyleMatch[1];
    const fsMatch = style.match(/font-size:(\d+)px/);
    const colorMatch = style.match(/color:([^;]+)/);
    if (fsMatch) fontSize = parseFloat(fsMatch[1]);
    if (colorMatch) fill = colorMatch[1].trim();
  }

  if (textContent) {
    const path = font.getPath(textContent, x, y + fontSize * 0.85, fontSize, {
      align: 'center',
      features: { }
    });
    const pathData = path.toPathData(2);
    const pathElement = `<path d="${pathData}" fill="${fill}" />`;

    svgContent = svgContent.replace(fullMatch, pathElement);
  }
}

sharp(Buffer.from(svgContent), { limit: 0, density: DPI })
  .flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log(`Converted to PNG at ${DPI} DPI: ${outputPath}`);
  })
  .catch(err => {
    console.error('Error:', err);
  });
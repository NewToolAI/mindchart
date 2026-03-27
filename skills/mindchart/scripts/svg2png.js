import sharp from 'sharp';
import opentype from 'opentype.js';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const svgPath = args[0] ? path.resolve(args[0]) : path.join(process.cwd(), 'input.svg');
const outputPath = args[1] ? path.resolve(args[1]) : path.join(process.cwd(), 'output.png');
const fontPath = path.join(process.cwd(), 'skills', 'mindchart', 'fonts', 'SourceHanSansSC-Normal.otf');
const fontName = 'SourceHanSansSC';

const DPI = 300;

sharp.cache({ fonts: [fontPath] });

const font = opentype.loadSync(fontPath);

function measureTextWidth(text, fontSize) {
  const p = font.getPath(text, 0, 0, fontSize);
  const box = p.getBoundingBox();
  return box.x2 - box.x1;
}

let svgContent = fs.readFileSync(svgPath, 'utf8');
svgContent = svgContent.replace(/font-family="[^"]*PuHuiTi[^"]*"/g, `font-family="${fontName}"`);
svgContent = svgContent.replace(/#PuHuiTi/g, `#${fontName}`);

function wrapText(text, maxWidth, fontSize, measureFn) {
  const lines = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    
    let currentLine = '';
    const chars = paragraph.split('');
    
    for (const char of chars) {
      if (char === ' ') {
        if (currentLine.trim()) {
          currentLine += char;
        }
        continue;
      }
      
      const testLine = currentLine + char;
      const width = measureFn(testLine, fontSize);
      
      if (width > maxWidth && currentLine !== '') {
        lines.push(currentLine.trim());
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }
  
  return lines;
}

const foreignObjectRegex = /<foreignObject([^>]*)>([\s\S]*?)<\/foreignObject>/g;
let match;

while ((match = foreignObjectRegex.exec(svgContent)) !== null) {
  const fullMatch = match[0];
  const attrs = match[1];
  const foreignObjectContent = match[2];

  const xMatch = attrs.match(/x="([^"]*)"/);
  const yMatch = attrs.match(/y="([^"]*)"/);
  const widthMatch = attrs.match(/width="([^"]*)"/);
  const heightMatch = attrs.match(/height="([^"]*)"/);

  const x = xMatch ? parseFloat(xMatch[1]) : 0;
  const y = yMatch ? parseFloat(yMatch[1]) : 0;
  const containerWidth = widthMatch ? parseFloat(widthMatch[1]) : 200;

  const spanStyleRegex = /<span[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/span>/;
  const spanStyleMatch = foreignObjectContent.match(spanStyleRegex);
  let fontSize = 16;
  let fill = '#000000';
  let lineHeight = 1.4;
  let textAlign = 'center';
  let textContent = '';

  if (spanStyleMatch) {
    const style = spanStyleMatch[1];
    textContent = spanStyleMatch[2].replace(/<[^>]+>/g, '').trim();
    const fsMatch = style.match(/font-size:(\d+(?:\.\d+)?)px/);
    const colorMatch = style.match(/color:\s*([^;]+)/);
    const lhMatch = style.match(/line-height:\s*([^;]+)/);
    const alignMatch = style.match(/text-align:\s*([^;]+)/);
    if (fsMatch) fontSize = parseFloat(fsMatch[1]);
    if (colorMatch) fill = colorMatch[1].trim();
    if (lhMatch) lineHeight = parseFloat(lhMatch[1]);
    if (alignMatch) textAlign = alignMatch[1].trim();
  }

  if (textContent) {
    const lines = wrapText(textContent, containerWidth, fontSize, measureTextWidth);
    const lineHeightPx = fontSize * lineHeight;
    const totalHeight = lines.length * lineHeightPx;
    let startY = y + (totalHeight > fontSize * lineHeight ? fontSize * 0.85 : fontSize * 0.85 + (fontSize * lineHeight - totalHeight) / 2);
    
    const pathElements = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let lineX = x;
      
      if (textAlign === 'center') {
        const lineWidth = measureTextWidth(line, fontSize);
        lineX = x + (containerWidth - lineWidth) / 2;
      } else if (textAlign === 'right') {
        const lineWidth = measureTextWidth(line, fontSize);
        lineX = x + containerWidth - lineWidth;
      }
      
      const lineY = startY + i * lineHeightPx;
      const path = font.getPath(line, lineX, lineY, fontSize, {
        align: 'left',
        features: {}
      });
      const pathData = path.toPathData(2);
      pathElements.push(`<path d="${pathData}" fill="${fill}" />`);
    }

    svgContent = svgContent.replace(fullMatch, pathElements.join(''));
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
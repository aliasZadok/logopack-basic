import { createRouter } from 'next-connect';
import multer from 'multer';
import sharp from 'sharp';
import { exec } from 'child_process';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { extend, colord } from 'colord';
import cmykPlugin from 'colord/plugins/cmyk';
import xml2js from 'xml2js';
import { optimize } from 'svgo';
import { Resvg } from '@resvg/resvg-js';

extend([cmykPlugin]);

const upload = multer({ dest: 'uploads/' });

const router = createRouter();

router.use(upload.single('file'));

const optimizeSvg = (svgContent) => {
    const optimizedSvg = optimize(svgContent, { multipass: true }).data;
    return optimizedSvg;
};

const addIccColorToSvg = (svgContent, cmykColors) => {
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder();
    let modifiedSvg;

    parser.parseString(svgContent, (err, result) => {
        if (err) {
            console.error('Error parsing SVG content:', err);
            throw new Error('Error parsing SVG content');
        }

        const hexToRgb = (hex) => {
            const { r, g, b } = colord(hex).toRgb();
            return `rgb(${r}, ${g}, ${b})`;
        };

        const hexToCmyk = (hex) => {
            const rgb = colord(hex).toRgb();
            return colord(rgb).toCmyk();
        };

        const colorsMatch = (cmyk1, cmyk2, tolerance = 1) => {
            return (
                Math.abs(cmyk1.c - cmyk2.c) <= tolerance &&
                Math.abs(cmyk1.m - cmyk2.m) <= tolerance &&
                Math.abs(cmyk1.y - cmyk2.y) <= tolerance &&
                Math.abs(cmyk1.k - cmyk2.k) <= tolerance
            );
        };

        const traverseAndUpdateColors = (node, depth = 0) => {
            if (Array.isArray(node)) {
                node.forEach((childNode, index) => {
                    traverseAndUpdateColors(childNode, depth + 1);
                });
            } else if (typeof node === 'object' && node !== null) {
                if (node.$) {
                    ['fill', 'stroke'].forEach(attr => {
                        if (node.$[attr]) {
                            const cmykValue = hexToCmyk(node.$[attr]);
                            cmykColors.forEach((cmyk) => {
                                const cmykColor = { c: cmyk.c, m: cmyk.m, y: cmyk.y, k: cmyk.k };
                                const cmykString = `icc-color(#CMYK, ${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
                                if (colorsMatch(cmykValue, cmykColor)) {
                                    const rgb = hexToRgb(node.$[attr]);
                                    node.$[attr] = `${rgb} ${cmykString}`;
                                }
                            });
                        }
                    });
                }
            }
        };

        traverseAndUpdateColors(result.svg);
        modifiedSvg = builder.buildObject(result);
    });

    return modifiedSvg;
};

const addSizeAttributesToSvg = (svgContent, newWidth, newHeight) => {
  let modifiedSvg = svgContent;

  // Extract existing viewBox
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']*)["']/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

  if (!viewBox) {
      console.error('SVG does not have a viewBox attribute');
      return svgContent;
  }

  // Calculate aspect ratio from viewBox
  const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
  const aspectRatio = vbWidth / vbHeight;

  // Prepare new SVG tag
  let newSvgOpenTag = modifiedSvg.match(/<svg[^>]*>/)[0];

  if (newWidth) {
      const calculatedHeight = Math.round(newWidth / aspectRatio);
      newSvgOpenTag = newSvgOpenTag.replace(/width=["'][^"']*["']/, '');
      newSvgOpenTag = newSvgOpenTag.replace(/height=["'][^"']*["']/, '');
      newSvgOpenTag = newSvgOpenTag.replace(/<svg/, `<svg width="${newWidth}" height="${calculatedHeight}"`);
  } else if (newHeight) {
      const calculatedWidth = Math.round(newHeight * aspectRatio);
      newSvgOpenTag = newSvgOpenTag.replace(/width=["'][^"']*["']/, '');
      newSvgOpenTag = newSvgOpenTag.replace(/height=["'][^"']*["']/, '');
      newSvgOpenTag = newSvgOpenTag.replace(/<svg/, `<svg width="${calculatedWidth}" height="${newHeight}"`);
  }

  // Ensure viewBox is present
  if (!newSvgOpenTag.includes('viewBox')) {
      newSvgOpenTag = newSvgOpenTag.replace(/<svg/, `<svg viewBox="${viewBox}"`);
  }

  modifiedSvg = modifiedSvg.replace(/<svg[^>]*>/, newSvgOpenTag);

  return modifiedSvg;
};

const sanitizeFileName = (fileName) => {
    return fileName.replace(/\s+/g, '_');
};

const convertSvgToPdf = async (inputPath, outputPath, isWhiteVariant) => {
    if (isWhiteVariant) {
        const svgContent = fs.readFileSync(inputPath, 'utf-8');
        const pdfDoc = new PDFDocument();
        const stream = fs.createWriteStream(outputPath);

        pdfDoc.pipe(stream);
        pdfDoc.rect(0, 0, pdfDoc.page.width, pdfDoc.page.height).fill('black');
        SVGtoPDF(pdfDoc, svgContent, 0, 0, { assumePt: true });
        pdfDoc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    } else {
        return new Promise((resolve, reject) => {
            exec(`inkscape ${inputPath} --export-type=pdf --export-filename=${outputPath}`, (error) => {
                if (error) {
                    console.error('Error converting SVG to PDF:', error);
                    return reject(error);
                }
                resolve();
            });
        });
    }
};

const convertSvgToPng = async (svgContent, outputPath) => {
  
  const resvg = new Resvg(svgContent);
  const pngBuffer = resvg.render().asPng();
  
  await sharp(pngBuffer)
      .png()
      .toFile(outputPath);

};

const convertSvgToJpg = async (svgContent, outputPath, isWhiteVariant, quality = 100) => {
  
  const resvg = new Resvg(svgContent);
  const pngBuffer = resvg.render().asPng();

  const backgroundColor = isWhiteVariant ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };

  await sharp(pngBuffer)
      .flatten({ background: backgroundColor })
      .jpeg({ quality })
      .toFile(outputPath);

};

const convertSvgToWebp = async (svgContent, outputPath, quality = 100) => {
  
  const resvg = new Resvg(svgContent);
  const pngBuffer = resvg.render().asPng();
  
  await sharp(pngBuffer)
      .webp({ quality })
      .toFile(outputPath);

};

router.post(async (req, res) => {
  const file = req.file;
  const rawFormats = req.body.formats.split(',');
  const colors = req.body.colors.split(',');
  const fileName = sanitizeFileName(req.body.fileName || 'logopack');
  const svgVariants = JSON.parse(req.body.svgVariants);
  const sizes = svgVariants.sizes || [];
  const selectedVariants = JSON.parse(req.body.selectedVariants);
  const cmykColors = JSON.parse(req.body.cmykColors || '[]');

  const zip = new JSZip();
  const svgPath = path.join(process.cwd(), file.path);
  const outputDir = path.join(process.cwd(), 'output');

  if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
  }

  const formats = rawFormats.filter(f => f !== 'rgb' && f !== 'cmyk');

  const processVariants = async (variantName, svgContent, width, height) => {
      const optimizedSvgContent = optimizeSvg(svgContent);
      const modifiedSvgContent = addSizeAttributesToSvg(optimizedSvgContent, width, height);
      const tempSvgPath = path.join(outputDir, `${variantName}.svg`);
      fs.writeFileSync(tempSvgPath, modifiedSvgContent);

      for (const format of formats) {
          const outputPath = path.join(outputDir, `${variantName}.${format}`);

          try {
              if (format === 'png') {
                  await convertSvgToPng(modifiedSvgContent, outputPath);
              } else if (format === 'jpg') {
                  await convertSvgToJpg(modifiedSvgContent, outputPath, variantName.includes('White'));
              } else if (format === 'webp') {
                  await convertSvgToWebp(modifiedSvgContent, outputPath);
              } else if (format === 'pdf') {
                  await convertSvgToPdf(tempSvgPath, outputPath, variantName.includes('White'));
              } else if (format === 'eps') {
                  await convertSvgToEps(tempSvgPath, outputPath);
              } else if (format === 'ai') {
                  const epsPath = path.join(outputDir, `${variantName}.eps`);
                  await convertSvgToEps(tempSvgPath, epsPath);
                  await convertEpsToAi(epsPath, outputPath);
                  fs.unlinkSync(epsPath);
              }

              const fileBuffer = fs.readFileSync(outputPath);
              zip.file(`${variantName}.${format}`, fileBuffer);

              fs.unlinkSync(outputPath);
          } catch (error) {
              console.error(`Error converting ${variantName} to ${format}:`, error);
          }
      }

      fs.unlinkSync(tempSvgPath);
  };

  const fullColorSvg = optimizeSvg(addIccColorToSvg(svgVariants.fullColor, cmykColors));
  const whiteSvg = optimizeSvg(addIccColorToSvg(svgVariants.white, cmykColors));
  const blackSvg = optimizeSvg(addIccColorToSvg(svgVariants.black, cmykColors));

  const processColorSystem = async (colorSystem) => {
      const prefix = colorSystem === 'cmyk' ? 'CMYK' : 'RGB';

      if (selectedVariants.includes('fullColor')) {
          await processVariants(`${fileName}_${prefix}_Full_Color`, fullColorSvg);
      }
      if (selectedVariants.includes('white')) {
          await processVariants(`${fileName}_${prefix}_White`, whiteSvg);
      }
      if (selectedVariants.includes('black')) {
          await processVariants(`${fileName}_${prefix}_Black`, blackSvg);
      }

      if (sizes.length > 0) {
          for (const size of sizes) {
              if (size.type === 'Width') {
                  if (selectedVariants.includes('fullColor')) {
                      await processVariants(`${fileName}_${prefix}_${size.value}W_Full_Color`, fullColorSvg, size.value, null);
                  }
                  if (selectedVariants.includes('white')) {
                      await processVariants(`${fileName}_${prefix}_${size.value}W_White`, whiteSvg, size.value, null);
                  }
                  if (selectedVariants.includes('black')) {
                      await processVariants(`${fileName}_${prefix}_${size.value}W_Black`, blackSvg, size.value, null);
                  }
              } else if (size.type === 'Height') {
                  if (selectedVariants.includes('fullColor')) {
                      await processVariants(`${fileName}_${prefix}_${size.value}H_Full_Color`, fullColorSvg, null, size.value);
                  }
                  if (selectedVariants.includes('white')) {
                      await processVariants(`${fileName}_${prefix}_${size.value}H_White`, whiteSvg, null, size.value);
                  }
                  if (selectedVariants.includes('black')) {
                      await processVariants(`${fileName}_${prefix}_${size.value}H_Black`, blackSvg, null, size.value);
                  }
              } else if (size.type === 'Dimensions') {
                  const { width, height } = size.value;
                  if (selectedVariants.includes('fullColor')) {
                      await processVariants(`${fileName}_${prefix}_${width}x${height}_Full_Color`, fullColorSvg, width, height);
                  }
                  if (selectedVariants.includes('white')) {
                      await processVariants(`${fileName}_${prefix}_${width}x${height}_White`, whiteSvg, width, height);
                  }
                  if (selectedVariants.includes('black')) {
                      await processVariants(`${fileName}_${prefix}_${width}x${height}_Black`, blackSvg, width, height);
                  }
              }
          }
      }
  };

  if (colors.includes('rgb')) {
      await processColorSystem('rgb');
  }

  if (colors.includes('cmyk')) {
      await processColorSystem('cmyk');
  }

  fs.unlinkSync(svgPath);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}.zip`);
  res.send(zipBuffer);
});

export const config = {
  api: {
      bodyParser: false,
  },
};

export default router.handler();
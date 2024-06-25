import { createRouter } from 'next-connect';
import multer from 'multer';
import sharp from 'sharp';
import { exec } from 'child_process';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { extend } from 'colord';
import cmykPlugin from 'colord/plugins/cmyk';

extend([cmykPlugin]);

const upload = multer({ dest: 'uploads/' });

const router = createRouter();

router.use(upload.single('file'));

const addIccColorToSvg = (svgContent, primaryCmyk, secondaryCmyk) => {
  const cmykToString = (cmyk) => `icc-color(#CMYK, ${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

  return svgContent
    .replace(new RegExp(`fill="${primaryCmyk.rgb}"`, 'g'), `fill="${primaryCmyk.rgb} ${cmykToString(primaryCmyk)}"`)
    .replace(new RegExp(`fill="${secondaryCmyk.rgb}"`, 'g'), `fill="${secondaryCmyk.rgb} ${cmykToString(secondaryCmyk)}"`);
};

const addSizeAttributesToSvg = (svgContent, width, height) => {
  let modifiedSvg = svgContent;

  if (width) {
    modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/, `<svg$1 width="${width}">`);
  }
  if (height) {
    modifiedSvg = modifiedSvg.replace(/<svg([^>]*)>/, `<svg$1 height="${height}">`);
  }

  return modifiedSvg;
};

router.post(async (req, res) => {
  const file = req.file;
  const rawFormats = req.body.formats.split(',');
  const colors = req.body.colors.split(',');
  const fileName = req.body.fileName || 'logopack';
  const svgVariants = JSON.parse(req.body.svgVariants);
  const sizes = svgVariants.sizes || [];
  const selectedVariants = JSON.parse(req.body.selectedVariants);

  const primaryCmyk = {
    rgb: req.body.primaryColor,
    c: parseFloat(req.body.cmykPrimaryC),
    m: parseFloat(req.body.cmykPrimaryM),
    y: parseFloat(req.body.cmykPrimaryY),
    k: parseFloat(req.body.cmykPrimaryK),
  };
  const secondaryCmyk = {
    rgb: req.body.secondaryColor,
    c: parseFloat(req.body.cmykSecondaryC),
    m: parseFloat(req.body.cmykSecondaryM),
    y: parseFloat(req.body.cmykSecondaryY),
    k: parseFloat(req.body.cmykSecondaryK),
  };

  const zip = new JSZip();
  const svgPath = path.join(process.cwd(), file.path);
  const outputDir = path.join(process.cwd(), 'output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const colorSystems = rawFormats.filter(f => f === 'rgb' || f === 'cmyk');
  const formats = rawFormats.filter(f => f !== 'rgb' && f !== 'cmyk');

  const convertSvgToPng = async (inputPath, outputPath) => {
    await sharp(inputPath)
      .png()
      .toFile(outputPath);
  };

  const convertSvgToJpg = async (inputPath, outputPath, variantName) => {
    const isWhiteVariant = variantName.includes('White');
    const pipeline = sharp(inputPath)
      .flatten({ background: isWhiteVariant ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 } })
      .jpeg();
    await pipeline.toFile(outputPath);
  };

  const convertSvgToWebp = async (inputPath, outputPath) => {
    await sharp(inputPath)
      .webp()
      .toFile(outputPath);
  };

  const convertSvgToPdf = async (inputPath, outputPath) => {
    const svgContent = fs.readFileSync(inputPath, 'utf-8');
    const pdfDoc = new PDFDocument();
    const stream = fs.createWriteStream(outputPath);

    pdfDoc.pipe(stream);
    SVGtoPDF(pdfDoc, svgContent, 0, 0);
    pdfDoc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  };

  const convertSvgToEps = (inputPath, outputPath, callback) => {
    exec(`inkscape ${inputPath} --export-eps=${outputPath}`, callback);
  };

  const convertEpsToAi = (inputPath, outputPath, callback) => {
    exec(`pstoedit -f ps2ai ${inputPath} ${outputPath}`, callback);
  };

  const processVariants = async (variantName, svgContent, colorDir, width, height) => {
    const modifiedSvgContent = addSizeAttributesToSvg(svgContent, width, height);
    const tempSvgPath = path.join(outputDir, `${variantName}.svg`);
    fs.writeFileSync(tempSvgPath, modifiedSvgContent);

    for (const format of formats) {
      const outputPath = path.join(outputDir, `${variantName}.${format}`);

      try {
        if (format === 'png') {
          await convertSvgToPng(tempSvgPath, outputPath);
        } else if (format === 'jpg') {
          await convertSvgToJpg(tempSvgPath, outputPath, variantName);
        } else if (format === 'webp') {
          await convertSvgToWebp(tempSvgPath, outputPath);
        } else if (format === 'pdf') {
          await convertSvgToPdf(tempSvgPath, outputPath);
        } else if (format === 'eps') {
          await new Promise((resolve, reject) => {
            convertSvgToEps(tempSvgPath, outputPath, (error) => {
              if (error) return reject(error);
              resolve();
            });
          });
        } else if (format === 'ai') {
          const epsPath = path.join(outputDir, `${variantName}.eps`);
          await new Promise((resolve, reject) => {
            convertSvgToEps(tempSvgPath, epsPath, (error) => {
              if (error) return reject(error);
              resolve();
            });
          });
          await new Promise((resolve, reject) => {
            convertEpsToAi(epsPath, outputPath, (error) => {
              if (error) return reject(error);
              resolve();
            });
          });
          fs.unlinkSync(epsPath);
        }

        const fileBuffer = fs.readFileSync(outputPath);
        colorDir.file(`${variantName}.${format}`, fileBuffer);

        console.log(`Processed variant: ${variantName}, format: ${format}`);
        fs.unlinkSync(outputPath);
      } catch (error) {
        console.error(`Error converting ${variantName} to ${format}:`, error);
      }
    }

    fs.unlinkSync(tempSvgPath);
  };

  const fullColorSvg = addIccColorToSvg(svgVariants.fullColor, primaryCmyk, secondaryCmyk);
  const whiteSvg = addIccColorToSvg(svgVariants.white, primaryCmyk, secondaryCmyk);
  const blackSvg = addIccColorToSvg(svgVariants.black, primaryCmyk, secondaryCmyk);

  const mainFolder = zip.folder(fileName);
  const digitalFolder = mainFolder.folder('01_Digital');
  const printFolder = colors.includes('cmyk') ? mainFolder.folder('02_Print') : null;

  console.log('Processing RGB variants...');
  if (selectedVariants.includes('fullColor')) {
    await processVariants(`${fileName}_RGB_Full_Color`, fullColorSvg, digitalFolder.folder('01_Full_Color'));
  }
  if (selectedVariants.includes('white')) {
    await processVariants(`${fileName}_RGB_White`, whiteSvg, digitalFolder.folder('02_White'));
  }
  if (selectedVariants.includes('black')) {
    await processVariants(`${fileName}_RGB_Black`, blackSvg, digitalFolder.folder('03_Black'));
  }

  if (sizes.length > 0) {
    for (const size of sizes) {
      if (size.type === 'Width') {
        if (selectedVariants.includes('fullColor')) {
          await processVariants(`${fileName}_RGB_${size.value}W_Full_Color`, fullColorSvg, digitalFolder.folder('01_Full_Color'), size.value, null);
        }
        if (selectedVariants.includes('white')) {
          await processVariants(`${fileName}_RGB_${size.value}W_White`, whiteSvg, digitalFolder.folder('02_White'), size.value, null);
        }
        if (selectedVariants.includes('black')) {
          await processVariants(`${fileName}_RGB_${size.value}W_Black`, blackSvg, digitalFolder.folder('03_Black'), size.value, null);
        }
      } else if (size.type === 'Height') {
        if (selectedVariants.includes('fullColor')) {
          await processVariants(`${fileName}_RGB_${size.value}H_Full_Color`, fullColorSvg, digitalFolder.folder('01_Full_Color'), null, size.value);
        }
        if (selectedVariants.includes('white')) {
          await processVariants(`${fileName}_RGB_${size.value}H_White`, whiteSvg, digitalFolder.folder('02_White'), null, size.value);
        }
        if (selectedVariants.includes('black')) {
          await processVariants(`${fileName}_RGB_${size.value}H_Black`, blackSvg, digitalFolder.folder('03_Black'), null, size.value);
        }
      } else if (size.type === 'Dimensions') {
        const { width, height } = size.value;
        if (selectedVariants.includes('fullColor')) {
          await processVariants(`${fileName}_RGB_${width}x${height}_Full_Color`, fullColorSvg, digitalFolder.folder('01_Full_Color'), width, height);
        }
        if (selectedVariants.includes('white')) {
          await processVariants(`${fileName}_RGB_${width}x${height}_White`, whiteSvg, digitalFolder.folder('02_White'), width, height);
        }
        if (selectedVariants.includes('black')) {
          await processVariants(`${fileName}_RGB_${width}x${height}_Black`, blackSvg, digitalFolder.folder('03_Black'), width, height);
        }
      }
    }
  }

  if (printFolder) {
    console.log('Processing CMYK variants...');
    if (selectedVariants.includes('fullColor')) {
      await processVariants(`${fileName}_CMYK_Full_Color`, fullColorSvg, printFolder.folder('01_Full_Color'));
    }
    if (selectedVariants.includes('white')) {
      await processVariants(`${fileName}_CMYK_White`, whiteSvg, printFolder.folder('02_White'));
    }
    if (selectedVariants.includes('black')) {
      await processVariants(`${fileName}_CMYK_Black`, blackSvg, printFolder.folder('03_Black'));
    }

    if (sizes.length > 0) {
      for (const size of sizes) {
        if (size.type === 'Width') {
          if (selectedVariants.includes('fullColor')) {
            await processVariants(`${fileName}_CMYK_${size.value}W_Full_Color`, fullColorSvg, printFolder.folder('01_Full_Color'), size.value, null);
          }
          if (selectedVariants.includes('white')) {
            await processVariants(`${fileName}_CMYK_${size.value}W_White`, whiteSvg, printFolder.folder('02_White'), size.value, null);
          }
          if (selectedVariants.includes('black')) {
            await processVariants(`${fileName}_CMYK_${size.value}W_Black`, blackSvg, printFolder.folder('03_Black'), size.value, null);
          }
        } else if (size.type === 'Height') {
          if (selectedVariants.includes('fullColor')) {
            await processVariants(`${fileName}_CMYK_${size.value}H_Full_Color`, fullColorSvg, printFolder.folder('01_Full_Color'), null, size.value);
          }
          if (selectedVariants.includes('white')) {
            await processVariants(`${fileName}_CMYK_${size.value}H_White`, whiteSvg, printFolder.folder('02_White'), null, size.value);
          }
          if (selectedVariants.includes('black')) {
            await processVariants(`${fileName}_CMYK_${size.value}H_Black`, blackSvg, printFolder.folder('03_Black'), null, size.value);
          }
        } else if (size.type === 'Dimensions') {
          const { width, height } = size.value;
          if (selectedVariants.includes('fullColor')) {
            await processVariants(`${fileName}_CMYK_${width}x${height}_Full_Color`, fullColorSvg, printFolder.folder('01_Full_Color'), width, height);
          }
          if (selectedVariants.includes('white')) {
            await processVariants(`${fileName}_CMYK_${width}x${height}_White`, whiteSvg, printFolder.folder('02_White'), width, height);
          }
          if (selectedVariants.includes('black')) {
            await processVariants(`${fileName}_CMYK_${width}x${height}_Black`, blackSvg, printFolder.folder('03_Black'), width, height);
          }
        }
      }
    }
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

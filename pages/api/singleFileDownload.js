import { createRouter } from 'next-connect';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { optimize } from 'svgo';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import xml2js from 'xml2js';
import { colord, extend } from 'colord';
import cmykPlugin from 'colord/plugins/cmyk';
import namesPlugin from 'colord/plugins/names';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

extend([cmykPlugin, namesPlugin]);

const upload = multer({ dest: 'uploads/' });

const router = createRouter();

router.use(upload.single('file'));

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

const sanitizeFileName = (name) => name.replace(/\s+/g, '_');

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

const convertSvgToEps = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        exec(`inkscape ${inputPath} --export-eps=${outputPath}`, (error) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
};

const convertEpsToAi = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        exec(`pstoedit -f ps2ai ${inputPath} ${outputPath}`, (error) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
};

router.post(async (req, res) => {
    const file = req.file;
    const format = req.body.format;
    const color = req.body.color;
    let fileName = req.body.fileName || 'logopack';
    const svgVariants = JSON.parse(req.body.svgVariants);
    const size = JSON.parse(req.body.size || '{}');
    let width, height;
    if (size.type === 'Width') {
        width = Number(size.value);
    } else if (size.type === 'Height') {
        height = Number(size.value);
    } else if (size.type === 'Dimensions') {
        width = Number(size.value.width);
        height = Number(size.value.height);
    }
    const selectedVariant = req.body.selectedVariant;
    const cmykColors = JSON.parse(req.body.cmykColors || '[]');

    fileName = sanitizeFileName(fileName);
    const svgPath = path.join(process.cwd(), file.path);
    const outputDir = path.join(process.cwd(), 'output');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    let svgContent;
    let isWhiteVariant = false;
    if (selectedVariant === 'black') {
        svgContent = svgVariants.black;
    } else if (selectedVariant === 'white') {
        svgContent = svgVariants.white;
        isWhiteVariant = true;
    } else {
        svgContent = svgVariants.fullColor;
    }

    svgContent = optimize(svgContent, { multipass: true }).data;

    svgContent = addIccColorToSvg(svgContent, cmykColors);

    if (width) {
        svgContent = addSizeAttributesToSvg(svgContent, width, null);
    } else if (height) {
        svgContent = addSizeAttributesToSvg(svgContent, null, height);
    }

    const processSingleVariant = async (variantName, svgContent, format) => {
        const tempSvgPath = path.join(outputDir, `${variantName}.svg`);
        const outputPath = path.join(outputDir, `${variantName}.${format}`);

        fs.writeFileSync(tempSvgPath, svgContent);

        try {
            if (format === 'png') {
                await convertSvgToPng(svgContent, outputPath);
            } else if (format === 'jpg') {
                await convertSvgToJpg(svgContent, outputPath, isWhiteVariant);
            } else if (format === 'webp') {
                await convertSvgToWebp(svgContent, outputPath);
            } else if (format === 'pdf') {
                await convertSvgToPdf(tempSvgPath, outputPath, isWhiteVariant);
            } else if (format === 'eps') {
                await convertSvgToEps(tempSvgPath, outputPath);
            } else if (format === 'ai') {
                const epsPath = path.join(outputDir, `${variantName}.eps`);
                await convertSvgToEps(tempSvgPath, epsPath);
                await convertEpsToAi(epsPath, outputPath);
                fs.unlinkSync(epsPath);
            }

            const fileBuffer = fs.readFileSync(outputPath);
            res.setHeader('Content-Disposition', `attachment; filename=${variantName}.${format}`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(fileBuffer);

            fs.unlinkSync(outputPath);
            fs.unlinkSync(tempSvgPath);
        } catch (error) {
            console.error(`Error converting ${variantName} to ${format}:`, error);
            fs.unlinkSync(tempSvgPath);
        }
    };

    const variantName = `${fileName}_${selectedVariant}`;

    await processSingleVariant(variantName, svgContent, format);

    fs.unlinkSync(svgPath);
});

export const config = {
    api: {
        bodyParser: false,
    },
};

export default router.handler();
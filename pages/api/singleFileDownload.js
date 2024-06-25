import { createRouter } from 'next-connect';
import multer from 'multer';
import sharp from 'sharp';
import { exec } from 'child_process';
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
    const format = req.body.format;
    const color = req.body.color;
    const fileName = req.body.fileName || 'logopack';
    const svgVariant = JSON.parse(req.body.svgVariant);
    const size = JSON.parse(req.body.size);

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

    const svgPath = path.join(process.cwd(), file.path);
    const outputDir = path.join(process.cwd(), 'output');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

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

    const processSingleVariant = async (variantName, svgContent, format, width, height) => {
        const modifiedSvgContent = addSizeAttributesToSvg(svgContent, width, height);
        const tempSvgPath = path.join(outputDir, `${variantName}.svg`);
        const outputPath = path.join(outputDir, `${variantName}.${format}`);
    
        console.log('Temporary SVG Path:', tempSvgPath);
        console.log('Output Path:', outputPath);
    
        fs.writeFileSync(tempSvgPath, modifiedSvgContent);
    
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
                console.log('EPS Path:', epsPath);
    
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
    
            console.log('File processed successfully:', outputPath);
    
            const fileBuffer = fs.readFileSync(outputPath);
            res.setHeader('Content-Disposition', `attachment; filename=${variantName}.${format}`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(fileBuffer);
    
            console.log('Sent file to client:', outputPath);
    
            fs.unlinkSync(outputPath);
            fs.unlinkSync(tempSvgPath);
        } catch (error) {
            console.error(`Error converting ${variantName} to ${format}:`, error);
            fs.unlinkSync(tempSvgPath);
        }
    };
    
    // Main handler function
    router.post(async (req, res) => {
        const file = req.file;
        const format = req.body.format;
        const color = req.body.color;
        const fileName = req.body.fileName || 'logopack';
        const svgVariant = JSON.parse(req.body.svgVariant);
        const size = JSON.parse(req.body.size);
    
        console.log('Received Request:');
        console.log('Format:', format);
        console.log('Color:', color);
        console.log('FileName:', fileName);
        console.log('Size:', size);
    
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
    
        const svgPath = path.join(process.cwd(), file.path);
        const outputDir = path.join(process.cwd(), 'output');
    
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
    
        const svgContent = addIccColorToSvg(svgVariant, primaryCmyk, secondaryCmyk);
        const variantName = `${fileName}_${color}`;
    
        await processSingleVariant(variantName, svgContent, format, size?.width, size?.height);
    
        fs.unlinkSync(svgPath);
    });
    

    const svgContent = addIccColorToSvg(svgVariant, primaryCmyk, secondaryCmyk);
    const variantName = `${fileName}_${color}`;

    await processSingleVariant(variantName, svgContent, format, size?.width, size?.height);

    fs.unlinkSync(svgPath);
});

export const config = {
    api: {
        bodyParser: false,
    },
};

export default router.handler();

import { createRouter } from 'next-connect';
import multer from 'multer';
import sharp from 'sharp';
import { exec } from 'child_process';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

const upload = multer({ dest: 'uploads/' });

const router = createRouter();

router.use(upload.single('file'));

router.post(async (req, res) => {
    const file = req.file;
    const formats = req.body.formats.split(',');
    const colors = req.body.colors.split(',');
    const fileName = req.body.fileName || 'logopack';
    const svgVariants = JSON.parse(req.body.svgVariants);

    const zip = new JSZip();
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

    const convertSvgToJpg = async (inputPath, outputPath, isBlackSvg = false) => {
        const pipeline = sharp(inputPath)
            .flatten({ background: isBlackSvg ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 } })
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

    const processVariants = async (variantName, svgContent, colorDir, isBlackSvg = false) => {
        const tempSvgPath = path.join(outputDir, `${variantName}.svg`);
        fs.writeFileSync(tempSvgPath, svgContent);

        for (const format of formats) {
            const outputPath = path.join(outputDir, `${variantName}.${format}`);

            try {
                if (format === 'png') {
                    await convertSvgToPng(tempSvgPath, outputPath);
                } else if (format === 'jpg') {
                    await convertSvgToJpg(tempSvgPath, outputPath, isBlackSvg);
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

                fs.unlinkSync(outputPath);
            } catch (error) {
                console.error(`Error converting ${variantName} to ${format}:`, error);
            }
        }

        fs.unlinkSync(tempSvgPath);
    };

    const fullColorSvg = svgVariants.fullColor;
    const whiteSvg = svgVariants.white;
    const blackSvg = svgVariants.black;

    const mainFolder = zip.folder(fileName);
    const digitalFolder = mainFolder.folder('horizontal_logo').folder('01_digital');
    const printFolder = colors.includes('cmyk') ? mainFolder.folder('horizontal_logo').folder('02_print') : null;

    const digitalFullColorFolder = digitalFolder.folder('01_full_color');
    const digitalWhiteFolder = digitalFolder.folder('02_white_logo');
    const digitalBlackFolder = digitalFolder.folder('03_black_logo');

    await processVariants(`${fileName}_full_color_logo`, fullColorSvg, digitalFullColorFolder);
    await processVariants(`${fileName}_white_logo`, whiteSvg, digitalWhiteFolder);
    await processVariants(`${fileName}_black_logo`, blackSvg, digitalBlackFolder, true);

    if (printFolder) {
        const printFullColorFolder = printFolder.folder('01_full_color');
        const printWhiteFolder = printFolder.folder('02_white_logo');
        const printBlackFolder = printFolder.folder('03_black_logo');

        await processVariants(`${fileName}_full_color_logo`, fullColorSvg, printFullColorFolder, false);
        await processVariants(`${fileName}_white_logo`, whiteSvg, printWhiteFolder, false);
        await processVariants(`${fileName}_black_logo`, blackSvg, printBlackFolder, true);
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
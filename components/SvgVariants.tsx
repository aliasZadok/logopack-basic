import React, { useEffect, useState } from 'react';
import styles from './SvgVariants.module.css';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import { Canvg } from 'canvg';

extend([namesPlugin]);

interface SvgVariantsProps {
    originalSvg: string;
    paddingX: number;
    paddingY: number;
    sizes: { type: string; value: number | { width: number, height: number } }[];
    initialPrimaryColor: string;
    initialSecondaryColor: string;
    newPrimaryColor: string;
    newSecondaryColor: string;
    onProcessedSvgUpdate: (fullColorSvg: string, whiteSvg: string, blackSvg: string) => void;
    onSizeVariantUpdate: (sizeVariants: { [key: string]: string }) => void;
    createCmykVariant: (svg: string, primaryCmyk: { c: number, m: number, y: number, k: number }, secondaryCmyk: { c: number, m: number, y: number, k: number }) => string;
}

const SvgVariants: React.FC<SvgVariantsProps> = ({
    originalSvg,
    paddingX,
    paddingY,
    sizes,
    initialPrimaryColor,
    initialSecondaryColor,
    newPrimaryColor,
    newSecondaryColor,
    onProcessedSvgUpdate,
    onSizeVariantUpdate,
    createCmykVariant
}) => {
    const [processedOriginalSvg, setProcessedOriginalSvg] = useState('');
    const [processedWhiteSvg, setProcessedWhiteSvg] = useState('');
    const [processedBlackSvg, setProcessedBlackSvg] = useState('');
    const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

    const convertToHex = (color: string): string => {
        const colordColor = colord(color);
        return colordColor.isValid() ? colordColor.toHex() : color;
    };

    const updatePrimarySecondaryColors = (svg: string, newPrimaryColor: string, newSecondaryColor: string): string => {
        const hexInitialPrimaryColor = convertToHex(initialPrimaryColor);
        const hexInitialSecondaryColor = convertToHex(initialSecondaryColor);
        const hexNewPrimaryColor = convertToHex(newPrimaryColor);
        const hexNewSecondaryColor = convertToHex(newSecondaryColor);

        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');

        const styleElements = doc.getElementsByTagName('style');
        if (styleElements.length > 0) {
            let styleContent = styleElements[0].innerHTML;

            const replaceColor = (content: string, initialColor: string, newColor: string) => {
                const hexInitialColor = convertToHex(initialColor);
                const regex = new RegExp(`fill:\\s*(${initialColor}|${hexInitialColor})`, 'g');
                return content.replace(regex, `fill: ${newColor}`);
            };

            styleContent = replaceColor(styleContent, initialPrimaryColor, hexNewPrimaryColor);
            styleContent = replaceColor(styleContent, initialSecondaryColor, hexNewSecondaryColor);

            styleElements[0].innerHTML = styleContent;
        }

        const traverseAndUpdate = (node: Element) => {
            const fill = node.getAttribute('fill');
            if (fill) {
                const hexFill = convertToHex(fill);
                if (hexFill === hexInitialPrimaryColor) {
                    node.setAttribute('fill', hexNewPrimaryColor);
                } else if (hexFill === hexInitialSecondaryColor) {
                    node.setAttribute('fill', hexNewSecondaryColor);
                }
            }
            Array.from(node.children).forEach(traverseAndUpdate);
        };
        traverseAndUpdate(doc.documentElement);

        return new XMLSerializer().serializeToString(doc);
    };

    const removeClassAttribute = (svg: string): string => {
        return svg.replace(/class="[^"]*"/g, '');
    };

    const processSvgColors = (svg: string, fillColor: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(removeClassAttribute(svg), 'image/svg+xml');
        const traverseAndFill = (node: Element) => {
            if (node.tagName.toLowerCase() !== 'svg') {
                node.setAttribute('fill', fillColor);
            }
            Array.from(node.children).forEach(traverseAndFill);
        };
        traverseAndFill(doc.documentElement);
        return new XMLSerializer().serializeToString(doc);
    };

    const removeStyleTag = (svg: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const styleElements = doc.getElementsByTagName('style');
        if (styleElements.length > 0) {
            styleElements[0].parentNode?.removeChild(styleElements[0]);
        }
        return new XMLSerializer().serializeToString(doc);
    };

    const applyViewBoxChanges = (svg: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = doc.documentElement;

        if (svgElement.hasAttribute('viewBox')) {
            const viewBoxValues = svgElement.getAttribute('viewBox')!.split(' ').map(Number);
            viewBoxValues[0] -= paddingX / 2;
            viewBoxValues[1] -= paddingY / 2;
            viewBoxValues[2] += paddingX;
            viewBoxValues[3] += paddingY;
            svgElement.setAttribute('viewBox', viewBoxValues.join(' '));
        } else {
            const width = svgElement.getAttribute('width') ? parseFloat(svgElement.getAttribute('width')!) : 100;
            const height = svgElement.getAttribute('height') ? parseFloat(svgElement.getAttribute('height')!) : 100;
            svgElement.setAttribute('viewBox', `-${paddingX / 2} -${paddingY / 2} ${width + paddingX} ${height + paddingY}`);
        }

        return new XMLSerializer().serializeToString(doc);
    };

    const applySizeChanges = (svg: string, width?: number, height?: number): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = doc.documentElement;

        if (width) {
            svgElement.setAttribute('width', width.toString());
        }
        if (height) {
            svgElement.setAttribute('height', height.toString());
        }

        return new XMLSerializer().serializeToString(doc);
    };

    const createSizeVariant = (svg: string, size: { type: string; value: number | { width: number; height: number } }, variant: string): { filename: string, modifiedSvg: string } => {
        let modifiedSvg = svg;

        if (size.type === 'Width' && typeof size.value === 'number') {
            modifiedSvg = applySizeChanges(modifiedSvg, size.value);
        } else if (size.type === 'Height' && typeof size.value === 'number') {
            modifiedSvg = applySizeChanges(modifiedSvg, undefined, size.value);
        } else if (size.type === 'Dimensions' && typeof size.value === 'object') {
            modifiedSvg = applySizeChanges(modifiedSvg, size.value.width, size.value.height);
        }

        const filename = `${variant}_${
            size.type === 'Dimensions'
                ? `${(size.value as { width: number; height: number }).width}×${(size.value as { width: number; height: number }).height}`
                : `${size.value}_${size.type === 'Width' ? 'w' : 'h'}`
        }`;

        return { filename, modifiedSvg };
    };

    const generateSizeVariants = () => {
        const variants = ['original', 'white', 'black'];
        const sizeVariants: { [key: string]: string } = {};

        variants.forEach((variant) => {
            sizes.forEach((size) => {
                const variantSvg = variant === 'original' ? processedOriginalSvg : variant === 'white' ? processedWhiteSvg : processedBlackSvg;
                const { filename, modifiedSvg } = createSizeVariant(variantSvg, size, variant);
                sizeVariants[filename] = modifiedSvg;
            });
        });

        onSizeVariantUpdate(sizeVariants);
    };

    useEffect(() => {
        const whiteSvg = processSvgColors(removeStyleTag(originalSvg), 'white');
        const blackSvg = processSvgColors(removeStyleTag(originalSvg), 'black');
        setProcessedWhiteSvg(whiteSvg);
        setProcessedBlackSvg(blackSvg);

        const measureSvgDimensions = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const v = await Canvg.from(ctx, originalSvg);
                v.render();
                setSvgDimensions({ width: canvas.width, height: canvas.height });
            }
        };

        measureSvgDimensions();
    }, [originalSvg]);

    useEffect(() => {
        const modifiedOriginalSvg = applyViewBoxChanges(updatePrimarySecondaryColors(originalSvg, newPrimaryColor, newSecondaryColor));
        const modifiedWhiteSvg = applyViewBoxChanges(processSvgColors(removeStyleTag(originalSvg), 'white'));
        const modifiedBlackSvg = applyViewBoxChanges(processSvgColors(removeStyleTag(originalSvg), 'black'));
        setProcessedOriginalSvg(modifiedOriginalSvg);
        setProcessedWhiteSvg(modifiedWhiteSvg);
        setProcessedBlackSvg(modifiedBlackSvg);
        onProcessedSvgUpdate(modifiedOriginalSvg, modifiedWhiteSvg, modifiedBlackSvg);
    }, [originalSvg, paddingX, paddingY, newPrimaryColor, newSecondaryColor]);

    useEffect(() => {
        generateSizeVariants();
    }, [processedOriginalSvg, processedWhiteSvg, processedBlackSvg, sizes]);

    return (
        <div className={styles.container}>
            <div className={styles.variantRow}>
                <div className={styles.variant} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                    <h3>Full Color</h3>
                    <div className={styles.svgWrapper} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                        <div
                            style={{
                                height: '100%',
                                border: (paddingX > 0 || paddingY > 0) ? '1px dashed black' : 'none'
                            }}
                            dangerouslySetInnerHTML={{ __html: processedOriginalSvg }}
                        />
                    </div>
                </div>
                <div className={`${styles.variant} ${styles.whiteContainer}`} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                    <h3 style={{ color: 'white' }}>White</h3>
                    <div className={styles.svgWrapper} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                        <div
                            style={{
                                height: '100%',
                                border: (paddingX > 0 || paddingY > 0) ? '1px dashed white' : 'none'
                            }}
                            dangerouslySetInnerHTML={{ __html: processedWhiteSvg }}
                        />
                    </div>
                </div>
                <div className={styles.variant} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                    <h3>Black</h3>
                    <div className={styles.svgWrapper} style={{ width: svgDimensions.width, height: svgDimensions.height }}>
                        <div
                            style={{
                                height: '100%',
                                border: (paddingX > 0 || paddingY > 0) ? '1px dashed black' : 'none'
                            }}
                            dangerouslySetInnerHTML={{ __html: processedBlackSvg }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SvgVariants;
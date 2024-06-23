'use client';

import React, { useState } from 'react';
import SvgUploader from '../components/SvgUploader';
import SvgVariants from '../components/SvgVariants';
import FormatSelector from '../components/FormatSelector';
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import cmykPlugin from 'colord/plugins/cmyk';

extend([namesPlugin, cmykPlugin]);

export default function Home() {
    const [originalSvg, setOriginalSvg] = useState<string | null>(null);
    const [initialPrimaryColor, setInitialPrimaryColor] = useState<string>('#000000');
    const [initialSecondaryColor, setInitialSecondaryColor] = useState<string>('#FFFFFF');
    const [newPrimaryColor, setNewPrimaryColor] = useState<string>('#000000');
    const [newSecondaryColor, setNewSecondaryColor] = useState<string>('#FFFFFF');
    const [paddingX, setPaddingX] = useState<number>(0);
    const [paddingY, setPaddingY] = useState<number>(0);
    const [sizes, setSizes] = useState<{ type: string; value: number | { width: number, height: number } }[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [processedFullColorSvg, setProcessedFullColorSvg] = useState<string>('');
    const [processedWhiteSvg, setProcessedWhiteSvg] = useState<string>('');
    const [processedBlackSvg, setProcessedBlackSvg] = useState<string>('');
    const [sizeVariants, setSizeVariants] = useState<{ [key: string]: string }>({});

    const handleUpload = (svgContent: string, primary: string, secondary: string, uploadedFileName: string) => {
        setOriginalSvg(svgContent);
        setInitialPrimaryColor(primary);
        setInitialSecondaryColor(secondary);
        setNewPrimaryColor(primary);
        setNewSecondaryColor(secondary);
        setFileName(uploadedFileName);
    };

    const handlePaddingChange = (x: number, y: number) => {
        setPaddingX(x);
        setPaddingY(y);
    };

    const handleSizeChange = (newSizes: { type: string; value: number | { width: number, height: number } }[]) => {
        setSizes(newSizes);
    };

    const handleProcessedSvgUpdate = (fullColorSvg: string, whiteSvg: string, blackSvg: string) => {
        setProcessedFullColorSvg(fullColorSvg);
        setProcessedWhiteSvg(whiteSvg);
        setProcessedBlackSvg(blackSvg);
    };

    const handleSizeVariantUpdate = (newSizeVariants: { [key: string]: string }) => {
        setSizeVariants(newSizeVariants);
    };

    const createCmykVariant = (svg: string, primaryCmyk: { c: number, m: number, y: number, k: number }, secondaryCmyk: { c: number, m: number, y: number, k: number }): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');

        const traverseAndUpdate = (node: Element) => {
            const fill = node.getAttribute('fill');
            if (fill) {
                if (fill === convertToHex(initialPrimaryColor)) {
                    node.setAttribute('fill', `rgb(${colord(initialPrimaryColor).toRgb().r},${colord(initialPrimaryColor).toRgb().g},${colord(initialPrimaryColor).toRgb().b}) icc-color(#CMYK,${primaryCmyk.c}%,${primaryCmyk.m}%,${primaryCmyk.y}%,${primaryCmyk.k}%)`);
                } else if (fill === convertToHex(initialSecondaryColor)) {
                    node.setAttribute('fill', `rgb(${colord(initialSecondaryColor).toRgb().r},${colord(initialSecondaryColor).toRgb().g},${colord(initialSecondaryColor).toRgb().b}) icc-color(#CMYK,${secondaryCmyk.c}%,${secondaryCmyk.m}%,${secondaryCmyk.y}%,${secondaryCmyk.k}%)`);
                }
            }
            Array.from(node.children).forEach(traverseAndUpdate);
        };
        traverseAndUpdate(doc.documentElement);

        return new XMLSerializer().serializeToString(doc);
    };

    const convertToHex = (color: string): string => {
        const colordColor = colord(color);
        return colordColor.isValid() ? colordColor.toHex() : color;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 0', backgroundColor: '#fff', minHeight: '100vh' }}>
            <img src="/app_logo.svg" alt="Web App Logo" style={{ marginBottom: '50px', width: '300px', height: 'auto' }} />
            <h1 style={{ marginBottom: '20px', color: '#000', fontSize: '80px', width: '600px', textAlign: 'center' }}>GENERATE LOGO FILES IN SECONDS.</h1>
            <SvgUploader onUpload={handleUpload} />
            {originalSvg && (
                <>
                    <SvgVariants
                        originalSvg={originalSvg}
                        paddingX={paddingX}
                        paddingY={paddingY}
                        sizes={sizes}
                        initialPrimaryColor={initialPrimaryColor}
                        initialSecondaryColor={initialSecondaryColor}
                        newPrimaryColor={newPrimaryColor}
                        newSecondaryColor={newSecondaryColor}
                        onProcessedSvgUpdate={handleProcessedSvgUpdate}
                        onSizeVariantUpdate={handleSizeVariantUpdate}
                        createCmykVariant={createCmykVariant}
                    />
                    <FormatSelector
                        originalSvg={processedFullColorSvg}
                        blackSvg={processedBlackSvg}
                        whiteSvg={processedWhiteSvg}
                        primaryColor={newPrimaryColor}
                        secondaryColor={newSecondaryColor}
                        onPaddingChange={handlePaddingChange}
                        onSizeChange={handleSizeChange}
                        fileName={fileName}
                        setPrimaryColor={setNewPrimaryColor}
                        setSecondaryColor={setNewSecondaryColor}
                    />
                </>
            )}
        </div>
    );
}